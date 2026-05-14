// POST /api/menu/submit
//
// Public endpoint hit by the /m/<clientId> menu page (no QR scan, customer
// reached the menu via a bot-shared link). Three order modes:
//   - delivery   → requires customer address, written as order_type='home_delivery'
//   - takeaway   → just customer name, written as order_type='parcel_takeaway'
//   - dine_in    → requires table number, written as order_type='dine_in'
//
// On accept:
//   1. Insert into dine_in_orders.
//   2. Send a bilingual WhatsApp confirmation to the customer's number.
//
// No auth — anyone with the URL can submit. Rate-limited per
// (clientId, customerPhone) so a single device can't spam.

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { getClientById } from '@/lib/db/clients';
import { createOrder, type DineInOrderItem, type DineInOrderType } from '@/lib/db/restaurant-dine-in';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { notifyOwnerOfNewOrder } from '@/lib/restaurant/notify-order';
import { recordConsentEvent } from '@/lib/db/consent-log';

interface SubmitBody {
  clientId?: string;
  mode?: 'delivery' | 'takeaway' | 'dine_in';
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  tableNumber?: string;
  notes?: string;
  items?: Array<{ name?: string; qty?: number; price?: number }>;
  /** DPDPA §6 explicit marketing opt-in. When true we log a separate
   *  `marketing_opt_in` consent event so future Marketing templates
   *  have valid evidence-of-consent under Meta's opt-in policy. */
  marketingOptIn?: boolean;
}

const MAX_ITEMS_PER_ORDER = 40;
const MAX_LINE_QTY = 30;

// Returns a SINGLE-language confirmation. Earlier this concatenated an
// English block AND a Hinglish block — the resulting WhatsApp message
// was twice as long as it needed to be and felt like spam. Now we pick
// one language based on the bot's configured `languages` array:
//   - ['English'] only       → English
//   - anything else / none   → Hinglish (universally understood in
//                              India and the safest default for a bot
//                              that doesn't yet know the customer's
//                              language preference at submit time).
function buildConfirmation(input: {
  businessName: string;
  mode: 'delivery' | 'takeaway' | 'dine_in';
  tableNumber: string;
  deliveryAddress: string;
  items: DineInOrderItem[];
  total: number;
  languages?: string[];
  fssaiLicenseNumber?: string;
}): string {
  const lines = input.items.map((it) => `• ${it.qty}× ${it.name}`).join('\n');
  const englishOnly =
    Array.isArray(input.languages)
    && input.languages.length === 1
    && input.languages[0].trim().toLowerCase() === 'english';

  if (englishOnly) {
    let tail: string;
    if (input.mode === 'delivery') {
      tail = `Delivery to: ${input.deliveryAddress}\nThe kitchen has been notified. We'll WhatsApp you when it's out for delivery.`;
    } else if (input.mode === 'dine_in') {
      tail = `Table ${input.tableNumber} — kitchen has been notified. We'll bring it to your table.`;
    } else {
      tail = `Pickup ready in ~15-20 min. We'll WhatsApp you when it's ready.`;
    }
    // FSSAI compliance footer — Reg 2.4.6 requires the licence number
    // appear on every consumer-facing menu/billing surface. Skipped
    // gracefully when the owner hasn't provided one yet.
    const fssaiLine = input.fssaiLicenseNumber
      ? `\n\nFSSAI Lic. ${input.fssaiLicenseNumber}`
      : '';
    return [
      input.businessName,
      `Order received ✅`,
      lines,
      `Total: ₹${input.total.toFixed(0)}`,
      tail,
    ].join('\n') + fssaiLine;
  }

  // Default: Hinglish only.
  let tail: string;
  if (input.mode === 'delivery') {
    tail = `Delivery: ${input.deliveryAddress}\nKitchen ko inform kar diya. Out for delivery hone par WhatsApp pe update.`;
  } else if (input.mode === 'dine_in') {
    tail = `Table ${input.tableNumber} — kitchen ko inform kar diya. Aapke table par laayenge jaldi.`;
  } else {
    tail = `Pickup ~15-20 min mein ready. Ready hone par WhatsApp pe update.`;
  }
  const fssaiLine = input.fssaiLicenseNumber
    ? `\n\nFSSAI Lic. ${input.fssaiLicenseNumber}`
    : '';
  return [
    input.businessName,
    `Order mil gaya ✅`,
    lines,
    `Total: ₹${input.total.toFixed(0)}`,
    tail,
  ].join('\n') + fssaiLine;
}

