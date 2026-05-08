import { and, eq, desc } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from './index';
import { grocery_orders } from './schema';
import type { GroceryOrder, OrderStatus, CartItem, PaymentMode } from '../grocery/types';

type Row = typeof grocery_orders.$inferSelect;

function toOrder(r: Row): GroceryOrder {
  let items: CartItem[] = [];
  try {
    const v = JSON.parse(r.items);
    if (Array.isArray(v)) items = v as CartItem[];
  } catch {}
  return {
    id: r.id,
    client_id: r.client_id,
    customer_phone: r.customer_phone,
    customer_name: r.customer_name,
    delivery_address: r.delivery_address,
    zone_id: r.zone_id,
    slot_id: r.slot_id,
    slot_date: r.slot_date,
    items,
    subtotal: parseFloat(r.subtotal as unknown as string),
    delivery_fee: parseFloat(r.delivery_fee as unknown as string),
    total: parseFloat(r.total as unknown as string),
    status: r.status as OrderStatus,
    payment_mode: r.payment_mode as PaymentMode,
    notes: r.notes,
    created_at: r.created_at?.toISOString() ?? '',
  };
}

export interface CreateOrderInput {
  client_id: string;
  customer_phone: string;
  customer_name?: string | null;
  delivery_address: string;
  zone_id: string;
  slot_id: string;
  slot_date: string;
  items: CartItem[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment_mode?: PaymentMode;
  notes?: string | null;
}

export async function createOrder(input: CreateOrderInput): Promise<GroceryOrder> {
  const id = randomUUID();
  await db.insert(grocery_orders).values({
    id,
    client_id: input.client_id,
    customer_phone: input.customer_phone,
    customer_name: input.customer_name ?? null,
    delivery_address: input.delivery_address,
    zone_id: input.zone_id,
    slot_id: input.slot_id,
    slot_date: input.slot_date,
    items: JSON.stringify(input.items),
    subtotal: input.subtotal.toFixed(2),
    delivery_fee: input.delivery_fee.toFixed(2),
    total: input.total.toFixed(2),
    status: 'pending',
    payment_mode: input.payment_mode ?? 'cod',
    notes: input.notes ?? null,
  });
  const o = await getOrder(id);
  if (!o) throw new Error('createOrder: insert succeeded but row missing');
  return o;
}

export async function getOrder(id: string): Promise<GroceryOrder | null> {
  const rows = await db.select().from(grocery_orders).where(eq(grocery_orders.id, id)).limit(1);
  return rows[0] ? toOrder(rows[0]) : null;
}

export async function listOrders(
  client_id: string,
  filter: { status?: OrderStatus; limit?: number } = {}
): Promise<GroceryOrder[]> {
  const where = filter.status
    ? and(eq(grocery_orders.client_id, client_id), eq(grocery_orders.status, filter.status))
    : eq(grocery_orders.client_id, client_id);
  const rows = await db
    .select()
    .from(grocery_orders)
    .where(where)
    .orderBy(desc(grocery_orders.created_at))
    .limit(filter.limit ?? 100);
  return rows.map(toOrder);
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
  await db.update(grocery_orders).set({ status }).where(eq(grocery_orders.id, id));
}
