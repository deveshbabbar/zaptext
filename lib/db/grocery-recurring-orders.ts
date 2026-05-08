import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from './index';
import { grocery_recurring_orders } from './schema';
import type { RecurringOrder, CartItem } from '../grocery/types';

type Row = typeof grocery_recurring_orders.$inferSelect;

function toRecurring(r: Row): RecurringOrder {
  let items: CartItem[] = [];
  try {
    const v = JSON.parse(r.template_items);
    if (Array.isArray(v)) items = v as CartItem[];
  } catch {}
  return {
    id: r.id,
    client_id: r.client_id,
    customer_phone: r.customer_phone,
    day_of_week: r.day_of_week,
    slot_id: r.slot_id,
    template_items: items,
    is_active: r.is_active,
    last_run_date: r.last_run_date,
  };
}

export interface CreateRecurringInput {
  client_id: string;
  customer_phone: string;
  day_of_week: number;
  slot_id: string;
  template_items: CartItem[];
}

export async function createRecurring(input: CreateRecurringInput): Promise<RecurringOrder> {
  const id = randomUUID();
  await db.insert(grocery_recurring_orders).values({
    id,
    client_id: input.client_id,
    customer_phone: input.customer_phone,
    day_of_week: input.day_of_week,
    slot_id: input.slot_id,
    template_items: JSON.stringify(input.template_items),
    is_active: true,
    last_run_date: null,
  });
  return { ...input, id, is_active: true, last_run_date: null };
}

export async function listRecurring(client_id: string): Promise<RecurringOrder[]> {
  const rows = await db
    .select()
    .from(grocery_recurring_orders)
    .where(eq(grocery_recurring_orders.client_id, client_id));
  return rows.map(toRecurring);
}

export async function activeRecurringForDay(
  day_of_week: number,
  todayDate: string
): Promise<RecurringOrder[]> {
  const rows = await db
    .select()
    .from(grocery_recurring_orders)
    .where(
      and(
        eq(grocery_recurring_orders.day_of_week, day_of_week),
        eq(grocery_recurring_orders.is_active, true)
      )
    );
  // Filter out ones already run today (idempotence guard).
  return rows.map(toRecurring).filter((r) => r.last_run_date !== todayDate);
}

export async function setRecurringActive(id: string, is_active: boolean): Promise<void> {
  await db
    .update(grocery_recurring_orders)
    .set({ is_active })
    .where(eq(grocery_recurring_orders.id, id));
}

export async function markRecurringRan(id: string, runDate: string): Promise<void> {
  await db
    .update(grocery_recurring_orders)
    .set({ last_run_date: runDate })
    .where(eq(grocery_recurring_orders.id, id));
}

export async function pauseRecurringForCustomer(
  client_id: string,
  customer_phone: string
): Promise<void> {
  await db
    .update(grocery_recurring_orders)
    .set({ is_active: false })
    .where(
      and(
        eq(grocery_recurring_orders.client_id, client_id),
        eq(grocery_recurring_orders.customer_phone, customer_phone)
      )
    );
}
