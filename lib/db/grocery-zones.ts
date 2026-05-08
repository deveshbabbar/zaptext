import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from './index';
import { grocery_zones } from './schema';
import type { GroceryZone } from '../grocery/types';

type Row = typeof grocery_zones.$inferSelect;

function toZone(r: Row): GroceryZone {
  let kw: string[] = [];
  try {
    const v = JSON.parse(r.area_keywords);
    if (Array.isArray(v)) kw = v.map(String);
  } catch {}
  return {
    id: r.id,
    client_id: r.client_id,
    label: r.label,
    pincode: r.pincode,
    area_keywords: kw,
    delivery_fee: parseFloat(r.delivery_fee as unknown as string),
    min_order_for_free_delivery:
      r.min_order_for_free_delivery == null
        ? null
        : parseFloat(r.min_order_for_free_delivery as unknown as string),
    min_order:
      r.min_order == null ? null : parseFloat(r.min_order as unknown as string),
  };
}

export async function listZones(client_id: string): Promise<GroceryZone[]> {
  const rows = await db
    .select()
    .from(grocery_zones)
    .where(eq(grocery_zones.client_id, client_id))
    .orderBy(grocery_zones.label);
  return rows.map(toZone);
}

export async function getZone(id: string): Promise<GroceryZone | null> {
  const rows = await db.select().from(grocery_zones).where(eq(grocery_zones.id, id)).limit(1);
  return rows[0] ? toZone(rows[0]) : null;
}

export interface CreateZoneInput {
  client_id: string;
  label: string;
  pincode?: string | null;
  area_keywords?: string[];
  delivery_fee: number;
  min_order_for_free_delivery?: number | null;
  min_order?: number | null;
}

export async function createZone(input: CreateZoneInput): Promise<GroceryZone> {
  const id = randomUUID();
  await db.insert(grocery_zones).values({
    id,
    client_id: input.client_id,
    label: input.label.trim(),
    pincode: input.pincode ?? null,
    area_keywords: JSON.stringify(input.area_keywords ?? []),
    delivery_fee: input.delivery_fee.toFixed(2),
    min_order_for_free_delivery:
      input.min_order_for_free_delivery == null
        ? null
        : input.min_order_for_free_delivery.toFixed(2),
    min_order: input.min_order == null ? null : input.min_order.toFixed(2),
  });
  const z = await getZone(id);
  if (!z) throw new Error('createZone: insert succeeded but row missing');
  return z;
}

export async function updateZone(
  id: string,
  patch: Partial<CreateZoneInput>
): Promise<void> {
  const set: any = {};
  if (patch.label !== undefined) set.label = patch.label;
  if (patch.pincode !== undefined) set.pincode = patch.pincode;
  if (patch.area_keywords !== undefined)
    set.area_keywords = JSON.stringify(patch.area_keywords);
  if (patch.delivery_fee !== undefined) set.delivery_fee = patch.delivery_fee.toFixed(2);
  if (patch.min_order_for_free_delivery !== undefined)
    set.min_order_for_free_delivery =
      patch.min_order_for_free_delivery == null
        ? null
        : patch.min_order_for_free_delivery.toFixed(2);
  if (patch.min_order !== undefined)
    set.min_order = patch.min_order == null ? null : patch.min_order.toFixed(2);
  if (Object.keys(set).length === 0) return;
  await db.update(grocery_zones).set(set).where(eq(grocery_zones.id, id));
}

export async function deleteZone(id: string): Promise<void> {
  await db.delete(grocery_zones).where(eq(grocery_zones.id, id));
}
