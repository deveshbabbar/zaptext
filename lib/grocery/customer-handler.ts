// lib/grocery/customer-handler.ts
//
// Single entry point for all customer messages on grocery clients. Loads
// the cart draft, classifies intent (Groq llama in JSON mode), and routes
// to the right step. Each step is small and either:
//   - replies and saves an updated draft, OR
//   - delegates to placeOrder() and clears the draft.
//
// State implicit in the draft:
//   no items                   → discovery (show catalog)
//   items, no address          → ask address
//   items + zone, no slot      → ask slot
//   items + zone + slot        → ask confirm
//
// Interactive replies (id prefixes) bypass intent classification:
//   add:<product_id>           → user tapped a catalog row
//   qty:<product_id>:<qty>     → user tapped qty button
//   slot:<slot_id>:<date>      → user tapped slot button
//   confirm:yes / confirm:no   → confirmation buttons
//
// NOTE: WhatsApp send helpers in this codebase take phoneNumberId as the
// first argument (sendWhatsAppMessage(phoneNumberId, to, text), etc.).
// There is no sendWhatsAppText. The dispatcher therefore accepts
// phoneNumberId as its first parameter (matches handleGroceryOwnerMessage)
// and threads it through every step handler.

import {
  sendWhatsAppMessage,
  sendInteractiveList,
  sendInteractiveButtons,
} from '../whatsapp';
import { chatJSON } from './groq';
import { INTENT_CLASSIFIER_PROMPT, type GroceryIntent } from './prompt';
import { getCatalogForDate } from '../db/grocery-daily-catalog';
import { todayIsoIST, dayOfWeekIST } from './date-utils';
import { listZones, getZone } from '../db/grocery-zones';
import { matchZone } from './zones';
import { availableSlotsForClient } from './slots';
import { findSubstitute } from './substitutions';
import {
  loadDraft,
  appendItems,
  setAddress,
  setSlot,
  setItems,
  clearDraft,
} from './cart-draft';
import { parseCartText, resolveCartItems } from './cart-parser';
import { placeOrder, PlaceOrderError } from './orders';
import type { CartItem } from './types';
import {
  catalogToListSections,
  catalogOverflowCount,
  catalogTruncatedHint,
  qtyButtonsForProduct,
  slotButtons,
  formatCartSummary,
  formatOrderConfirmation,
  formatOwnerNotification,
} from './wa-messages';
import { getSlot } from '../db/grocery-slots';
import { getOrder } from '../db/grocery-orders';
import {
  createRecurring,
  listRecurring,
  pauseRecurringForCustomer,
} from '../db/grocery-recurring-orders';
import { computeOrderTotals, meetsMinOrder } from './pricing';

interface ClientLite {
  client_id: string;
  whatsapp_number: string;
  business_name: string;
}

interface InboundMessageLite {
  from: string;
  type: 'text' | 'interactive' | 'audio' | string;
  text?: { body: string };
  interactive?: {
    type: 'list_reply' | 'button_reply';
    list_reply?: { id: string; title: string };
    button_reply?: { id: string; title: string };
  };
  audio?: { id: string; mime_type: string };
}

