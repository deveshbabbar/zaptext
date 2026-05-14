// Owner email notification for a freshly-placed restaurant order.
//
// Called from all three order entry points after createOrder() succeeds:
//   1. /api/menu/submit         (web menu link)
//   2. /api/dine-in/submit      (QR-scan dine-in)
//   3. webhook [ORDER:] handler (typed/voice WhatsApp order)
//
// Best-effort: logs but never throws. Failure to email must never roll
// back the order — the row is already in dine_in_orders and the customer
// has been WhatsApp'd. Email is the owner's permanent record + actionable
// CTA into /client/restaurant/orders.

import { clerkClient } from '@clerk/nextjs/server';
import { sendTemplate, tplNewOrder } from '@/lib/email';
import type { ClientRow } from '@/lib/types';
import type { DineInOrder, DineInOrderType } from '@/lib/db/restaurant-dine-in';

export type NewOrderSource = 'menu_link' | 'qr_dine_in' | 'whatsapp_chat';

export async function notifyOwnerOfNewOrder(
  client: Pick<ClientRow, 'business_name' | 'owner_user_id'>,
  order: Pick<DineInOrder,
    | 'id' | 'order_type' | 'customer_phone' | 'customer_name'
    | 'table_number' | 'delivery_address' | 'special_notes'
    | 'items' | 'total'>,
  source: NewOrderSource,
): Promise<void> {
  if (!client.owner_user_id) return;
  try {
    const cc = await clerkClient();
    const owner = await cc.users.getUser(client.owner_user_id);
    const ownerEmail = owner.emailAddresses[0]?.emailAddress;
    if (!ownerEmail) return;
    const ownerName = `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || 'there';
    await sendTemplate(
      ownerEmail,
      tplNewOrder({
        ownerName,
        businessName: client.business_name,
        orderId: order.id,
        mode: (order.order_type as DineInOrderType) || 'dine_in',
        customerName: order.customer_name || '',
        customerPhone: order.customer_phone,
        tableNumber: order.table_number || undefined,
        deliveryAddress: order.delivery_address || undefined,
        notes: order.special_notes || undefined,
        items: order.items,
        total: order.total,
        source,
      }),
      ownerName,
    );
  } catch (err) {
    console.error('[notify-order] owner email failed', { orderId: order.id, err });
  }
}
