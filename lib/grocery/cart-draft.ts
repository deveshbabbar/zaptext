// lib/grocery/cart-draft.ts
//
// Wraps the cart-drafts DB layer with helpers for the customer-flow
// state machine. The webhook handler reads/writes the draft on every
// incoming message; expiry (30 min) is enforced inside the DB layer.

import { getDraft, saveDraft, deleteDraft } from '../db/grocery-cart-drafts';
import type { CartDraft, CartItem } from './types';

export async function loadDraft(
  client_id: string,
  customer_phone: string
): Promise<CartDraft> {
  const existing = await getDraft(client_id, customer_phone);
  if (existing) return existing;
  return {
    client_id,
    customer_phone,
    items: [],
    zone_id: null,
    slot_id: null,
    slot_date: null,
    delivery_address: null,
    customer_name: null,
    expires_at: '',
  };
}

export async function setItems(draft: CartDraft, items: CartItem[]): Promise<void> {
  draft.items = items;
  await saveDraft(draft);
}

export async function appendItems(draft: CartDraft, items: CartItem[]): Promise<void> {
  // Merge by product_id: same product → sum qty + recompute line_total.
  const map = new Map<string, CartItem>();
  for (const it of [...draft.items, ...items]) {
    const cur = map.get(it.product_id);
    if (cur) {
      cur.qty = round2(cur.qty + it.qty);
      cur.line_total = round2(cur.qty * cur.price_per_unit);
    } else {
      map.set(it.product_id, { ...it });
    }
  }
  draft.items = Array.from(map.values());
  await saveDraft(draft);
}

export async function setAddress(
  draft: CartDraft,
  delivery_address: string,
  zone_id: string
): Promise<void> {
  draft.delivery_address = delivery_address;
  draft.zone_id = zone_id;
  await saveDraft(draft);
}

export async function setSlot(draft: CartDraft, slot_id: string, slot_date: string): Promise<void> {
  draft.slot_id = slot_id;
  draft.slot_date = slot_date;
  await saveDraft(draft);
}

export async function clearDraft(client_id: string, customer_phone: string): Promise<void> {
  await deleteDraft(client_id, customer_phone);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
