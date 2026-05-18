// Owner notifications for a freshly-placed restaurant order. Two
// channels here:
//
//   notifyOwnerOfNewOrder(...)    — email (permanent record + dashboard CTA)
//   notifyOwnerOnWhatsApp(...)    — WhatsApp ping (live "naya order!" alert)
//
// Both are called from all three order entry points after createOrder()
// succeeds:
//   1. /api/menu/submit         (web menu link)
//   2. /api/dine-in/submit      (QR-scan dine-in)
//   3. webhook [ORDER:] handler (typed/voice WhatsApp order — webhook
//      already calls sendWhatsAppMessage inline, so it doesn't call the
//      WhatsApp helper here)
//
// Best-effort: both helpers log but never throw. Failure to send must
// never roll back the order — the row is already in dine_in_orders and
// the customer has been WhatsApp'd. Email is the owner's permanent
// record; WhatsApp is the live alert.

import { clerkClient } from '@clerk/nextjs/server';
import { sendTemplate, tplNewOrder } from '@/lib/email';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
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

// Live WhatsApp ping to the owner the moment a new menu-link or QR
// dine-in order lands. Previously this was webhook-only — orders
// arriving via the storefront /m page went only to email + dashboard
// and the owner had no "phone in pocket" alert. After 2026-05-18 the
// menu_link and qr_dine_in paths call this too.
//
// Owner destination resolution mirrors webhook/route.ts: prefer
// `contact_number` (owner's personal phone, set in /client/settings →
// "Owner WhatsApp number"); fall back to `whatsapp_number` only for
// single-number demo setups where the owner's phone IS the bot's
// WABA number. If those collide (the bot would try to message itself
// → Meta #100 Invalid Parameter), we skip the WhatsApp ping silently
// and let the dashboard + email do the alerting.
//
// Approve/decline-via-WhatsApp-reply is intentionally NOT wired here
// yet — the webhook's loose-match approve handler operates on the
// `bookings` table, while menu-link orders live in `dine_in_orders`.
// Owner taps Approve in the dashboard for now. Extending the loose
// approve to also cover dine_in_orders is a separate work item.
export async function notifyOwnerOnWhatsApp(
  client: Pick<ClientRow,
    | 'phone_number_id'
    | 'contact_number'
    | 'whatsapp_number'
    | 'notify_whatsapp'
    | 'business_name'
  >,
  order: Pick<DineInOrder,
    | 'id'
    | 'order_type'
    | 'customer_phone'
    | 'customer_name'
    | 'table_number'
    | 'delivery_address'
    | 'special_notes'
    | 'items'
    | 'total'
    | 'status'
  >,
  source: NewOrderSource,
): Promise<void> {
  if (!client.phone_number_id) return;
  if (client.notify_whatsapp === false) return;

  const ownerPersonal = (client.contact_number || '').replace(/\D/g, '');
  const botNumber = (client.whatsapp_number || '').replace(/\D/g, '');
  const ownerTo = ownerPersonal.length >= 10 ? ownerPersonal : botNumber;
  if (!ownerTo) return;
  // Meta refuses send-to-self with #100 Invalid Parameter. Silent skip;
  // the owner sees the order in the dashboard either way.
  if (ownerTo === botNumber) return;

  const needsApproval = order.status === 'pending_approval';
  const itemCount = order.items.reduce((s, it) => s + it.qty, 0);
  const itemsList = order.items.map((i) => `  • ${i.qty}× ${i.name}`).join('\n');
  const modeLabel: Record<DineInOrderType, string> = {
    dine_in: 'dine-in',
    home_delivery: 'delivery',
    parcel_takeaway: 'takeaway',
  };
  const sourceLabel: Record<NewOrderSource, string> = {
    menu_link: 'via menu link',
    qr_dine_in: 'via QR scan',
    whatsapp_chat: 'via WhatsApp',
  };
  const headline = needsApproval ? '🔔 Order needs approval' : '🛍️ New Order';
  const lines: string[] = [
    `${headline} — ${sourceLabel[source] ?? ''}`,
    '',
    `📞 ${order.customer_phone}${order.customer_name ? ` (${order.customer_name})` : ''}`,
    `💰 ₹${Number(order.total).toFixed(0)} · ${itemCount} item${itemCount === 1 ? '' : 's'} · ${modeLabel[order.order_type] ?? order.order_type}`,
    '',
    itemsList,
  ];
  if (order.delivery_address) lines.push('', `📍 ${order.delivery_address}`);
  if (order.table_number) lines.push('', `🪑 Table ${order.table_number}`);
  if (order.special_notes) lines.push('', `📝 ${order.special_notes}`);
  if (needsApproval) {
    lines.push(
      '',
      '--- Action needed ---',
      'Tap Approve or Decline on your dashboard:',
      '/client/restaurant/orders'
    );
  } else {
    lines.push('', 'See all orders: /client/restaurant/orders');
  }

  const body = lines.join('\n');
  try {
    await sendWhatsAppMessage(client.phone_number_id, ownerTo, body);
  } catch (err) {
    console.error('[notify-order] owner WhatsApp ping failed', { orderId: order.id, err });
  }
}