export async function handleGroceryCustomerMessage(
  phoneNumberId: string,
  client: ClientLite,
  message: InboundMessageLite
): Promise<void> {
  const customerPhone = message.from;

  // ── Interactive reply path (bypass intent classification) ───
  if (message.type === 'interactive' && message.interactive) {
    const id =
      message.interactive.list_reply?.id ?? message.interactive.button_reply?.id ?? '';
    if (id.startsWith('add:')) {
      return handleAddItem(phoneNumberId, client, customerPhone, id.slice(4));
    }
    if (id.startsWith('qty:')) {
      const [, productId, qtyStr] = id.split(':');
      return handleQty(phoneNumberId, client, customerPhone, productId, parseFloat(qtyStr));
    }
    if (id.startsWith('slot:')) {
      const [, slotId, slotDate] = id.split(':');
      return handleSlotPick(phoneNumberId, client, customerPhone, slotId, slotDate);
    }
    if (id === 'confirm:yes') return handleConfirm(phoneNumberId, client, customerPhone);
    if (id === 'confirm:no') return handleAbandon(phoneNumberId, client, customerPhone);
    if (id === 'sub:yes' || id === 'sub:no')
      return handleSubChoice(phoneNumberId, client, customerPhone, id);
    if (id.startsWith('recur:yes:')) {
      const orderId = id.split(':')[2];
      return handleRecurringSetup(phoneNumberId, client, customerPhone, orderId);
    }
    if (id === 'recur:no') {
      await sendWhatsAppMessage(phoneNumberId, customerPhone, 'OK no problem. Phir kabhi.');
      return;
    }
    if (id.startsWith('recur-confirm:')) {
      return handleRecurringConfirm(phoneNumberId, client, customerPhone, id.split(':')[1]);
    }
    if (id.startsWith('recur-edit:')) {
      await sendWhatsAppMessage(
        phoneNumberId,
        customerPhone,
        'OK, naye items type karein (e.g. "tamatar 1kg pyaaz 500g") aur confirm karein.'
      );
      return;
    }
    if (id.startsWith('recur-skip:')) {
      await sendWhatsAppMessage(phoneNumberId, customerPhone, 'OK aaj skip kar diya.');
      return;
    }
  }

  if (message.type !== 'text' || !message.text?.body) {
    await sendWhatsAppMessage(phoneNumberId, customerPhone, 'Type "menu" to see today list.');
    return;
  }

  const text = message.text.body.trim();
  if (!text) return;

  // ── Stop-recurring shortcut (before intent classification) ───
  if (/^stop\s+recur/i.test(text) || /\brecurring\s+(stop|cancel|band)\b/i.test(text)) {
    await pauseRecurringForCustomer(client.client_id, customerPhone);
    await sendWhatsAppMessage(
      phoneNumberId,
      customerPhone,
      'OK recurring orders band kar diye.'
    );
    return;
  }

  // ── Intent classification ───
  let intent: GroceryIntent = 'unknown';
  try {
    const out = await chatJSON<{ intent: GroceryIntent }>(
      INTENT_CLASSIFIER_PROMPT,
      text
    );
    intent = (out.intent ?? 'unknown') as GroceryIntent;
  } catch {
    /* fall through to "order" heuristic */
  }

  if (intent === 'greeting' || intent === 'show_catalog' || /^(menu|list|hi|hello|namaste)\b/i.test(text)) {
    return showCatalog(phoneNumberId, client, customerPhone);
  }
  if (intent === 'order') return handleFreeTextOrder(phoneNumberId, client, customerPhone, text);
  if (intent === 'set_address') return handleAddress(phoneNumberId, client, customerPhone, text);
  if (intent === 'cancel_order') return handleAbandon(phoneNumberId, client, customerPhone);
  if (intent === 'human_handoff') {
    await sendWhatsAppMessage(
      phoneNumberId,
      customerPhone,
      `Owner ko bata diya hai, woh thoda samay mein contact karenge.`
    );
    // owner-side notify is the existing welcome-menu handoff path; reuse it.
    return;
  }

  // Off-topic guardrail.
  await sendWhatsAppMessage(
    phoneNumberId,
    customerPhone,
    'Main sirf order leta hoon. Aaj ki list dekhni hai? Type "menu".'
  );
}

// ── Step handlers ──

async function showCatalog(
  phoneNumberId: string,
  client: ClientLite,
  to: string
): Promise<void> {
  const today = todayIsoIST();
  const catalog = await getCatalogForDate(client.client_id, today);
  if (catalog.filter((c) => c.in_stock).length === 0) {
    await sendWhatsAppMessage(
      phoneNumberId,
      to,
      'Aaj ka stock abhi update nahi hua. Thodi der baad try karein.'
    );
    return;
  }
  const sections = catalogToListSections(catalog);
  const overflow = catalogOverflowCount(catalog);
  const body =
    `Aaj ki list (${today}):\nTap to add, ya seedha type karein "tamatar 1kg pyaaz 500g"` +
    catalogTruncatedHint(overflow);
  await sendInteractiveList(phoneNumberId, to, body, 'Items dekho', sections);
}

