// lib/grocery/orders.ts
//
// Sole writer to grocery_orders (other than admin status updates).
// Validates the draft is complete, computes totals via pricing.ts,
// inserts the row, clears the draft, and triggers owner notification.

import { createOrder } from '../db/grocery-orders';
import { getZone } from '../db/grocery-zones';
import { computeOrderTotals, meetsMinOrder } from './pricing';
import { clearDraft } from './cart-draft';
import type { CartDraft, GroceryOrder } from './types';

export type PlaceOrderErrorDetail = { shortfall?: number; min_order?: number | null };

export class PlaceOrderError extends Error {
  constructor(public code: string, message: string, public detail?: PlaceOrderErrorDetail) {
    super(message);
  }
}

export async function placeOrder(draft: CartDraft): Promise<GroceryOrder> {
  if (draft.items.length === 0)
    throw new PlaceOrderError('EMPTY_CART', 'No items in cart');
  if (!draft.zone_id) throw new PlaceOrderError('NO_ZONE', 'No delivery zone set');
  if (!draft.slot_id || !draft.slot_date)
    throw new PlaceOrderError('NO_SLOT', 'No delivery slot set');
  if (!draft.delivery_address)
    throw new PlaceOrderError('NO_ADDRESS', 'No address set');

  const zone = await getZone(draft.zone_id);
  if (!zone) throw new PlaceOrderError('ZONE_GONE', 'Zone no longer exists');

  const min = meetsMinOrder(draft.items, zone);
  if (!min.ok) {
    throw new PlaceOrderError('BELOW_MIN', `Below min order by ₹${min.shortfall}`, {
      shortfall: min.shortfall,
      min_order: zone.min_order,
    });
  }

  const totals = computeOrderTotals(draft.items, zone);

  const order = await createOrder({
    client_id: draft.client_id,
    customer_phone: draft.customer_phone,
    customer_name: draft.customer_name,
    delivery_address: draft.delivery_address,
    zone_id: draft.zone_id,
    slot_id: draft.slot_id,
    slot_date: draft.slot_date,
    items: draft.items,
    subtotal: totals.subtotal,
    delivery_fee: totals.delivery_fee,
    total: totals.total,
    payment_mode: 'cod',
  });

  await clearDraft(draft.client_id, draft.customer_phone);
  return order;
}
