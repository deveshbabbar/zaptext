// lib/db/grocery-products.ts
//
// CRUD for grocery_products. Owner's master product list per client.
// Aliases stored as JSON-stringified array. We parse on read, stringify
// on write.

import { eq, and, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from './index';
import { grocery_products } from './schema';
import type { GroceryProduct, GroceryUnit } from '../grocery/types';

type Row = typeof grocery_products.$inferSelect;

function rowToProduct(r: Row): GroceryProduct {
  let aliases: string[] = [];
  try {
    const parsed = JSON.parse(r.name_aliases);
    if (Array.isArray(parsed)) aliases = parsed.map(String);
  } catch {
    /* ignore */
  }
  return {
    id: r.id,
    client_id: r.client_id,
    name: r.name,
    name_aliases: aliases,
    unit: r.unit as GroceryUnit,
    image_url: r.image_url,
    created_at: r.created_at?.toISOString() ?? '',
  };
}

export async function listProducts(client_id: string): Promise<GroceryProduct[]> {
  const rows = await db
    .select()
    .from(grocery_products)
    .where(eq(grocery_products.client_id, client_id))
    .orderBy(grocery_products.name);
  return rows.map(rowToProduct);
}

export async function getProduct(id: string): Promise<GroceryProduct | null> {
  const rows = await db
    .select()
    .from(grocery_products)
    .where(eq(grocery_products.id, id))
    .limit(1);
  return rows[0] ? rowToProduct(rows[0]) : null;
}

export interface CreateProductInput {
  client_id: string;
  name: string;
  name_aliases?: string[];
  unit: GroceryUnit;
  image_url?: string | null;
}

export async function createProduct(input: CreateProductInput): Promise<GroceryProduct> {
  const id = randomUUID();
  await db.insert(grocery_products).values({
    id,
    client_id: input.client_id,
    name: input.name.trim().toLowerCase(),
    name_aliases: JSON.stringify(input.name_aliases ?? []),
    unit: input.unit,
    image_url: input.image_url ?? null,
  });
  const created = await getProduct(id);
  if (!created) throw new Error('createProduct: insert succeeded but row missing');
  return created;
}

export async function updateProduct(
  id: string,
  patch: Partial<Pick<GroceryProduct, 'name' | 'name_aliases' | 'unit' | 'image_url'>>
): Promise<void> {
  const setClause: Partial<typeof grocery_products.$inferInsert> = {};
  if (patch.name !== undefined) setClause.name = patch.name.trim().toLowerCase();
  if (patch.name_aliases !== undefined)
    setClause.name_aliases = JSON.stringify(patch.name_aliases);
  if (patch.unit !== undefined) setClause.unit = patch.unit;
  if (patch.image_url !== undefined) setClause.image_url = patch.image_url;
  if (Object.keys(setClause).length === 0) return;
  await db.update(grocery_products).set(setClause).where(eq(grocery_products.id, id));
}

export async function deleteProduct(id: string): Promise<void> {
  await db.delete(grocery_products).where(eq(grocery_products.id, id));
}

// Fuzzy match a raw name against this client's products.
export async function findProductByName(
  client_id: string,
  rawName: string
): Promise<GroceryProduct | null> {
  const needle = rawName.trim().toLowerCase();
  if (!needle) return null;
  const all = await listProducts(client_id);

  const exact = all.find((p) => p.name === needle);
  if (exact) return exact;

  const aliasExact = all.find((p) => p.name_aliases.some((a) => a.toLowerCase() === needle));
  if (aliasExact) return aliasExact;

  if (needle.length >= 3) {
    const sub = all.find(
      (p) =>
        p.name.includes(needle) ||
        needle.includes(p.name) ||
        p.name_aliases.some((a) => a.toLowerCase().includes(needle))
    );
    if (sub) return sub;
  }

  return null;
}
