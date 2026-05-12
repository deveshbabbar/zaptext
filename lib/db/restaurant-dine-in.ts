// Neon-backed restaurant dine-in store: tables, sessions, orders.
//
// Three concerns split for readability:
//   - Tables    : CRUD + token rotation
//   - Sessions  : open / refresh / close + active-session lookup by phone
//   - Orders    : insert / list per session + per-day per-type query

import { v4 as uuid } from 'uuid';
import { and, asc, desc, eq, gte, lt, inArray, sql } from 'drizzle-orm';
import { db } from './index';
import {
  restaurant_tables as tablesTable,
  table_sessions as sessionsTable,
  dine_in_orders as ordersTable,
} from './schema';

export interface RestaurantTable {
  id: string;
  client_id: string;
  table_number: string;
  qr_token: string;
  qr_token_rotated_at: string;
  seats: number;
  is_active: boolean;
}

export interface TableSession {
  id: string;
  client_id: string;
  table_number: string;
  status: 'open' | 'closed';
  customer_phones: string[];
  started_at: string;
  last_activity_at: string;
  closed_at: string | null;
  closed_reason: 'timeout' | 'manager' | 'switch' | null;
}

export type DineInOrderType = 'dine_in' | 'home_delivery' | 'parcel_takeaway';
export type DineInOrderStatus = 'placed' | 'preparing' | 'served' | 'cancelled';

export interface DineInOrderItem {
  name: string;
  qty: number;
  price: number;
  notes?: string;
}

export interface DineInOrder {
  id: string;
  client_id: string;
  session_id: string | null;
  table_number: string | null;
  customer_phone: string;
  customer_name: string;
  order_type: DineInOrderType;
  items: DineInOrderItem[];
  subtotal: number;
  total: number;
  delivery_address: string;
  status: DineInOrderStatus;
  special_notes: string;
  created_at: string;
  served_at: string | null;
}

function parsePhones(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function parseItems(raw: string): DineInOrderItem[] {
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
      .map((x) => ({
        name: String(x.name ?? '').trim(),
        qty: Number(x.qty ?? 1) || 1,
        price: Number(x.price ?? 0) || 0,
        notes: typeof x.notes === 'string' ? x.notes : undefined,
      }))
      .filter((x) => x.name.length > 0);
  } catch {
    return [];
  }
}

function toIso(d: Date | string): string {
  return typeof d === 'string' ? d : d.toISOString();
}

// ─── Tables ───────────────────────────────────────────────────────────

export async function listTables(clientId: string): Promise<RestaurantTable[]> {
  const rows = await db
    .select()
    .from(tablesTable)
    .where(eq(tablesTable.client_id, clientId))
    .orderBy(asc(tablesTable.table_number));
  return rows.map((r) => ({
    id: r.id,
    client_id: r.client_id,
    table_number: r.table_number,
    qr_token: r.qr_token,
    qr_token_rotated_at: toIso(r.qr_token_rotated_at),
    seats: r.seats ?? 0,
    is_active: r.is_active,
  }));
}

export async function getTable(
  clientId: string,
  tableNumber: string
): Promise<RestaurantTable | null> {
  const rows = await db
    .select()
    .from(tablesTable)
    .where(and(eq(tablesTable.client_id, clientId), eq(tablesTable.table_number, tableNumber)))
    .limit(1);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    client_id: r.client_id,
    table_number: r.table_number,
    qr_token: r.qr_token,
    qr_token_rotated_at: toIso(r.qr_token_rotated_at),
    seats: r.seats ?? 0,
    is_active: r.is_active,
  };
}

export async function upsertTable(input: {
  client_id: string;
  table_number: string;
  qr_token: string;
  seats?: number;
}): Promise<RestaurantTable> {
  const existing = await getTable(input.client_id, input.table_number);
  if (existing) {
    await db
      .update(tablesTable)
      .set({ seats: input.seats ?? existing.seats, is_active: true })
      .where(eq(tablesTable.id, existing.id));
    return { ...existing, seats: input.seats ?? existing.seats, is_active: true };
  }
  const id = uuid();
  await db.insert(tablesTable).values({
    id,
    client_id: input.client_id,
    table_number: input.table_number,
    qr_token: input.qr_token,
    seats: input.seats ?? 0,
    is_active: true,
  });
  const created = await getTable(input.client_id, input.table_number);
  if (!created) throw new Error('upsertTable: insert succeeded but row missing');
  return created;
}

