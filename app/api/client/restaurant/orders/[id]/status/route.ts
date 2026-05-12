// POST /api/client/restaurant/orders/[id]/status
// Body: { status: 'preparing' | 'served' | 'cancelled' }
//
// Manager-triggered order status update. Verifies ownership, writes the
// new status, and sends a bilingual WhatsApp ping to the customer who
// placed the order. Cancellation messages are explicit so the customer
// knows it came from the restaurant.

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireClientWithBots } from '@/lib/auth';
import { db } from '@/lib/db';
import { dine_in_orders } from '@/lib/db/schema';
import { updateOrderStatus, type DineInOrderStatus } from '@/lib/db/restaurant-dine-in';
import { getClientById } from '@/lib/db/clients';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

const ALLOWED_STATUS: Record<string, true> = { preparing: true, served: true, cancelled: true };

function bilingualPing(status: DineInOrderStatus, businessName: string, tableNumber: string): string {
  switch (status) {
    case 'preparing':
      return [
        `${businessName} — Table ${tableNumber}`,
        `Your order is being prepared 👨‍🍳`,
        ``,
        `Aapka order bana raha hai 👨‍🍳`,
      ].join('\n');
    case 'served':
      return [
        `${businessName} — Table ${tableNumber}`,
        `Your order has been served 🍽️ Enjoy!`,
        ``,
        `Aapka order serve kar diya hai 🍽️ Enjoy karein!`,
      ].join('\n');
    case 'cancelled':
      return [
        `${businessName} — Table ${tableNumber}`,
        `Your order has been cancelled. Please speak to the staff if this was unexpected.`,
        ``,
        `Aapka order cancel ho gaya hai. Agar yeh galti se hua hai, staff se baat kariye.`,
      ].join('\n');
    default:
      return '';
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireClientWithBots().catch(() => null);
  if (!user || !user.activeBot || user.activeBot.type !== 'restaurant') {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: { status?: string };
  try {
    body = (await request.json()) as { status?: string };
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { id: orderId } = await params;
  const next = String(body.status || '').toLowerCase().trim();
  if (!ALLOWED_STATUS[next]) {
    return NextResponse.json({ ok: false, error: `Status must be one of: ${Object.keys(ALLOWED_STATUS).join(', ')}` }, { status: 400 });
  }

  const rows = await db.select().from(dine_in_orders).where(eq(dine_in_orders.id, orderId)).limit(1);
  const order = rows[0];
  if (!order) return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });
  if (order.client_id !== user.activeBot.client_id) {
    return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });
  }

  await updateOrderStatus(orderId, next as DineInOrderStatus);

  try {
    const client = await getClientById(user.activeBot.client_id);
    if (client?.phone_number_id) {
      const ping = bilingualPing(next as DineInOrderStatus, client.business_name, order.table_number || '');
      if (ping) {
        await sendWhatsAppMessage(client.phone_number_id, order.customer_phone, ping);
      }
    }
  } catch (err) {
    console.error('[order-status] customer ping failed', { orderId, err });
  }

  return NextResponse.json({ ok: true });
}
