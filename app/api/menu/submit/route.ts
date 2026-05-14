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

interface SubmitBody {
  clientId?: string;
  mode?: 'delivery' | 'takeaway' | 'dine_in';
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  tableNumber?: string;
  notes?: string;
  items?: Array<{ name?: string; qty?: number; price?: number }>;
}

const MAX_ITEMS_PER_ORDER = 40;
const MAX_LINE_QTY = 30;

function buildConfirmation(input: {
  businessName: string;
  mode: 'delivery' | 'takeaway' | 'dine_in';
  tableNumber: string;
  deliveryAddress: string;
  items: DineInOrderItem[];
  total: number;
}): string {
  const lines = input.items.map((it) => `• ${it.qty}× ${it.name}`).join('\n');
  let enTail = '';
  let hiTail = '';
  if (input.mode === 'delivery') {
    enTail = `Delivery to: ${input.deliveryAddress}\nThe kitchen has been notified. We'll WhatsApp you when it's out for delivery.`;
    hiTail = `Delivery: ${input.deliveryAddress}\nKitchen ko inform kar diya. Out for delivery hone par WhatsApp pe update.`;
  } else if (input.mode === 'dine_in') {
    enTail = `Table ${input.tableNumber} — kitchen has been notified. We'll bring it to your table.`;
    hiTail = `Table ${input.tableNumber} — kitchen ko inform kar diya. Aapke table par laayenge jaldi.`;
  } else {
    enTail = `Pickup ready in ~15-20 min. We'll WhatsApp you when it's ready.`;
    hiTail = `Pickup ~15-20 min mein ready. Ready hone par WhatsApp pe update.`;
  }
  return [
    `${input.businessName}`,
    `Order received ✅`,
    lines,
    `Total: ₹${input.total.toFixed(0)}`,
    enTail,
    ``,
    `${input.businessName}`,
    `Order mil gaya ✅`,
    lines,
    `Total: ₹${input.total.toFixed(0)}`,
    hiTail,
  ].join('\n');
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

  return NextResponse.json({ ok: true, orderId: order.id, total: order.total });
}