export async function rotateTableToken(
  clientId: string,
  tableNumber: string,
  newToken: string
): Promise<void> {
  await db
    .update(tablesTable)
    .set({ qr_token: newToken, qr_token_rotated_at: new Date() })
    .where(and(eq(tablesTable.client_id, clientId), eq(tablesTable.table_number, tableNumber)));
}

export async function deactivateTable(clientId: string, tableNumber: string): Promise<void> {
  await db
    .update(tablesTable)
    .set({ is_active: false })
    .where(and(eq(tablesTable.client_id, clientId), eq(tablesTable.table_number, tableNumber)));
}

// ─── Sessions ─────────────────────────────────────────────────────────

const SESSION_INACTIVITY_MS = 2 * 60 * 60 * 1000; // 2 hours

function dbRowToSession(r: typeof sessionsTable.$inferSelect): TableSession {
  return {
    id: r.id,
    client_id: r.client_id,
    table_number: r.table_number,
    status: r.status === 'closed' ? 'closed' : 'open',
    customer_phones: parsePhones(r.customer_phones),
    started_at: toIso(r.started_at),
    last_activity_at: toIso(r.last_activity_at),
    closed_at: r.closed_at ? toIso(r.closed_at) : null,
    closed_reason: (r.closed_reason as TableSession['closed_reason']) ?? null,
  };
}

export async function getOpenSessionForTable(
  clientId: string,
  tableNumber: string
): Promise<TableSession | null> {
  const rows = await db
    .select()
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.client_id, clientId),
        eq(sessionsTable.table_number, tableNumber),
        eq(sessionsTable.status, 'open')
      )
    )
    .orderBy(desc(sessionsTable.started_at))
    .limit(1);
  return rows.length ? dbRowToSession(rows[0]) : null;
}

export async function getOpenSessionForPhone(
  clientId: string,
  phone: string
): Promise<TableSession | null> {
  // customer_phones is a JSON-serialised string[] stored as text. LIKE on
  // the literal quoted phone substring works because we normalise phones
  // before insertion and JSON quoting is deterministic.
  const needle = `%"${phone}"%`;
  const rows = await db
    .select()
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.client_id, clientId),
        eq(sessionsTable.status, 'open'),
        sql`${sessionsTable.customer_phones} LIKE ${needle}`
      )
    )
    .orderBy(desc(sessionsTable.last_activity_at))
    .limit(1);
  return rows.length ? dbRowToSession(rows[0]) : null;
}

export async function getSessionById(sessionId: string): Promise<TableSession | null> {
  const rows = await db.select().from(sessionsTable).where(eq(sessionsTable.id, sessionId)).limit(1);
  return rows.length ? dbRowToSession(rows[0]) : null;
}

export async function openOrJoinSession(input: {
  client_id: string;
  table_number: string;
  customer_phone: string;
}): Promise<TableSession> {
  const existing = await getOpenSessionForTable(input.client_id, input.table_number);
  if (existing) {
    const phones = existing.customer_phones.includes(input.customer_phone)
      ? existing.customer_phones
      : [...existing.customer_phones, input.customer_phone];
    await db
      .update(sessionsTable)
      .set({
        customer_phones: JSON.stringify(phones),
        last_activity_at: new Date(),
      })
      .where(eq(sessionsTable.id, existing.id));
    return { ...existing, customer_phones: phones, last_activity_at: new Date().toISOString() };
  }
  const id = uuid();
  await db.insert(sessionsTable).values({
    id,
    client_id: input.client_id,
    table_number: input.table_number,
    status: 'open',
    customer_phones: JSON.stringify([input.customer_phone]),
  });
  const rows = await db.select().from(sessionsTable).where(eq(sessionsTable.id, id)).limit(1);
  return dbRowToSession(rows[0]);
}

export async function touchSession(sessionId: string): Promise<void> {
  await db
    .update(sessionsTable)
    .set({ last_activity_at: new Date() })
    .where(eq(sessionsTable.id, sessionId));
}

export async function closeSession(
  sessionId: string,
  reason: 'timeout' | 'manager' | 'switch'
): Promise<void> {
  await db
    .update(sessionsTable)
    .set({ status: 'closed', closed_at: new Date(), closed_reason: reason })
    .where(eq(sessionsTable.id, sessionId));
}

