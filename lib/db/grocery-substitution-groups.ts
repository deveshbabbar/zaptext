import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from './index';
import { grocery_substitution_groups } from './schema';
import type { SubstitutionGroup } from '../grocery/types';

type Row = typeof grocery_substitution_groups.$inferSelect;

function toGroup(r: Row): SubstitutionGroup {
  let ids: string[] = [];
  try {
    const v = JSON.parse(r.product_ids);
    if (Array.isArray(v)) ids = v.map(String);
  } catch {}
  return { id: r.id, client_id: r.client_id, name: r.name, product_ids: ids };
}

export async function listGroups(client_id: string): Promise<SubstitutionGroup[]> {
  const rows = await db
    .select()
    .from(grocery_substitution_groups)
    .where(eq(grocery_substitution_groups.client_id, client_id))
    .orderBy(grocery_substitution_groups.name);
  return rows.map(toGroup);
}

export async function createGroup(
  client_id: string,
  name: string,
  product_ids: string[]
): Promise<SubstitutionGroup> {
  const id = randomUUID();
  await db.insert(grocery_substitution_groups).values({
    id,
    client_id,
    name: name.trim(),
    product_ids: JSON.stringify(product_ids),
  });
  return { id, client_id, name: name.trim(), product_ids };
}

export async function updateGroup(
  id: string,
  patch: { name?: string; product_ids?: string[] }
): Promise<void> {
  const set: any = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.product_ids !== undefined) set.product_ids = JSON.stringify(patch.product_ids);
  if (Object.keys(set).length === 0) return;
  await db
    .update(grocery_substitution_groups)
    .set(set)
    .where(eq(grocery_substitution_groups.id, id));
}

export async function deleteGroup(id: string): Promise<void> {
  await db
    .delete(grocery_substitution_groups)
    .where(eq(grocery_substitution_groups.id, id));
}

// Find a group containing this product_id. Used by lib/grocery/substitutions.ts.
export async function findGroupContaining(
  client_id: string,
  product_id: string
): Promise<SubstitutionGroup | null> {
  const all = await listGroups(client_id);
  return all.find((g) => g.product_ids.includes(product_id)) ?? null;
}
