// lib/grocery/zones.ts
//
// Pure: given an address string and a list of zones for the client,
// return the matching zone (pin-code preferred over keyword), or null.

import type { GroceryZone } from './types';

const PINCODE_RE = /\b(\d{6})\b/g;

export function matchZone(address: string, zones: GroceryZone[]): GroceryZone | null {
  const a = address.trim().toLowerCase();
  if (!a || zones.length === 0) return null;

  // Pin-code match first.
  const pins = Array.from(a.matchAll(PINCODE_RE)).map((m) => m[1]);
  if (pins.length > 0) {
    for (const pin of pins) {
      const z = zones.find((z) => z.pincode && z.pincode === pin);
      if (z) return z;
    }
  }

  // Keyword match.
  for (const z of zones) {
    for (const kw of z.area_keywords) {
      const k = kw.trim().toLowerCase();
      if (k.length >= 2 && a.includes(k)) return z;
    }
  }

  return null;
}
