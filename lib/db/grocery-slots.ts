import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from './index';
import { grocery_slots } from './schema';
import type { GrocerySlot } from '../grocery/types';

type Row = typeof grocery_slots.$inferSelect;

function toSlot(r: Row): GrocerySlot {
  let dow: number[] = [0, 1, 2, 3, 4, 5, 6];
  try {
    const v = JSON.parse(r.days_of_week);
    if (Array.isArray(v)) dow = v.map((n) => parseInt(String(n), 10)).filter((n) => !Number.isNaN(n));
  } catch {}
  return {
    id: r.id,
    client_id: r.client_id,
    label: r.label,
    start_time: r.start_time,
    end_time: r.end_time,
    cutoff_time: r.cutoff_time,
    days_of_week: dow,
    is_active: r.is_active,
  };
}

export async function listSlots(client_id: string): Promise<GrocerySlot[]> {
  const rows = await db
    .select()
    .from(grocery_slots)
    .where(eq(grocery_slots.client_id, client_id))
    .orderBy(grocery_slots.start_time);
  return rows.map(toSlot);
}

export async function getSlot(id: string): Promise<GrocerySlot | null> {
  const rows = await db.select().from(grocery_slots).where(eq(grocery_slots.id, id)).limit(1);
  return rows[0] ? toSlot(rows[0]) : null;
}

export interface CreateSlotInput {
  client_id: string;
  label: string;
  start_time: string; // HH:MM
  end_time: string;
  cutoff_time: string;
  days_of_week?: number[];
  is_active?: boolean;
}

export async function createSlot(input: CreateSlotInput): Promise<GrocerySlot> {
  const id = randomUUID();
  await db.insert(grocery_slots).values({
    id,
    client_id: input.client_id,
    label: input.label.trim(),
    start_time: input.start_time,
    end_time: input.end_time,
    cutoff_time: input.cutoff_time,
    days_of_week: JSON.stringify(input.days_of_week ?? [0, 1, 2, 3, 4, 5, 6]),
    is_active: input.is_active ?? true,
  });
  const s = await getSlot(id);
  if (!s) throw new Error('createSlot: insert succeeded but row missing');
  return s;
}

export async function updateSlot(
  id: string,
  patch: Partial<Omit<CreateSlotInput, 'client_id'>>
): Promise<void> {
  const set: Partial<typeof grocery_slots.$inferInsert> = {};
  if (patch.label !== undefined) set.label = patch.label;
  if (patch.start_time !== undefined) set.start_time = patch.start_time;
  if (patch.end_time !== undefined) set.end_time = patch.end_time;
  if (patch.cutoff_time !== undefined) set.cutoff_time = patch.cutoff_time;
  if (patch.days_of_week !== undefined) set.days_of_week = JSON.stringify(patch.days_of_week);
  if (patch.is_active !== undefined) set.is_active = patch.is_active;
  if (Object.keys(set).length === 0) return;
  await db.update(grocery_slots).set(set).where(eq(grocery_slots.id, id));
}

export async function deleteSlot(id: string): Promise<void> {
  await db.delete(grocery_slots).where(eq(grocery_slots.id, id));
}

export async function activeSlots(client_id: string): Promise<GrocerySlot[]> {
  const rows = await db
    .select()
    .from(grocery_slots)
    .where(and(eq(grocery_slots.client_id, client_id), eq(grocery_slots.is_active, true)))
    .orderBy(grocery_slots.start_time);
  return rows.map(toSlot);
}
