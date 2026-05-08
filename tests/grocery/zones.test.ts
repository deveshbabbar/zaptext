// tests/grocery/zones.test.ts
import { describe, it, expect } from 'vitest';
import { matchZone } from '../../lib/grocery/zones';
import type { GroceryZone } from '../../lib/grocery/types';

const z = (over: Partial<GroceryZone>): GroceryZone => ({
  id: 'z1',
  client_id: 'c',
  label: 'Sector 21',
  pincode: null,
  area_keywords: [],
  delivery_fee: 20,
  min_order_for_free_delivery: null,
  min_order: null,
  ...over,
});

describe('matchZone', () => {
  it('matches by pin code in address', () => {
    const zones = [z({ pincode: '110021' })];
    const result = matchZone('House 45, Sector 21, New Delhi 110021', zones);
    expect(result?.id).toBe('z1');
  });

  it('matches by area keyword (case-insensitive)', () => {
    const zones = [z({ area_keywords: ['sector 21', 'model town'] })];
    const result = matchZone('House 45 SECTOR 21 New Delhi', zones);
    expect(result?.id).toBe('z1');
  });

  it('returns null when no match', () => {
    const zones = [z({ pincode: '110021', area_keywords: ['sector 21'] })];
    const result = matchZone('House 45, Sector 5', zones);
    expect(result).toBeNull();
  });

  it('prefers pin code match over keyword match if both are present', () => {
    const zones = [
      z({ id: 'z-key', label: 'A', area_keywords: ['common'] }),
      z({ id: 'z-pin', label: 'B', pincode: '110021' }),
    ];
    const result = matchZone('common text 110021', zones);
    expect(result?.id).toBe('z-pin');
  });

  it('returns null on empty address', () => {
    expect(matchZone('', [z({ pincode: '110021' })])).toBeNull();
    expect(matchZone('   ', [z({ pincode: '110021' })])).toBeNull();
  });
});
