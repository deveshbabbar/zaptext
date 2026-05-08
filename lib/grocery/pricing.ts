// lib/grocery/pricing.ts
import type { CartItem, GroceryZone, OrderTotals } from './types';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeOrderTotals(items: CartItem[], zone: GroceryZone): OrderTotals {
  const subtotal = round2(items.reduce((s, i) => s + i.line_total, 0));
  const free =
    zone.min_order_for_free_delivery != null && subtotal >= zone.min_order_for_free_delivery;
  const delivery_fee = free ? 0 : round2(zone.delivery_fee);
  return {
    subtotal,
    delivery_fee,
    total: round2(subtotal + delivery_fee),
    free_delivery_applied: free,
  };
}

export function meetsMinOrder(
  items: CartItem[],
  zone: GroceryZone
): { ok: boolean; shortfall: number } {
  if (zone.min_order == null) return { ok: true, shortfall: 0 };
  const subtotal = items.reduce((s, i) => s + i.line_total, 0);
  return subtotal >= zone.min_order
    ? { ok: true, shortfall: 0 }
    : { ok: false, shortfall: round2(zone.min_order - subtotal) };
}