async function handleAddItem(
  phoneNumberId: string,
  _client: ClientLite,
  customerPhone: string,
  productId: string
): Promise<void> {
  // Show qty buttons. Adding happens in handleQty.
  await sendInteractiveButtons(
    phoneNumberId,
    customerPhone,
    'Kitna chahiye?',
    qtyButtonsForProduct(productId)
  );
}

async function handleQty(
  phoneNumberId: string,
  client: ClientLite,
  customerPhone: string,
  productId: string,
  qty: number
): Promise<void> {
  if (!Number.isFinite(qty) || qty <= 0) return;
  const today = todayIsoIST();
  const catalog = await getCatalogForDate(client.client_id, today);
  const entry = catalog.find((c) => c.product.id === productId);
  if (!entry) return;

  if (!entry.in_stock) return offerSubstitute(phoneNumberId, client, customerPhone, productId);

  const draft = await loadDraft(client.client_id, customerPhone);
  await appendItems(draft, [
    {
      product_id: entry.product.id,
      name: entry.product.name,
      qty,
      unit: entry.product.unit,
      price_per_unit: entry.price_per_unit,
      line_total: round2(qty * entry.price_per_unit),
    },
  ]);

  await sendWhatsAppMessage(
    phoneNumberId,
    customerPhone,
    `Added: ${qty}${entry.product.unit} ${entry.product.name}\n\n${formatCartSummary(draft.items)}\n\nAur kuch chahiye? Ya address bhej do.`
  );
}

async function handleFreeTextOrder(
  phoneNumberId: string,
  client: ClientLite,
  customerPhone: string,
  text: string
): Promise<void> {
  const today = todayIsoIST();
  const catalog = await getCatalogForDate(client.client_id, today);
  if (catalog.length === 0) {
    await sendWhatsAppMessage(
      phoneNumberId,
      customerPhone,
      'Aaj ka catalog ready nahi hai. Thodi der baad try karein.'
    );
    return;
  }

  let parsed;
  try {
    parsed = await parseCartText(text);
  } catch {
    await sendWhatsAppMessage(
      phoneNumberId,
      customerPhone,
      "Order samajh nahi aaya. Try: 'tamatar 1kg pyaaz 500g'"
    );
    return;
  }
  if (parsed.length === 0) {
    await sendWhatsAppMessage(
      phoneNumberId,
      customerPhone,
      'Items nahi mile. Type "menu" to see list.'
    );
    return;
  }

  const { matched, unmatched, outOfStock } = resolveCartItems(parsed, catalog);

  const draft = await loadDraft(client.client_id, customerPhone);
  if (matched.length > 0) await appendItems(draft, matched);

  const lines: string[] = [];
  if (matched.length > 0) lines.push(formatCartSummary(draft.items));
  if (unmatched.length > 0) lines.push(`\nNahi mile: ${unmatched.join(', ')}`);
  if (outOfStock.length > 0)
    lines.push(`\nOut of stock: ${outOfStock.map((i) => i.name).join(', ')}`);
  if (matched.length > 0) lines.push('\nAur kuch? Ya address bhej do.');
  else lines.push('\nType "menu" to see today list.');

  await sendWhatsAppMessage(phoneNumberId, customerPhone, lines.join('\n'));

  // Offer substitute for the first out-of-stock item.
  if (outOfStock.length > 0) {
    await offerSubstitute(phoneNumberId, client, customerPhone, outOfStock[0].product_id);
  }
}

