// tests/grocery/substitutions.test.ts
import { describe, it, expect } from 'vitest';
import { pickSubstituteFromGroup } from '../../lib/grocery/substitutions';
import type { CatalogEntry, SubstitutionGroup } from '../../lib/grocery/types';

const entry = (id: string, in_stock: boolean): CatalogEntry => ({
  product: { id, client_id: 'c', name: id, name_aliases: [], unit: 'kg', image_url: null, created_at: '' },
  price_per_unit: 30,
  in_stock,
  stock_qty: null,
});

describe('pickSubstituteFromGroup (pure)', () => {
  it('returns first in-stock alternate (excluding the requested product)', () => {
    const group: SubstitutionGroup = {
      id: 'g',
      client_id: 'c',
      name: 'leafy',
      product_ids: ['palak', 'methi', 'sarson'],
    };
    const catalog = [entry('palak', false), entry('methi', false), entry('sarson', true)];
    const sub = pickSubstituteFromGroup('palak', group, catalog);
    expect(sub?.product.id).toBe('sarson');
  });

  it('returns null when no alternate is in stock', () => {
    const group: SubstitutionGroup = {
      id: 'g',
      client_id: 'c',
      name: 'leafy',
      product_ids: ['palak', 'methi'],
    };
    const catalog = [entry('palak', false), entry('methi', false)];
    expect(pickSubstituteFromGroup('palak', group, catalog)).toBeNull();
  });

  it('skips alternates not on today catalog', () => {
    const group: SubstitutionGroup = {
      id: 'g',
      client_id: 'c',
      name: 'leafy',
      product_ids: ['palak', 'methi', 'unknown'],
    };
    const catalog = [entry('palak', false), entry('methi', true)];
    const sub = pickSubstituteFromGroup('palak', group, catalog);
    expect(sub?.product.id).toBe('methi');
  });
});
