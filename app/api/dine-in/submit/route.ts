// POST /api/dine-in/submit
//
// Receives a dine-in order from the public mobile menu page and:
//   1. Revalidates the session is still open for this (client, table).
//   2. Inserts a dine_in_orders row with order_type='dine_in'.
//   3. Sends a bilingual confirmation back to the customer via WhatsApp.

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { getClientById } from '@/lib/db/clients';
import { getSessionById, getTable, createOrder, type DineInOrderItem } from '@/lib/db/restaurant-dine-in';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { isDineInEnabledForClient } from '@/lib/restaurant/dine-in-handler';
import { notifyOwnerOfNewOrder } from '@/lib/restaurant/notify-order';

interface SubmitBody {
  clientId?: string;
  tableNumber?: string;
  sessionId?: string;
  customerName?: string;
  notes?: string;
  items?: Array<{ name?: string; qty?: number; price?: number }>;
}

const MAX_ITEMS_PER_ORDER = 40;
const MAX_LINE_QTY = 30;

function buildOrderConfirmation(input: {
  businessName: string;
  tableNumber: string;
  items: DineInOrderItem[];
  total: number;
}): string {
  const lines = input.items.map((it) => `• ${it.qty}× ${it.name}`).join('\n');
  return [
    `${input.businessName} — Table ${input.tableNumber}`,
    `Order received ✅`,
    lines,
    `Total: ₹${input.total.toFixed(0)}`,
    `The kitchen has been notified. You'll get an update when it's ready.`,
    ``,
    `${input.businessName} — Table ${input.tableNumber}`,
    `Order mil gaya ✅`,
    lines,
    `Total: ₹${input.total.toFixed(0)}`,
    `Kitchen ko inform kar diya. Ready hone par WhatsApp par update milega.`,
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
  const tableNumber = String(body.tableNumber || '').trim();
  const sessionId = String(body.sessionId || '').trim();
  const items = Array.isArray(body.items) ? body.items : [];

  if (!clientId || !tableNumber || !sessionId) {
    return NextResponse.json({ ok: false, error: 'Missing clientId / tableNumber / sessionId' }, { status: 400 });
  }
  if (items.length === 0) {
    return NextResponse.json({ ok: false, error: 'No items in order' }, { status: 400 });
  }
  if (items.length > MAX_ITEMS_PER_ORDER) {
    return NextResponse.json({ ok: false, error: `Too many items (max ${MAX_ITEMS_PER_ORDER}).` }, { status: 413 });
  }

  const rate = rateLimit(`dine-in-submit:${sessionId}`, 6, 60_000);
  if (!rate.ok) {
    return NextResponse.json({ ok: false, error: 'Slow down — try again in a minute.' }, { status: 429 });
  }

  const [client, session, table] = await Promise.all([
    getClientById(clientId).catch(() => null),
    getSessionById(sessionId).catch(() => null),
    getTable(clientId, tableNumber).catch(() => null),
  ]);

  if (!client || client.type !== 'restaurant') {
    return NextResponse.json({ ok: false, error: 'Restaurant not found' }, { status: 404 });
  }
  if (!(await isDineInEnabledForClient(clientId))) {
    return NextResponse.json(
      { ok: false, error: 'PLAN_LIMIT', message: 'Dine-in ordering is not enabled for this restaurant. Please ask staff to take your order at the counter.' },
      { status: 403 }
    );
  }
  if (!table || !table.is_active) {
    return NextResponse.json({ ok: false, error: 'Table not found or deactivated' }, { status: 404 });
  }
  if (!session || session.client_id !== clientId || session.table_number !== tableNumber) {
    return NextResponse.json({ ok: false, error: 'Session does not match this table' }, { status: 400 });
  }
  if (session.status !== 'open') {
    return NextResponse.json({ ok: false, error: 'Session expired. Scan the QR at your table again.' }, { status: 410 });
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

  const customerPhone = session.customer_phones[0] || '';
  if (!customerPhone) {
    return NextResponse.json({ ok: false, error: 'Session has no customer phone — please re-scan QR.' }, { status: 400 });
  }

  const order = await createOrder({
    client_id: clientId,
    session_id: sessionId,
    table_number: tableNumber,
    customer_phone: customerPhone,
    customer_name: String(body.customerName || '').trim(),
    order_type: 'dine_in',
    items: cleanItems,
    special_notes: String(body.notes || '').trim(),
  });

  if (client.phone_number_id) {
    const confirmation = buildOrderConfirmation({
      businessName: client.business_name,
      tableNumber,
      items: cleanItems,
      total: order.total,
    });
    for (const phone of session.customer_phones) {
      try {
        await sendWhatsAppMessage(client.phone_number_id, phone, confirmation);
      } catch (err) {
        console.error('[dine-in submit] WA confirmation failed', { phone, err });
      }
    }
  }

  // Email the owner so they have a permanent record + a one-click CTA
  // into /client/restaurant/orders. Best-effort.
  await notifyOwnerOfNewOrder(client, order, 'qr_dine_in');

  return NextResponse.json({ ok: true, orderId: order.id, total: order.total });
}