async function offerSubstitute(
  phoneNumberId: string,
  client: ClientLite,
  customerPhone: string,
  productId: string
): Promise<void> {
  const sub = await findSubstitute(client.client_id, productId);
  if (!sub) return;
  await sendInteractiveButtons(
    phoneNumberId,
    customerPhone,
    `${productId} khatam hai. ${sub.product.name} ₹${sub.price_per_unit}/${sub.product.unit} lelenge?`,
    [
      { id: `add:${sub.product.id}`, title: 'Haan add karo' },
      { id: 'sub:no', title: 'Skip' },
    ]
  );
}

async function handleSubChoice(
  phoneNumberId: string,
  _client: ClientLite,
  customerPhone: string,
  id: string
): Promise<void> {
  if (id === 'sub:no') {
    await sendWhatsAppMessage(phoneNumberId, customerPhone, 'OK skip kar diya. Aur kuch?');
  }
}

async function handleAddress(
  phoneNumberId: string,
  client: ClientLite,
  customerPhone: string,
  text: string
): Promise<void> {
  const draft = await loadDraft(client.client_id, customerPhone);
  if (draft.items.length === 0) {
    await sendWhatsAppMessage(phoneNumberId, customerPhone, 'Pehle items chunlein. Type "menu".');
    return;
  }
  const zones = await listZones(client.client_id);
  const zone = matchZone(text, zones);
  if (!zone) {
    const labels = zones.map((z) => z.label).join(', ') || '(no zones configured)';
    await sendWhatsAppMessage(
      phoneNumberId,
      customerPhone,
      `Sorry, abhi hum sirf in zones mein deliver karte hain: ${labels}. Pin code bhejo confirm ke liye.`
    );
    return;
  }
  await setAddress(draft, text, zone.id);
  // Now offer slots.
  const slots = await availableSlotsForClient(client.client_id);
  if (slots.length === 0) {
    await sendWhatsAppMessage(
      phoneNumberId,
      customerPhone,
      'Aaj koi slot available nahi. Owner se baat karein.'
    );
    return;
  }
  await sendInteractiveButtons(phoneNumberId, customerPhone, 'Slot chunein:', slotButtons(slots));
}

async function handleSlotPick(
  phoneNumberId: string,
  client: ClientLite,
  customerPhone: string,
  slotId: string,
  slotDate: string
): Promise<void> {
  const draft = await loadDraft(client.client_id, customerPhone);
  await setSlot(draft, slotId, slotDate);

  if (!draft.zone_id) {
    await sendWhatsAppMessage(phoneNumberId, customerPhone, 'Pehle address bhejein.');
    return;
  }
  const zone = await getZone(draft.zone_id);
  if (!zone) {
    await sendWhatsAppMessage(phoneNumberId, customerPhone, 'Zone error. Owner se baat karein.');
    return;
  }
  const min = meetsMinOrder(draft.items, zone);
  if (!min.ok) {
    await sendWhatsAppMessage(
      phoneNumberId,
      customerPhone,
      `Min order ₹${zone.min_order} hai. ₹${min.shortfall} aur kuch add karoge?`
    );
    return;
  }
  const totals = computeOrderTotals(draft.items, zone);
  const slot = await getSlot(slotId);
  const slotLabel = slot?.label ?? slotId;
  await sendInteractiveButtons(
    phoneNumberId,
    customerPhone,
    [
      formatCartSummary(draft.items),
      `Delivery: ₹${totals.delivery_fee}`,
      `Total: ₹${totals.total} (COD)`,
      ``,
      `Slot: ${slotLabel} (${slotDate})`,
      `Address: ${draft.delivery_address}`,
      ``,
      `Confirm?`,
    ].join('\n'),
    [
      { id: 'confirm:yes', title: 'Haan confirm' },
      { id: 'confirm:no', title: 'Cancel' },
    ]
  );
}

