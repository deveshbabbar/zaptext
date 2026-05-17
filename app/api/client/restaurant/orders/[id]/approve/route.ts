// POST /api/client/restaurant/orders/[id]/approve
// Body: {} (no payload required)
//
// Flips a pending_approval dine-in order to 'placed' and pings the
// customer that their order is now confirmed. Mirrors what the
// WhatsApp 'approve <booking_id>' command does, but for owners who'd
// rather click than type.
//
// 403 if the order isn't owned by this client. 409 if the order
// isn't actually in pending_approval status (idempotent guard).

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireClientWithBots } from '@/lib/auth';
import { db } from '@/lib/db';
import { dine_in_orders } from '@/lib/db/schema';
import { updateOrderStatus } from '@/lib/db/restaurant-dine-in';
import { getClientById } from '@/lib/db/clients';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireClientWithBots().catch(() => null);
  if (!user || !user.activeBot || user.activeBot.type !== 'restaurant') {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id: orderId } = await params;
  const rows = await db.select().from(dine_in_orders).where(eq(dine_in_orders.id, orderId)).limit(1);
  const order = rows[0];
  if (!order) return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });
  if (order.client_id !== user.activeBot.client_id) {
    return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });
  }
  if (order.status !== 'pending_approval') {
    return NextResponse.json(
      { ok: false, error: `Order is already ${order.status} — nothing to approve.` },
      { status: 409 },
    );
  }

  await updateOrderStatus(orderId, 'placed');

  try {
    const client = await getClientById(user.activeBot.client_id);
    if (client?.phone_number_id) {
      // Single-language confirmation. Default to English; switch to Hindi/
      // Hinglish based on client's default_language so a Hindi-first
      // restaurant doesn't get an English-only confirmation.
      const lang = client.default_language === 'hindi' || client.default_language === 'hinglish'
        ? client.default_language
        : 'english';
      const msg = lang === 'hindi' || lang === 'hinglish'
        ? `Aapka order ${client.business_name} ne approve kar diya hai! 🎉 Jaldi taiyaar hoga.`
        : `Your order has been confirmed by ${client.business_name}! 🎉 We'll have it ready shortly.`;
      await sendWhatsAppMessage(client.phone_number_id, order.customer_phone, msg);
    }
  } catch (err) {
    console.error('[order-approve] customer ping failed', { orderId, err });
  }

  return NextResponse.json({ ok: true });
}
