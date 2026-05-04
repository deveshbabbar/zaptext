// ─── Neon-backed inventory store ───
//
// Drop-in replacement for the DB-touching functions previously exported
// from lib/inventory.ts (the pure utilities — slugify, isItemAvailableNow,
// findBestMatch, etc. — remain there). Same InventoryItem shape so the 9+
// callers across the codebase (webhook, onboard, client routes, inventory
// sync) don't change their imports.
//
// Conversion notes:
// - Composite PK (client_id, sku) lets ON CONFLICT DO UPDATE handle upsert
//   in a single round-trip — much simpler than the legacy Sheets version
//   which did fetch-all + filter + update-or-append.
// - available_days is stored as a comma-separated string in Postgres
//   (matches the existing Sheets layout) so the migration script can copy
//   verbatim. We split/join on the boundary.
// - price is numeric(12,2); Drizzle returns it as string. We parseFloat.
// - Stock is clamped to >= 0 on every write to preserve legacy behavior
//   (the bot logic doesn't handle negative stock).

import { and, eq } from 'drizzle-orm';
import { db } from './index';
import { inventory as inventoryTable } from './schema';
import type { InventoryItem } from '../types';

type DbInventoryRow = typeof inventoryTable.$inferSelect;

function dbRowToItem(row: DbInventoryRow): InventoryItem {
  const daysRaw = (row.available_days || '').trim();
  return {
    client_id: row.client_id,
    sku: row.sku,
    name: row.name,
    price: typeof row.price === 'string' ? parseFloat(row.price) : (row.price ?? 0),
    stock: row.stock,
    low_stock_threshold: row.low_stock_threshold,
    is_active: row.is_active,
    updated_at: row.updated_at ? row.updated_at.toISOString() : '',
    notes: row.notes ?? '',
    available_from: row.available_from ?? '',
    available_to: row.available_to ?? '',
    available_days: daysRaw
      ? daysRaw.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean)
      : [],
    category: row.category ?? '',
    tracks_stock: row.tracks_stock,
  };
}

// "9:30" → "09:30" so stored times are always HH:MM. Mirrors the legacy
// normalizeTime() helper that lib/inventory.ts uses on writes.
function normalizeTime(t: string): string {
  if (!t) return '';
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return t;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

// Slug helper duplicated from lib/inventory.ts so this module doesn't need
// to reach back across the boundary. Kept private — callers should use the
// `slugify` exported from lib/inventory.ts.
function slugifyLocal(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'item'
  );
}

// ─── reads ──────────────────────────────────────────────────────────────

export async function getInventory(clientId: string): Promise<InventoryItem[]> {
  const rows = await db.select().from(inventoryTable).where(eq(inventoryTable.client_id, clientId));
  return rows.map(dbRowToItem);
}

export async function getActiveInventory(clientId: string): Promise<InventoryItem[]> {
  const rows = await db
    .select()
    .from(inventoryTable)
    .where(and(eq(inventoryTable.client_id, clientId), eq(inventoryTable.is_active, true)));
  return rows.map(dbRowToItem);
}

export async function getItem(clientId: string, sku: string): Promise<InventoryItem | null> {
  const rows = await db
    .select()
    .from(inventoryTable)
    .where(and(eq(inventoryTable.client_id, clientId), eq(inventoryTable.sku, sku)))
    .limit(1);
  return rows[0] ? dbRowToItem(rows[0]) : null;
}

// ─── writes ─────────────────────────────────────────────────────────────