export async function POST(request: NextRequest) {
  let body: SubmitBody;
  try {
    body = (await request.json()) as SubmitBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const clientId = String(body.clientId || '').trim();
  const mode = (body.mode === 'takeaway' || body.mode === 'dine_in' || body.mode === 'delivery')
    ? body.mode : 'delivery';
  const customerPhone = String(body.customerPhone || '').replace(/\D/g, '');
  const items = Array.isArray(body.items) ? body.items : [];

  if (!clientId) {
    return NextResponse.json({ ok: false, error: 'Missing clientId' }, { status: 400 });
  }
  if (customerPhone.length < 10) {
    return NextResponse.json({ ok: false, error: 'Valid customer phone required' }, { status: 400 });
  }
  if (items.length === 0) {
    return NextResponse.json({ ok: false, error: 'No items in order' }, { status: 400 });
  }
  if (items.length > MAX_ITEMS_PER_ORDER) {
    return NextResponse.json({ ok: false, error: `Too many items (max ${MAX_ITEMS_PER_ORDER}).` }, { status: 413 });
  }

  const rate = rateLimit(`menu-submit:${clientId}:${customerPhone}`, 6, 60_000);
  if (!rate.ok) {
    return NextResponse.json({ ok: false, error: 'Slow down — try again in a minute.' }, { status: 429 });
  }

  const client = await getClientById(clientId).catch(() => null);
  if (!client || client.type !== 'restaurant') {
    return NextResponse.json({ ok: false, error: 'Restaurant not found' }, { status: 404 });
  }

  const deliveryAddress = String(body.deliveryAddress || '').trim().slice(0, 400);
  const tableNumber = String(body.tableNumber || '').trim().slice(0, 16);
  if (mode === 'delivery' && !deliveryAddress) {
    return NextResponse.json({ ok: false, error: 'Delivery address required' }, { status: 400 });
  }
  if (mode === 'dine_in' && !tableNumber) {
    return NextResponse.json({ ok: false, error: 'Table number required for dine-in' }, { status: 400 });
  }

  const cleanItems: DineInOrderItem[] = items
    .map((it) => ({
      name: String(it.name || '').trim(),
      qty: Math.min(MAX_LINE_QTY, Math.max(1, Math.floor(Number(it.qty) || 1))),
      price: Math.max(0, Number(it.price) || 0),
    }))
    .filter((it) => it.name.length > 0);

  if (cleanItems.length === 0) {
    return NextResponse.json({ ok: false, error: 'No valid items in order' }, { status: 400 });
  }

  // Minimum-order enforcement — applies to DELIVERY mode only. The /m
  // page pricing-transparency banner advertises the minimum; if the
  // submit endpoint then silently accepts an order below it (caught
  // 2026-05-14 with a ₹89 order against a ₹200 advertised minimum),
  // we're violating both the CCPA Dark Patterns disclosure promise
  // and the customer's reasonable expectation. Dine-in / takeaway
  // are unaffected — restaurants traditionally apply minimums only
  // to delivery.
  if (mode === 'delivery') {
    let minOrderText = '';
    try {
      if (client.knowledge_base_json) {
        const kbObj = JSON.parse(client.knowledge_base_json) as Record<string, unknown>;
        if (typeof kbObj.minimumOrder === 'string') minOrderText = kbObj.minimumOrder;
      }
    } catch { /* ignore — no enforcement if KB unreadable */ }
    // Strip currency symbols / commas / spaces and pull the first
    // numeric run. Accepts "Rs.200", "₹200", "200", "Rs 200/-" etc.
    const minMatch = minOrderText.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
    const minOrder = minMatch ? parseFloat(minMatch[1]) : 0;
    if (minOrder > 0) {
      const subtotal = cleanItems.reduce((s, it) => s + it.qty * it.price, 0);
      if (subtotal < minOrder) {
        return NextResponse.json(
          {
            ok: false,
            error:
              `Minimum delivery order is ₹${minOrder.toFixed(0)}. ` +
              `Your cart is ₹${subtotal.toFixed(0)} — please add ₹${(minOrder - subtotal).toFixed(0)} more, ` +
              `or switch to takeaway / dine-in.`,
          },
          { status: 400 }
        );
      }
    }
  }

  const orderType: DineInOrderType =
    mode === 'delivery' ? 'home_delivery' : mode === 'dine_in' ? 'dine_in' : 'parcel_takeaway';

  const order = await createOrder({
    client_id: clientId,
    session_id: null,
    table_number: mode === 'dine_in' ? tableNumber : null,
    customer_phone: customerPhone,
    customer_name: String(body.customerName || '').trim(),
    order_type: orderType,
    items: cleanItems,
    delivery_address: mode === 'delivery' ? deliveryAddress : '',
    special_notes: String(body.notes || '').trim(),
  });

  // Resolve the bot's configured languages + FSSAI licence so the
  // confirmation can pick the right single-language wording AND meet
  // the FSSAI Reg 2.4.6 disclosure requirement. Tolerate malformed
  // KB — the confirmation falls back to Hinglish (the safe default),
  // and an absent FSSAI number simply omits the line.
  let botLanguages: string[] | undefined;
  let fssaiLicenseNumber: string | undefined;
  try {
    if (client.knowledge_base_json) {
      const kbObj = JSON.parse(client.knowledge_base_json) as Record<string, unknown>;
      if (Array.isArray(kbObj.languages)) {
        botLanguages = (kbObj.languages as unknown[]).filter((x): x is string => typeof x === 'string');
      }
      if (typeof kbObj.fssaiLicenseNumber === 'string' && kbObj.fssaiLicenseNumber.trim()) {
        fssaiLicenseNumber = kbObj.fssaiLicenseNumber.trim();
      }
    }
  } catch { /* ignore — undefined falls back to Hinglish */ }

  // Fire WhatsApp confirmation back to the customer. Best-effort —
  // failure here doesn't roll back the order (admin still sees it in
  // the dashboard and can follow up manually).
  if (client.phone_number_id) {
    const confirmation = buildConfirmation({
      businessName: client.business_name,
      mode,
      tableNumber,
      deliveryAddress,
      items: cleanItems,
      total: order.total,
      languages: botLanguages,
      fssaiLicenseNumber,
    });
    try {
      await sendWhatsAppMessage(client.phone_number_id, customerPhone, confirmation);
    } catch (err) {
      console.error('[menu submit] WA confirmation failed', { customerPhone, err });
    }
  }

  // Email the owner so they have a permanent, searchable record + a
  // one-click CTA into /client/restaurant/orders. Best-effort.
  await notifyOwnerOfNewOrder(client, order, 'menu_link');

  // DPDPA 2023 §6/§6(10) evidence: the customer just entered their
  // phone on the /m page and submitted an order — this is "free,
  // specific, informed" consent to retain order details + send a WA
  // confirmation. Log it fire-and-forget so a DB hiccup never fails
  // the order.
  const ua = request.headers.get('user-agent') || '';
  void recordConsentEvent({
    client_id: clientId,
    customer_phone: customerPhone,
    event_type: 'menu_phone_entry',
    source: `/m/${clientId}`,
    business_name_shown: client.business_name,
    categories: ['transactional'],
    user_agent: ua,
  });

  // Separately log marketing opt-in when the customer explicitly
  // ticked the box — this is the ticket Meta requires before any
  // Marketing template can be sent to this number (Business Messaging
  // Policy: "opt-in permission confirming that they wish to receive
  // subsequent messages"). Default-off in the UI; tick is the entire
  // signal we need.
  if (body.marketingOptIn === true) {
    void recordConsentEvent({
      client_id: clientId,
      customer_phone: customerPhone,
      event_type: 'marketing_opt_in',
      source: `/m/${clientId}`,
      business_name_shown: client.business_name,
      categories: ['marketing', 'transactional'],
      user_agent: ua,
    });
  }

  return NextResponse.json({ ok: true, orderId: order.id, total: order.total });
}
