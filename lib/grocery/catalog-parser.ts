// lib/grocery/catalog-parser.ts
//
// Parses owner's catalog update messages into structured ParsedCatalogItem[].
// Two entry points:
//   - parseCatalogText(text)  — for typed messages
//   - parseCatalogVoice(audioBase64, mimeType) — Whisper → text → parseCatalogText
//
// The actual extraction is delegated to Groq llama-3.3-70b in JSON mode.
// We pin the schema in the system prompt and post-validate the JSON to
// guard against the model returning loose units or string prices.

import { chatJSON, transcribeVoice } from './groq';
import type { ParsedCatalogItem, GroceryUnit } from './types';

const VALID_UNITS: GroceryUnit[] = ['kg', 'g', 'piece', 'dozen', 'bunch'];

const SYSTEM_PROMPT = `You are an extraction tool for a vegetable/grocery seller's daily price list.
The seller writes in Hindi, English, or Hinglish (e.g. "tamatar 30 pyaaz 40 aloo out").

Extract each item as JSON. Output exactly:
{ "items": [{ "name": "<canonical lowercase name>", "price": <number>, "unit": "kg|g|piece|dozen|bunch", "in_stock": <true|false> }, ...] }

Rules:
- "out", "khatam", "nahi hai", "0" → in_stock=false, price=0
- If price is missing for an in-stock item, skip it.
- Default unit = "kg" unless seller writes piece/dozen/bunch/g.
- Translate Hindi names to canonical romanized lowercase: tamatar, pyaaz, aloo, gobhi, palak, methi, lauki, baingan, bhindi, mirch, dhaniya, adrak, lehsun, nimbu, hari mirch, gajar, mooli, kaddu, capsicum, etc.
- Output JSON only. No prose.`;

function coercePrice(p: unknown): number {
  if (typeof p === 'number') return p;
  if (typeof p === 'string') {
    const n = parseFloat(p);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function coerceUnit(u: unknown): GroceryUnit {
  if (typeof u === 'string' && (VALID_UNITS as string[]).includes(u)) {
    return u as GroceryUnit;
  }
  return 'kg';
}

function validateItem(raw: any): ParsedCatalogItem | null {
  if (!raw || typeof raw.name !== 'string') return null;
  const name = raw.name.trim().toLowerCase();
  if (!name) return null;
  return {
    name,
    price: coercePrice(raw.price),
    unit: coerceUnit(raw.unit),
    in_stock: raw.in_stock !== false,
  };
}

export async function parseCatalogText(text: string): Promise<ParsedCatalogItem[]> {
  if (!text.trim()) throw new Error('parseCatalogText: empty input');

  const result = await chatJSON<{ items: any[] }>(SYSTEM_PROMPT, text);
  const items: ParsedCatalogItem[] = [];
  for (const raw of result.items ?? []) {
    const v = validateItem(raw);
    if (v) items.push(v);
  }
  if (items.length === 0) {
    throw new Error('parseCatalogText: no items extracted from input');
  }
  return items;
}

export async function parseCatalogVoice(
  audioBase64: string,
  mimeType: string
): Promise<ParsedCatalogItem[]> {
  const transcript = await transcribeVoice(audioBase64, mimeType);
  if (!transcript.trim()) throw new Error('parseCatalogVoice: empty transcript');
  return parseCatalogText(transcript);
}
