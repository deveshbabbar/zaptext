import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseCatalogText } from '../../lib/grocery/catalog-parser';
import * as groq from '../../lib/grocery/groq';

describe('parseCatalogText', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('parses simple Hinglish list', async () => {
    vi.spyOn(groq, 'chatJSON').mockResolvedValue({
      items: [
        { name: 'tamatar', price: 30, unit: 'kg', in_stock: true },
        { name: 'pyaaz', price: 40, unit: 'kg', in_stock: true },
        { name: 'aloo', price: 25, unit: 'kg', in_stock: true },
      ],
    });

    const result = await parseCatalogText('tamatar 30 pyaaz 40 aloo 25');

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      name: 'tamatar',
      price: 30,
      unit: 'kg',
      in_stock: true,
    });
  });

  it('marks "out" / "khatam" items as out-of-stock', async () => {
    vi.spyOn(groq, 'chatJSON').mockResolvedValue({
      items: [
        { name: 'tamatar', price: 30, unit: 'kg', in_stock: true },
        { name: 'gobhi', price: 0, unit: 'kg', in_stock: false },
      ],
    });

    const result = await parseCatalogText('tamatar 30 gobhi out');
    const gobhi = result.find((r) => r.name === 'gobhi');
    expect(gobhi?.in_stock).toBe(false);
  });

  it('throws on empty Groq response', async () => {
    vi.spyOn(groq, 'chatJSON').mockResolvedValue({ items: [] });
    await expect(parseCatalogText('blah blah')).rejects.toThrow(/no items/i);
  });

  it('coerces price strings to numbers', async () => {
    vi.spyOn(groq, 'chatJSON').mockResolvedValue({
      items: [{ name: 'tamatar', price: '30', unit: 'kg', in_stock: true }],
    });

    const result = await parseCatalogText('tamatar 30');
    expect(typeof result[0].price).toBe('number');
    expect(result[0].price).toBe(30);
  });

  it('rejects unknown unit (defaults to kg)', async () => {
    vi.spyOn(groq, 'chatJSON').mockResolvedValue({
      items: [{ name: 'tamatar', price: 30, unit: 'foo' as any, in_stock: true }],
    });

    const result = await parseCatalogText('tamatar 30 foo');
    expect(result[0].unit).toBe('kg');
  });
});
