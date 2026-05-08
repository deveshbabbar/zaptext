// lib/grocery/cart-parser.ts
//
// Two functions:
//   parseCartText(text)          — Groq-backed: free-text → ParsedCartItem[]
//   resolveCartItems(parsed, ..) — Pure: maps parsed items against today's catalog
//
// resolveCartItems is the unit-testable core. parseCartText delegates the
// linguistic parsing to Groq llama-3.3-70b in JSON mode and is mocked in tests.

import { chatJSON } from './groq';
import type { CartItem, CatalogEntry, GroceryUnit, ParsedCartItem } from './types';

const VALID_UNITS: GroceryUnit[] = ['kg', 'g', 'piece', 'dozen', 'bunch'];

const SYSTEM_PROMPT = `You are an extraction tool for a customer's grocery order on WhatsApp.
The customer writes in Hindi/English/Hinglish (e.g. "tamatar 1kg pyaaz 500g aloo 2kg").

Output exactly:
{ "items": [{ "name": "<canonical lowercase grocery name>", "qty": <number>, "unit": "kg|g|piece|dozen|bunch" }, ...] }

Rules:
- 500g = 0.5 kg (convert to kg). 250g = 0.25 kg.
- "ek" = 1, "do" = 2, "teen" = 3, "char" = 4, "paanch" = 5, "aadha" = 0.5, "pao" = 0.25.
- "ek dozen" = qty 1 unit "dozen". "1 piece" = qty 1 unit "piece".
- Default unit is "kg" for vegetables and fruits unless stated otherwise.
- Lowercase canonical Hindi-romanized names (tamatar, pyaaz, aloo, gobhi, palak, methi, etc).
- Skip items without quantity. Output JSON only.`;

function coerceQty(q: unknown): number {
  if (typeof q === 'number') return q;
  if (typeof q === 'string') {
    const n = parseFloat(q);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function coerceUnit(u: unknown): GroceryUnit {
  if (typeof u === 'string' && (VALID_UNITS as string[]).includes(u)) return u as GroceryUnit;
  return 'kg';
}

export async function parseCartText(text: string): Promise<ParsedCartItem[]> {
  if (!text.trim()) return [];
  const result = await chatJSON<{ items: any[] }>(SYSTEM_PROMPT, text);
  const out: ParsedCartItem[] = [];
  for (const raw of result.items ?? []) {
    if (!raw?.name) continue;
    const qty = coerceQty(raw.qty);
    if (qty <= 0) continue;
    out.push({
      name: String(raw.name).trim().toLowerCase(),
      qty,
      unit: coerceUnit(raw.unit),
    });
  }
  return out;
}

export interface ResolveResult {
  matched: CartItem[];
  unmatched: string[]; // raw names we couldn't find in today's catalog
  outOfStock: CartItem[]; // matched but in_stock=false
}

export function resolveCartItems(
  parsed: ParsedCartItem[],
  catalog: CatalogEntry[]
): ResolveResult {
  const matched: CartItem[] = [];
  const unmatched: string[] = [];
  const outOfStock: CartItem[] = [];

  for (const p of parsed) {
    const entry = findEntry(p.name, catalog);
    if (!entry) {
      unmatched.push(p.name);
      continue;
    }
    const item: CartItem = {
      product_id: entry.product.id,
      name: entry.product.name,
      qty: p.qty,
      unit: entry.product.unit, // canonical unit, not customer-stated
      price_per_unit: entry.price_per_unit,
      line_total: round2(p.qty * entry.price_per_unit),
    };
    if (!entry.in_stock) {
      outOfStock.push(item);
    } else {
      matched.push(item);
    }
  }

  return { matched, unmatched, outOfStock };
}

function findEntry(rawName: string, catalog: CatalogEntry[]): CatalogEntry | null {
  const n = rawName.trim().toLowerCase();
  const exact = catalog.find((c) => c.product.name === n);
  if (exact) return exact;
  const alias = catalog.find((c) =>
    c.product.name_aliases.some((a) => a.toLowerCase() === n)
  );
  if (alias) return alias;
  if (n.length >= 3) {
    const sub = catalog.find(
      (c) =>
        c.product.name.includes(n) ||
        n.includes(c.product.name) ||
        c.product.name_aliases.some((a) => a.toLowerCase().includes(n))
    );
    if (sub) return sub;
  }
  return null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
