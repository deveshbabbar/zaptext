// ─── Per-client inventory categories ───
//
// Phase 3 of the inventory work. Each client's inventory page is grouped
// by category; categories themselves are per-client so an owner can add
// custom labels (e.g., a gym owner adds "Diet Plans") without touching
// the global vertical defaults.
//
// On first sync (bot approval / settings save), seedDefaultsForVertical()
// inserts a sensible starter set per business type. The seed is
// idempotent — ON CONFLICT (client_id, name) DO NOTHING — so re-running
// never duplicates and the owner's renames/deletes survive.
//
// WhatsApp Commerce Policy compliance:
//   We deliberately exclude categories that Meta classifies as restricted
//   commerce content — most notably "Supplements" (ingestible products)
//   and "Diet Plans" / weight-loss services. Listing items in these
//   categories with prices effectively promotes their sale via the bot,
//   which is prohibited and triggers WABA restrictions. If an owner
//   really wants those, they have to add them as a custom category from
//   /client/settings — that's their explicit choice, with the policy
//   risk on them, not seeded by us.

import { v4 as uuid } from 'uuid';
import { and, asc, eq } from 'drizzle-orm';
import { db } from './index';
import { inventoryCategories } from './schema';
import type { BusinessType, InventoryCategory } from '../types';

type DbCategoryRow = typeof inventoryCategories.$inferSelect;

function dbRowToCategory(row: DbCategoryRow): InventoryCategory {
  return {
    id: row.id,
    client_id: row.client_id,
    name: row.name,
    tracks_stock: row.tracks_stock,
    display_order: row.display_order,
    created_at: row.created_at ? row.created_at.toISOString() : '',
  };
}

// ─── Per-vertical defaults ──────────────────────────────────────────────
//
// `tracks_stock: false` for service/plan-style categories (memberships,
// services, courses, listings) where stock counts don't make sense.
// `tracks_stock: true` for physical products with finite quantity.

interface DefaultCategory {
  name: string;
  tracks_stock: boolean;
  order: number;
}

export const VERTICAL_DEFAULT_CATEGORIES: Record<BusinessType, DefaultCategory[]> = {
  gym: [
    // 'Supplements' (ingestible) is intentionally NOT seeded — Meta's
    // WhatsApp Commerce Policy prohibits promoting the sale of ingestible
    // supplements, which would put the WABA at restriction risk.
    { name: 'Membership Plans',  tracks_stock: false, order: 0 },
    { name: 'Personal Training', tracks_stock: false, order: 1 },
    { name: 'Group Classes',     tracks_stock: false, order: 2 },
    { name: 'Merchandise',       tracks_stock: true,  order: 3 },
    { name: 'Equipment',         tracks_stock: true,  order: 4 },
  ],
  salon: [
    { name: 'Services',    tracks_stock: false, order: 0 },
    { name: 'Packages',    tracks_stock: false, order: 1 },
    { name: 'Memberships', tracks_stock: false, order: 2 },
    { name: 'Products',    tracks_stock: true,  order: 3 },
  ],
  restaurant: [
    { name: 'Menu',     tracks_stock: true,  order: 0 },
    { name: 'Combos',   tracks_stock: true,  order: 1 },
    { name: 'Catering', tracks_stock: false, order: 2 },
  ],
  coaching: [
    { name: 'Courses',          tracks_stock: false, order: 0 },
    { name: 'Books',            tracks_stock: true,  order: 1 },
    { name: 'Online Resources', tracks_stock: false, order: 2 },
  ],
  d2c: [
    { name: 'Products',      tracks_stock: true,  order: 0 },
    { name: 'Subscriptions', tracks_stock: false, order: 1 },
  ],
  realestate: [
    { name: 'Listings',     tracks_stock: false, order: 0 },
    { name: 'Project Ads',  tracks_stock: false, order: 1 },
  ],
  tiffin: [
    { name: 'Plans',    tracks_stock: false, order: 0 },
    { name: 'Menu',     tracks_stock: false, order: 1 },
    { name: 'Add-ons',  tracks_stock: false, order: 2 },
    { name: 'Combos',   tracks_stock: false, order: 3 },
  ],
};

// ─── reads ──────────────────────────────────────────────────────────────

export async function getCategories(clientId: string): Promise<InventoryCategory[]> {
  const rows = await db
    .select()
    .from(inventoryCategories)
    .where(eq(inventoryCategories.client_id, clientId))
    .orderBy(asc(inventoryCategories.display_order), asc(inventoryCategories.name));
  return rows.map(dbRowToCategory);
}

export async function getCategoryByName(
  clientId: string,
  name: string
): Promise<InventoryCategory | null> {
  const rows = await db
    .select()
    .from(inventoryCategories)
    .where(and(eq(inventoryCategories.client_id, clientId), eq(inventoryCategories.name, name)))
    .limit(1);
  return rows[0] ? dbRowToCategory(rows[0]) : null;
}

// ─── writes ─────────────────────────────────────────────────────────────

export async function upsertCategory(input: {
  client_id: string;
  name: string;
  tracks_stock?: boolean;
  display_order?: number;
}): Promise<InventoryCategory> {
  const trimmedName = input.name.trim();
  if (!trimmedName) throw new Error('Category name required');

  const existing = await getCategoryByName(input.client_id, trimmedName);
  const tracksStock =
    typeof input.tracks_stock === 'boolean' ? input.tracks_stock : existing?.tracks_stock ?? true;
  const order =
    typeof input.display_order === 'number' ? input.display_order : existing?.display_order ?? 0;

  await db
    .insert(inventoryCategories)
    .values({
      id: existing?.id || uuid(),
      client_id: input.client_id,
      name: trimmedName,
      tracks_stock: tracksStock,
      display_order: order,
    })
    .onConflictDoUpdate({
      target: [inventoryCategories.client_id, inventoryCategories.name],
      set: { tracks_stock: tracksStock, display_order: order },
    });

  return (await getCategoryByName(input.client_id, trimmedName))!;
}

export async function deleteCategory(clientId: string, name: string): Promise<boolean> {
  const res = await db
    .delete(inventoryCategories)
    .where(
      and(
        eq(inventoryCategories.client_id, clientId),
        eq(inventoryCategories.name, name)
      )
    )
    .returning({ id: inventoryCategories.id });
  return res.length > 0;
}

// Seed the default category list for a given client + vertical. Idempotent:
// existing categories (matched by name) are left alone, so an owner who
// renamed "Membership Plans" → "Membership" won't have the rename
// reverted on the next bot save. New defaults that aren't already in the
// client's list get inserted.
export async function seedDefaultsForVertical(
  clientId: string,
  vertical: BusinessType
): Promise<{ inserted: number }> {
  const defaults = VERTICAL_DEFAULT_CATEGORIES[vertical] || [];
  if (defaults.length === 0) return { inserted: 0 };

  // Fetch existing once, then only insert the missing ones — avoids N
  // round-trips and respects the unique (client_id, name) index.
  const existing = await getCategories(clientId);
  const existingNames = new Set(existing.map((c) => c.name.toLowerCase()));

  const toInsert = defaults.filter((d) => !existingNames.has(d.name.toLowerCase()));
  if (toInsert.length === 0) return { inserted: 0 };

  await db.insert(inventoryCategories).values(
    toInsert.map((d) => ({
      id: uuid(),
      client_id: clientId,
      name: d.name,
      tracks_stock: d.tracks_stock,
      display_order: d.order,
    }))
  );

  return { inserted: toInsert.length };
}
