// tests/grocery/cart-parser.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseCartText, resolveCartItems } from '../../lib/grocery/cart-parser';
import * as groq from '../../lib/grocery/groq';
import type { CatalogEntry } from '../../lib/grocery/types';

describe('parseCartText (LLM mocked)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('parses Hinglish list with units', async () => {
    vi.spyOn(groq, 'chatJSON').mockResolvedValue({
      items: [
        { name: 'tamatar', qty: 1, unit: 'kg' },
        { name: 'pyaaz', qty: 0.5, unit: 'kg' },
        { name: 'aloo', qty: 2, unit: 'kg' },
      ],
    });
    const out = await parseCartText('tamatar 1kg pyaaz 500g aloo 2kg');
    expect(out).toHaveLength(3);
    expect(out[1].qty).toBe(0.5);
  });

  it('coerces qty strings to numbers', async () => {
    vi.spyOn(groq, 'chatJSON').mockResolvedValue({
      items: [{ name: 'tamatar', qty: '1', unit: 'kg' }],
    });
    const out = await parseCartText('1kg tamatar');
    expect(typeof out[0].qty).toBe('number');
  });

  it('skips items with non-positive qty', async () => {
    vi.spyOn(groq, 'chatJSON').mockResolvedValue({
      items: [
        { name: 'tamatar', qty: 1, unit: 'kg' },
        { name: 'foo', qty: 0, unit: 'kg' },
      ],
    });
    const out = await parseCartText('tamatar 1kg');
    expect(out).toHaveLength(1);
  });
});

describe('resolveCartItems', () => {
  const catalog: CatalogEntry[] = [
    {
      product: {
        id: 'p1',
        client_id: 'c',
        name: 'tamatar',
        name_aliases: ['tomato'],
        unit: 'kg',
        image_url: null,
        created_at: '',
      },
      price_per_unit: 30,
      in_stock: true,
      stock_qty: null,
    },
    {
      product: {
        id: 'p2',
        client_id: 'c',
        name: 'pyaaz',
        name_aliases: [],
        unit: 'kg',
        image_url: null,
        created_at: '',
      },
      price_per_unit: 40,
      in_stock: true,
      stock_qty: null,
    },
  ];

  it('matches by exact name and computes line totals', () => {
    const r = resolveCartItems(
      [
        { name: 'tamatar', qty: 1, unit: 'kg' },
        { name: 'pyaaz', qty: 0.5, unit: 'kg' },
      ],
      catalog
    );
    expect(r.matched).toHaveLength(2);
    expect(r.matched[0].line_total).toBe(30);
    expect(r.matched[1].line_total).toBe(20);
  });

  it('matches by alias', () => {
    const r = resolveCartItems([{ name: 'tomato', qty: 2, unit: 'kg' }], catalog);
    expect(r.matched[0].product_id).toBe('p1');
  });

  it('puts unknown items into unmatched', () => {
    const r = resolveCartItems([{ name: 'banana', qty: 1, unit: 'kg' }], catalog);
    expect(r.matched).toHaveLength(0);
    expect(r.unmatched).toEqual(['banana']);
  });
});
