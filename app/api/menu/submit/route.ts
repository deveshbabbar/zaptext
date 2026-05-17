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
import { createOrder, getRecentOrderForCustomer, RECENT_ORDER_WINDOW_MS, type DineInOrderItem, type DineInOrderType } from '@/lib/db/restaurant-dine-in';
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
  /** Customer delivery lat/lng (Phase 3K). Forwarded from /m page
   *  when the customer reached us via a WhatsApp location share OR
   *  dropped a map pin. Used to assign the right multi-outlet and
   *  saved on the order. */
  deliveryLat?: number;
  deliveryLng?: number;
  /** Set by the /m page "Place a different order" button when a
   *  customer with a recent order explicitly chooses to place a
   *  second one (e.g. for a colleague at a different address). The
   *  short window is anti-double-tap, not a hard cap. */
  bypassRecent?: boolean;
}

const MAX_ITEMS_PER_ORDER = 40;
const MAX_LINE_QTY = 30;

// Returns a SINGLE-language confirmation. ENGLISH IS THE DEFAULT —
// we only switch to Hinglish when the bot is explicitly configured
// with a Hindi-flavour language AND no English. This matches the
// per-message LANGUAGE RULE used by the AI prompt: never volunteer
// Hinglish; only emit it when we have explicit signal.
//
// Bot language config decision table:
//   - languages = []                  → English
//   - languages = ['English']         → English
//   - languages = ['English','Hindi'] → English (English preferred)
//   - languages = ['Hindi']           → Hinglish
//   - languages = ['Hinglish']        → Hinglish
//   - languages = ['Hindi','Tamil']   → Hinglish (Hindi-flavour wins
//                                       when English is absent)
//   - undefined                       → English (safe default)
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

  const langs = (input.languages || []).map((l) => l.trim().toLowerCase());
  const hasEnglish = langs.includes('english');
  const hasHindiFlavour =
    langs.includes('hindi') || langs.includes('hinglish');
  // English wins unless the bot is configured Hindi-flavour AND has no
  // English at all — that's the only case we volunteer Hinglish.
  const useEnglish = hasEnglish || (!hasHindiFlavour);

  // FSSAI compliance footer — Reg 2.4.6 requires the licence number
  // appear on every consumer-facing menu/billing surface. Skipped
  // gracefully when the owner hasn't provided one yet.
  const fssaiLine = input.fssaiLicenseNumber
    ? `\n\nFSSAI Lic. ${input.fssaiLicenseNumber}`
    : '';

  if (useEnglish) {
    let tail: string;
    if (input.mode === 'delivery') {
      tail = `Delivery to: ${input.deliveryAddress}\nThe kitchen has been notified. We'll WhatsApp you when it's out for delivery.`;
    } else if (input.mode === 'dine_in') {
      tail = `Table ${input.tableNumber} — kitchen has been notified. We'll bring it to your table.`;
    } else {
      tail = `Pickup ready in ~15-20 min. We'll WhatsApp you when it's ready.`;
    }
    return [
      input.businessName,
      `Order received ✅`,
      lines,
      `Total: ₹${input.total.toFixed(0)}`,
      tail,
    ].join('\n') + fssaiLine;
  }

  // Hinglish-only path (bot explicitly configured Hindi-flavour, no English).
  let tail: string;
  if (input.mode === 'delivery') {
    tail = `Delivery: ${input.deliveryAddress}\nKitchen ko inform kar diya. Out for delivery hone par WhatsApp pe update.`;
  } else if (input.mode === 'dine_in') {
    tail = `Table ${input.tableNumber} — kitchen ko inform kar diya. Aapke table par laayenge jaldi.`;
  } else {
    tail = `Pickup ~15-20 min mein ready. Ready hone par WhatsApp pe update.`;
  }
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

  // Live availability gate. The storefront UI already greys out unavailable
  // items, but a stale browser tab (kept open for an hour while the kitchen
  // sold the last portion) could still submit a sold-out / paused / out-of-
  // window item. Block it here with a clear error so the customer reloads
  // and sees the updated badge. Mirrors the bot's webhook reserveOrder()
  // logic so both order paths fail the same way.
  try {
    const { getActiveInventory, isItemAvailableNow, findBestMatch, formatAvailabilityHuman } =
      await import('@/lib/inventory');
    const inv = await getActiveInventory(clientId);
    if (inv.length > 0) {
      const blocked: string[] = [];
      for (const ci of cleanItems) {
        const m = findBestMatch(inv, ci.name);
        if (!m) continue; // no inventory row → legacy, allow through
        if (m.is_active === false) {
          blocked.push(`${m.name} (paused by kitchen)`);
        } else if (m.tracks_stock !== false && m.stock < ci.qty) {
          blocked.push(`${m.name} (out of stock)`);
        } else if (!isItemAvailableNow(m)) {
          blocked.push(`${m.name} (available ${formatAvailabilityHuman(m)})`);
        }
      }
      if (blocked.length > 0) {
        return NextResponse.json(
          {
            ok: false,
            error: 'item_unavailable',
            message: `Some items in your cart are no longer available:\n• ${blocked.join('\n• ')}\n\nPlease reload the page and pick from the items still in stock.`,
          },
          { status: 409 },
        );
      }
    }
  } catch (err) {
    console.error('[menu-submit] availability gate failed (allowing):', err);
  }

  // Double-tap / spam guard. If a customer phone has placed a
  // non-cancelled order in the last 2 minutes against this client,
  // reject a second submit UNLESS the caller explicitly set
  // bypassRecent (the "/m page Place a different order" button).
  // 2 minutes is the sweet spot: catches accidental duplicate
  // submits without trapping a legitimate second order (different
  // address, second person at the table, etc.).
  if (!body.bypassRecent) {
    const dupe = await getRecentOrderForCustomer(clientId, customerPhone, RECENT_ORDER_WINDOW_MS);
    if (dupe) {
      return NextResponse.json(
        {
          ok: false,
          error: 'duplicate_recent',
          message:
            'You already placed an order moments ago. If this is a new order (different address or for someone else), tap "Place a different order" to continue.',
        },
        { status: 409 }
      );
    }
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

  // Resolve the right outlet for this order (Phase 3K).
  //
  // Single-outlet kitchens: outlet_id stays 'main' (the synthetic
  // outlet from lib/db/outlets.ts). No lat/lng-based work happens.
  //
  // Multi-outlet kitchens with lat/lng provided: run zone math. If
  // the customer is inside an outlet's deliveryRadiusKm, assign that
  // outlet. If they're outside every zone for a DELIVERY order, the
  // submit is rejected with a clear "out of zone" message (the /m
  // page can re-prompt them to switch to takeaway). Dine-in /
  // takeaway never reject on zone — those are at-the-restaurant.
  let resolvedOutletId = 'main';
  const deliveryLat = typeof body.deliveryLat === 'number' && Number.isFinite(body.deliveryLat) && Math.abs(body.deliveryLat) <= 90
    ? body.deliveryLat
    : null;
  const deliveryLng = typeof body.deliveryLng === 'number' && Number.isFinite(body.deliveryLng) && Math.abs(body.deliveryLng) <= 180
    ? body.deliveryLng
    : null;
  try {
    const { getOutletsForClient, assignOutletByLocation } = await import('@/lib/db/outlets');
    const outlets = await getOutletsForClient(clientId);
    const isMulti = outlets.length > 1 || (outlets.length === 1 && outlets[0].id !== 'main');
    if (isMulti && deliveryLat !== null && deliveryLng !== null) {
      const assigned = assignOutletByLocation(outlets, deliveryLat, deliveryLng);
      if (assigned) {
        if (!assigned.inZone && mode === 'delivery') {
          return NextResponse.json(
            {
              ok: false,
              error:
                `We don't deliver to your location yet. ` +
                `Nearest outlet (${assigned.outlet.name}) is ${assigned.distanceKm.toFixed(1)} km away — ` +
                `outside our delivery zones. Try takeaway from ${assigned.outlet.name} instead, or message the kitchen to confirm.`,
            },
            { status: 400 }
          );
        }
        resolvedOutletId = assigned.outlet.id;
      }
    } else if (isMulti && mode === 'delivery') {
      // Multi-outlet delivery without a location pin — we can't
      // route correctly. Accept the order but flag for owner triage.
      // (Customer service window stays open; manager can route.)
      console.warn('[menu-submit] multi-outlet delivery with no location — manual routing required', { clientId, customerPhone });
    }
  } catch (err) {
    // Fail open — never block an order because of outlet-resolution
    // hiccups. Falls back to 'main' which is a safe single-outlet
    // default the dashboard can re-route from.
    console.error('[menu-submit] outlet resolution failed (fallback to main)', err);
  }

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
    outlet_id: resolvedOutletId,
    delivery_lat: deliveryLat,
    delivery_lng: deliveryLng,
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
