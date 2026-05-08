// tests/grocery/pricing.test.ts
import { describe, it, expect } from 'vitest';
import { computeOrderTotals } from '../../lib/grocery/pricing';
import type { CartItem, GroceryZone } from '../../lib/grocery/types';

const item = (over: Partial<CartItem>): CartItem => ({
  product_id: 'p',
  name: 'tamatar',
  qty: 1,
  unit: 'kg',
  price_per_unit: 30,
  line_total: 30,
  ...over,
});

const zone = (over: Partial<GroceryZone>): GroceryZone => ({
  id: 'z',
  client_id: 'c',
  label: 'X',
  pincode: null,
  area_keywords: [],
  delivery_fee: 20,
  min_order_for_free_delivery: null,
  min_order: null,
  ...over,
});

describe('computeOrderTotals', () => {
  it('sums line totals into subtotal, adds delivery fee', () => {
    const r = computeOrderTotals(
      [item({ line_total: 30 }), item({ line_total: 50 })],
      zone({ delivery_fee: 20 })
    );
    expect(r.subtotal).toBe(80);
    expect(r.delivery_fee).toBe(20);
    expect(r.total).toBe(100);
    expect(r.free_delivery_applied).toBe(false);
  });

  it('waives delivery fee at free-delivery threshold', () => {
    const r = computeOrderTotals(
      [item({ line_total: 350 })],
      zone({ delivery_fee: 20, min_order_for_free_delivery: 300 })
    );
    expect(r.delivery_fee).toBe(0);
    expect(r.total).toBe(350);
    expect(r.free_delivery_applied).toBe(true);
  });

  it('does NOT waive delivery when subtotal exactly below threshold', () => {
    const r = computeOrderTotals(
      [item({ line_total: 299 })],
      zone({ delivery_fee: 20, min_order_for_free_delivery: 300 })
    );
    expect(r.delivery_fee).toBe(20);
    expect(r.free_delivery_applied).toBe(false);
  });

  it('rounds money to 2 decimals', () => {
    const r = computeOrderTotals(
      [item({ qty: 0.333, price_per_unit: 30, line_total: 9.99 })],
      zone({ delivery_fee: 20 })
    );
    expect(r.subtotal).toBe(9.99);
    expect(r.total).toBe(29.99);
  });

  it('zero items → zero subtotal but still adds delivery fee', () => {
    const r = computeOrderTotals([], zone({ delivery_fee: 20 }));
    expect(r.subtotal).toBe(0);
    expect(r.total).toBe(20);
  });
});
