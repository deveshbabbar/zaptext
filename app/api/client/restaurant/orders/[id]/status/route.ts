// POST /api/client/restaurant/orders/[id]/status
// Body: { status: 'preparing' | 'ready' | 'served' | 'out_for_delivery' | 'delivered' | 'picked_up' | 'cancelled' }
//
// Manager-triggered order status update. Verifies ownership, writes the
// new status, and sends a per-order-type bilingual WhatsApp ping to the
// customer. Status options + messaging vary by order_type:
//   dine_in:         preparing → ready → served       (or cancelled)
//   home_delivery:   preparing → ready → out_for_delivery → delivered
//   parcel_takeaway: preparing → ready → picked_up
// All admin status buttons in /client/restaurant/orders POST here.

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireClientWithBots } from '@/lib/auth';
import { db } from '@/lib/db';
import { dine_in_orders } from '@/lib/db/schema';
import { updateOrderStatus, type DineInOrderStatus, type DineInOrderType } from '@/lib/db/restaurant-dine-in';
import { getClientById } from '@/lib/db/clients';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

const ALLOWED_STATUS: Record<string, true> = {
  preparing: true,
  ready: true,
  served: true,
  out_for_delivery: true,
  delivered: true,
  picked_up: true,
  cancelled: true,
};

function bilingualPing(
  status: DineInOrderStatus,
  orderType: DineInOrderType,
  businessName: string,
  tableNumber: string,
): string {
  // Header line varies by order type so the customer always knows the context.
  const header =
    orderType === 'dine_in'      ? `${businessName} — Table ${tableNumber || '?'}`
    : orderType === 'home_delivery' ? `${businessName} — Delivery`
    : `${businessName} — Takeaway`;
  const lines: [string, string] | null = (() => {
    switch (status) {
      case 'preparing':
        return [`Your order is being prepared 👨‍🍳`, `Aapka order ban raha hai 👨‍🍳`];
      case 'ready':
        return orderType === 'home_delivery'
          ? [`Your order is packed and ready — assigning a rider now 📦`,
             `Aapka order pack ho gaya — rider assign ho raha hai 📦`]
          : orderType === 'parcel_takeaway'
          ? [`Your order is ready for pickup 🛍️ Please come collect.`,
             `Aapka order pickup ke liye ready hai 🛍️ Please aa kar le jaayein.`]
          : [`Your order is ready, being served now 🍽️`,
             `Aapka order ready hai, serve ho raha hai 🍽️`];
      case 'served':
        return [`Your order has been served 🍽️ Enjoy!`, `Aapka order serve kar diya hai 🍽️ Enjoy karein!`];
      case 'out_for_delivery':
        return [`Your order is out for delivery 🛵 Should reach in 15-25 min.`,
                `Aapka order delivery ke liye nikal gaya 🛵 15-25 min mein pohonch jayega.`];
      case 'delivered':
        return [`Your order is delivered ✅ Enjoy! Reply with how it was — we read every message.`,
                `Aapka order deliver ho gaya ✅ Enjoy karein! Feedback de dijiye chote se reply mein.`];
      case 'picked_up':
        return [`Picked up — thanks for visiting ✅ Hope you enjoy!`,
                `Pickup ho gaya — thanks for visiting ✅ Enjoy karein!`];
      case 'cancelled':
        return [`Your order has been cancelled. Please contact us if this was unexpected.`,
                `Aapka order cancel ho gaya hai. Agar galti se hua, hum se baat kariye.`];
      default:
        return null;
    }
  })();
  if (!lines) return '';
  return [header, lines[0], ``, lines[1]].join('\n');
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
      const ping = bilingualPing(
        next as DineInOrderStatus,
        (order.order_type as DineInOrderType) || 'dine_in',
        client.business_name,
        order.table_number || '',
      );
      if (ping) {
        await sendWhatsAppMessage(client.phone_number_id, order.customer_phone, ping);
      }
    }
  } catch (err) {
    console.error('[order-status] customer ping failed', { orderId, err });
  }

  return NextResponse.json({ ok: true });
}