async function handleConfirm(
  phoneNumberId: string,
  client: ClientLite,
  customerPhone: string
): Promise<void> {
  const draft = await loadDraft(client.client_id, customerPhone);
  try {
    const order = await placeOrder(draft);
    const slot = await getSlot(order.slot_id);
    const slotLabel = slot?.label ?? order.slot_id;
    await sendWhatsAppMessage(
      phoneNumberId,
      customerPhone,
      formatOrderConfirmation(order, slotLabel)
    );
    await sendWhatsAppMessage(
      phoneNumberId,
      client.whatsapp_number,
      formatOwnerNotification(order, customerPhone, slotLabel)
    );
    // Offer recurring weekly setup.
    const dow = dayOfWeekIST();
    await sendInteractiveButtons(
      phoneNumberId,
      customerPhone,
      `Yeh order har ${dayName(dow)} ko repeat karoon?`,
      [
        { id: `recur:yes:${order.id}`, title: 'Haan repeat' },
        { id: 'recur:no', title: 'Nahi' },
      ]
    );
  } catch (err) {
    if (err instanceof PlaceOrderError) {
      await sendWhatsAppMessage(
        phoneNumberId,
        customerPhone,
        `Order place nahi ho saka: ${err.message}`
      );
    } else {
      console.error(err);
      await sendWhatsAppMessage(
        phoneNumberId,
        customerPhone,
        'Server error. Thodi der baad try karein.'
      );
    }
  }
}

async function handleAbandon(
  phoneNumberId: string,
  client: ClientLite,
  customerPhone: string
): Promise<void> {
  await clearDraft(client.client_id, customerPhone);
  await sendWhatsAppMessage(
    phoneNumberId,
    customerPhone,
    'OK cancel kar diya. Naye order ke liye type "menu".'
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function dayName(dow: number): string {
  return (
    ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dow] ?? ''
  );
}

async function handleRecurringSetup(
  phoneNumberId: string,
  client: ClientLite,
  customerPhone: string,
  orderId: string
): Promise<void> {
  const order = await getOrder(orderId);
  if (!order || order.customer_phone !== customerPhone) {
    await sendWhatsAppMessage(phoneNumberId, customerPhone, 'Order nahi mila.');
    return;
  }
  const dow = dayOfWeekIST();
  await createRecurring({
    client_id: client.client_id,
    customer_phone: customerPhone,
    day_of_week: dow,
    slot_id: order.slot_id,
    template_items: order.items,
  });
  await sendWhatsAppMessage(
    phoneNumberId,
    customerPhone,
    `Set! Har ${dayName(dow)} ko subah ek reminder bhejunga "Aaj ka regular order: ..." — aap confirm/edit/skip kar sakte ho. Cancel karna ho toh "stop recurring" likho.`
  );
}

async function handleRecurringConfirm(
  phoneNumberId: string,
  client: ClientLite,
  customerPhone: string,
  recurringId: string
): Promise<void> {
  const all = await listRecurring(client.client_id);
  const r = all.find((x) => x.id === recurringId);
  if (!r || r.customer_phone !== customerPhone) {
    await sendWhatsAppMessage(phoneNumberId, customerPhone, 'Recurring order nahi mila.');
    return;
  }
  const today = todayIsoIST();
  const catalog = await getCatalogForDate(client.client_id, today);
  const items: CartItem[] = [];
  for (const t of r.template_items) {
    const c = catalog.find((x) => x.product.id === t.product_id);
    if (!c || !c.in_stock) continue;
    items.push({
      ...t,
      price_per_unit: c.price_per_unit,
      line_total: round2(t.qty * c.price_per_unit),
    });
  }
  if (items.length === 0) {
    await sendWhatsAppMessage(phoneNumberId, customerPhone, 'Aaj koi item available nahi. Skip karte hain.');
    return;
  }
  const draft = await loadDraft(client.client_id, customerPhone);
  await setItems(draft, items);
  if (r.slot_id) {
    const tomorrow = addDaysISO(today, 1);
    await setSlot(draft, r.slot_id, tomorrow);
  }
  await sendWhatsAppMessage(
    phoneNumberId,
    customerPhone,
    `Cart ready hai. Address bhejein confirm ke liye.`
  );
}

function addDaysISO(yyyymmdd: string, days: number): string {
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}