// Auto-close stale sessions. Called from the cron sweep but also opportunistically
// from the webhook so demos work without waiting for the cron tick.
export async function closeStaleSessions(): Promise<number> {
  const cutoff = new Date(Date.now() - SESSION_INACTIVITY_MS);
  const stale = await db
    .select({ id: sessionsTable.id })
    .from(sessionsTable)
    .where(and(eq(sessionsTable.status, 'open'), lt(sessionsTable.last_activity_at, cutoff)));
  if (stale.length === 0) return 0;
  await db
    .update(sessionsTable)
    .set({ status: 'closed', closed_at: new Date(), closed_reason: 'timeout' })
    .where(
      and(
        inArray(
          sessionsTable.id,
          stale.map((s) => s.id)
        ),
        eq(sessionsTable.status, 'open')
      )
    );
  return stale.length;
}

export async function listOpenSessions(clientId: string): Promise<TableSession[]> {
  const rows = await db
    .select()
    .from(sessionsTable)
    .where(and(eq(sessionsTable.client_id, clientId), eq(sessionsTable.status, 'open')))
    .orderBy(desc(sessionsTable.last_activity_at));
  return rows.map(dbRowToSession);
}

// ─── Orders ───────────────────────────────────────────────────────────

function dbRowToOrder(r: typeof ordersTable.$inferSelect): DineInOrder {
  return {
    id: r.id,
    client_id: r.client_id,
    session_id: r.session_id,
    table_number: r.table_number,
    customer_phone: r.customer_phone,
    customer_name: r.customer_name ?? '',
    order_type: (r.order_type as DineInOrderType) || 'dine_in',
    items: parseItems(r.items),
    subtotal: Number(r.subtotal) || 0,
    total: Number(r.total) || 0,
    delivery_address: r.delivery_address ?? '',
    status: (r.status as DineInOrderStatus) || 'placed',
    special_notes: r.special_notes ?? '',
    created_at: toIso(r.created_at),
    served_at: r.served_at ? toIso(r.served_at) : null,
  };
}

export async function createOrder(input: {
  client_id: string;
  session_id?: string | null;
  table_number?: string | null;
  customer_phone: string;
  customer_name?: string;
  order_type: DineInOrderType;
  items: DineInOrderItem[];
  delivery_address?: string;
  special_notes?: string;
}): Promise<DineInOrder> {
  const subtotal = input.items.reduce((s, it) => s + it.price * it.qty, 0);
  // Total currently equals subtotal — taxes/delivery fee can be added later
  // without changing this call site.
  const total = subtotal;
  const id = uuid();
  await db.insert(ordersTable).values({
    id,
    client_id: input.client_id,
    session_id: input.session_id ?? null,
    table_number: input.table_number ?? null,
    customer_phone: input.customer_phone,
    customer_name: input.customer_name ?? '',
    order_type: input.order_type,
    items: JSON.stringify(input.items),
    subtotal: subtotal.toFixed(2),
    total: total.toFixed(2),
    delivery_address: input.delivery_address ?? '',
    special_notes: input.special_notes ?? '',
  });
  const rows = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  return dbRowToOrder(rows[0]);
}

export async function getOrdersBySession(sessionId: string): Promise<DineInOrder[]> {
  const rows = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.session_id, sessionId))
    .orderBy(asc(ordersTable.created_at));
  return rows.map(dbRowToOrder);
}

export async function listOrdersForToday(
  clientId: string,
  orderType?: DineInOrderType
): Promise<DineInOrder[]> {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const where = orderType
    ? and(
        eq(ordersTable.client_id, clientId),
        eq(ordersTable.order_type, orderType),
        gte(ordersTable.created_at, dayStart)
      )
    : and(eq(ordersTable.client_id, clientId), gte(ordersTable.created_at, dayStart));
  const rows = await db.select().from(ordersTable).where(where).orderBy(desc(ordersTable.created_at));
  return rows.map(dbRowToOrder);
}

export async function updateOrderStatus(orderId: string, status: DineInOrderStatus): Promise<void> {
  await db
    .update(ordersTable)
    .set({ status, served_at: status === 'served' ? new Date() : undefined })
    .where(eq(ordersTable.id, orderId));
}