export async function upsertItem(
  input: Partial<InventoryItem> & { client_id: string; name: string }
): Promise<InventoryItem> {
  const sku = input.sku && input.sku.trim() ? slugifyLocal(input.sku) : slugifyLocal(input.name);
  const existing = await getItem(input.client_id, sku);

  const stock =
    typeof input.stock === 'number'
      ? Math.max(0, Math.floor(input.stock))
      : existing?.stock ?? 0;
  const price = typeof input.price === 'number' ? input.price : existing?.price ?? 0;
  const lowStock =
    typeof input.low_stock_threshold === 'number'
      ? Math.max(0, Math.floor(input.low_stock_threshold))
      : existing?.low_stock_threshold ?? 0;
  const isActive =
    typeof input.is_active === 'boolean' ? input.is_active : existing?.is_active ?? true;
  const notes = typeof input.notes === 'string' ? input.notes : existing?.notes ?? '';
  const fromT = normalizeTime(
    typeof input.available_from === 'string' ? input.available_from : existing?.available_from ?? ''
  );
  const toT = normalizeTime(
    typeof input.available_to === 'string' ? input.available_to : existing?.available_to ?? ''
  );
  const days = Array.isArray(input.available_days)
    ? input.available_days
    : existing?.available_days ?? [];
  const category =
    typeof input.category === 'string' ? input.category.trim() : existing?.category ?? '';
  const tracksStock =
    typeof input.tracks_stock === 'boolean' ? input.tracks_stock : existing?.tracks_stock ?? true;

  const now = new Date();
  const trimmedName = input.name.trim();
  const daysJoined = days.join(',');

  await db
    .insert(inventoryTable)
    .values({
      client_id: input.client_id,
      sku,
      name: trimmedName,
      price: String(price),
      stock,
      low_stock_threshold: lowStock,
      is_active: isActive,
      updated_at: now,
      notes,
      available_from: fromT,
      available_to: toT,
      available_days: daysJoined,
      category,
      tracks_stock: tracksStock,
    })
    .onConflictDoUpdate({
      target: [inventoryTable.client_id, inventoryTable.sku],
      set: {
        name: trimmedName,
        price: String(price),
        stock,
        low_stock_threshold: lowStock,
        is_active: isActive,
        updated_at: now,
        notes,
        available_from: fromT,
        available_to: toT,
        available_days: daysJoined,
        category,
        tracks_stock: tracksStock,
      },
    });

  return {
    client_id: input.client_id,
    sku,
    name: trimmedName,
    price,
    stock,
    low_stock_threshold: lowStock,
    is_active: isActive,
    updated_at: now.toISOString(),
    notes,
    available_from: fromT,
    available_to: toT,
    available_days: days,
    category,
    tracks_stock: tracksStock,
  };
}

export async function setStock(
  clientId: string,
  sku: string,
  qty: number
): Promise<InventoryItem | null> {
  const item = await getItem(clientId, sku);
  if (!item) return null;
  return upsertItem({ ...item, stock: Math.max(0, Math.floor(qty)) });
}

export async function adjustStock(
  clientId: string,
  sku: string,
  delta: number
): Promise<{ item: InventoryItem | null; previous: number; crossedLowThreshold: boolean }> {
  const item = await getItem(clientId, sku);
  if (!item) return { item: null, previous: 0, crossedLowThreshold: false };
  const previous = item.stock;
  const next = Math.max(0, previous + Math.floor(delta));
  const crossedLowThreshold =
    item.low_stock_threshold > 0 &&
    previous > item.low_stock_threshold &&
    next <= item.low_stock_threshold;
  const updated = await upsertItem({ ...item, stock: next });
  return { item: updated, previous, crossedLowThreshold };
}

// Bulk upsert. With the composite PK (client_id, sku) and ON CONFLICT, a
// straight loop is fine — Sheets had to dance around row-position lookups
// to avoid N+1 reads, but Postgres handles each upsert in ~10 ms.
export async function batchUpsertItems(
  inputs: Array<Partial<InventoryItem> & { client_id: string; name: string }>
): Promise<{ written: number; skipped: number }> {
  if (!inputs.length) return { written: 0, skipped: 0 };
  let written = 0;
  let skipped = 0;
  for (const input of inputs) {
    try {
      await upsertItem(input);
      written++;
    } catch {
      skipped++;
    }
  }
  return { written, skipped };
}

export async function deleteItem(clientId: string, sku: string): Promise<boolean> {
  const item = await getItem(clientId, sku);
  if (!item) return false;
  // Soft-delete to match legacy behavior (lib/inventory.ts:321-326). Hard
  // deletes would lose order history references.
  await upsertItem({ ...item, is_active: false });
  return true;
}
