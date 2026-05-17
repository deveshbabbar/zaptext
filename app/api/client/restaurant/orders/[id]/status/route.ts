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

// Single-language status ping. The bot used to send English + Hindi
// concatenated, which felt spammy to customers who'd been talking in
// only one language. We now pick the line by the client's
// `default_language` setting (set in /client/settings → Default language).
function statusPing(
  status: DineInOrderStatus,
  orderType: DineInOrderType,
  businessName: string,
  tableNumber: string,
  lang: 'english' | 'hindi' | 'hinglish',
): string {
  // Header line varies by order type so the customer always knows the context.
  const header =
    orderType === 'dine_in'      ? `${businessName} — Table ${tableNumber || '?'}`
    : orderType === 'home_delivery' ? `${businessName} — Delivery`
    : `${businessName} — Takeaway`;
  const en: Record<string, string> = {
    preparing: `Your order is being prepared 👨‍🍳`,
    ready_delivery: `Your order is packed and ready — assigning a rider now 📦`,
    ready_takeaway: `Your order is ready for pickup 🛍️ Please come collect.`,
    ready_dinein: `Your order is ready, being served now 🍽️`,
    served: `Your order has been served 🍽️ Enjoy!`,
    out_for_delivery: `Your order is out for delivery 🛵 Should reach in 15-25 min.`,
    delivered: `Your order is delivered ✅ Enjoy! Reply with how it was — we read every message.`,
    picked_up: `Picked up — thanks for visiting ✅ Hope you enjoy!`,
    cancelled: `Your order has been cancelled. Please contact us if this was unexpected.`,
  };
  const hi: Record<string, string> = {
    preparing: `Aapka order ban raha hai 👨‍🍳`,
    ready_delivery: `Aapka order pack ho gaya — rider assign ho raha hai 📦`,
    ready_takeaway: `Aapka order pickup ke liye ready hai 🛍️ Please aa kar le jaayein.`,
    ready_dinein: `Aapka order ready hai, serve ho raha hai 🍽️`,
    served: `Aapka order serve kar diya hai 🍽️ Enjoy karein!`,
    out_for_delivery: `Aapka order delivery ke liye nikal gaya 🛵 15-25 min mein pohonch jayega.`,
    delivered: `Aapka order deliver ho gaya ✅ Enjoy karein! Feedback de dijiye chote se reply mein.`,
    picked_up: `Pickup ho gaya — thanks for visiting ✅ Enjoy karein!`,
    cancelled: `Aapka order cancel ho gaya hai. Agar galti se hua, hum se baat kariye.`,
  };
  const table = lang === 'english' ? en : hi;
  const readyKey = orderType === 'home_delivery'
    ? 'ready_delivery'
    : orderType === 'parcel_takeaway'
      ? 'ready_takeaway'
      : 'ready_dinein';
  const line = (() => {
    switch (status) {
      case 'preparing': return table.preparing;
      case 'ready': return table[readyKey];
      case 'served': return table.served;
      case 'out_for_delivery': return table.out_for_delivery;
      case 'delivered': return table.delivered;
      case 'picked_up': return table.picked_up;
      case 'cancelled': return table.cancelled;
      default: return '';
    }
  })();
  if (!line) return '';
  return [header, line].join('\n');
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
      const lang = client.default_language === 'hindi' || client.default_language === 'hinglish'
        ? client.default_language
        : 'english';
      const ping = statusPing(
        next as DineInOrderStatus,
        (order.order_type as DineInOrderType) || 'dine_in',
        client.business_name,
        order.table_number || '',
        lang,
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
