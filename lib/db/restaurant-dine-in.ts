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
  /** Outlet binding. 'main' for single-outlet kitchens — the synthetic
   *  outlet that lib/db/outlets.ts produces. Multi-outlet kitchens
   *  store the outlet's stable id here. Set at table creation time
   *  from the outlet picker on /client/restaurant/qr-codes. */
  outlet_id: string;
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
// Status flow varies by order_type (managed in the API layer):
//   dine_in:         placed → preparing → ready → served       (or cancelled at any step)
//   home_delivery:   placed → preparing → ready → out_for_delivery → delivered
//   parcel_takeaway: placed → preparing → ready → picked_up
// 'served' is kept for backward compat with rows written before the flow expanded.
export type DineInOrderStatus =
  | 'placed'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'out_for_delivery'
  | 'delivered'
  | 'picked_up'
  | 'cancelled';

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

export async function listTables(
  clientId: string,
  outletId?: string
): Promise<RestaurantTable[]> {
  const filter = outletId
    ? and(eq(tablesTable.client_id, clientId), eq(tablesTable.outlet_id, outletId))
    : eq(tablesTable.client_id, clientId);
  const rows = await db
    .select()
    .from(tablesTable)
    .where(filter)
    .orderBy(asc(tablesTable.table_number));
  return rows.map((r) => ({
    id: r.id,
    client_id: r.client_id,
    table_number: r.table_number,
    qr_token: r.qr_token,
    qr_token_rotated_at: toIso(r.qr_token_rotated_at),
    seats: r.seats ?? 0,
    is_active: r.is_active,
    outlet_id: r.outlet_id || 'main',
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
    outlet_id: r.outlet_id || 'main',
  };
}

export async function upsertTable(input: {
  client_id: string;
  table_number: string;
  qr_token: string;
  seats?: number;
  /** Optional outlet binding. Defaults to 'main' so single-outlet
   *  callers (which currently constitute every caller) continue to
   *  work unchanged. Multi-outlet kitchens pass the outlet's id. */
  outlet_id?: string;
}): Promise<RestaurantTable> {
  const existing = await getTable(input.client_id, input.table_number);
  if (existing) {
    await db
      .update(tablesTable)
      .set({
        seats: input.seats ?? existing.seats,
        is_active: true,
        ...(input.outlet_id ? { outlet_id: input.outlet_id } : {}),
      })
      .where(eq(tablesTable.id, existing.id));
    return {
      ...existing,
      seats: input.seats ?? existing.seats,
      is_active: true,
      outlet_id: input.outlet_id || existing.outlet_id,
    };
  }
  const id = uuid();
  await db.insert(tablesTable).values({
    id,
    client_id: input.client_id,
    table_number: input.table_number,
    qr_token: input.qr_token,
    seats: input.seats ?? 0,
    is_active: true,
    outlet_id: input.outlet_id || 'main',
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

export async function listOpenSessions(
  clientId: string,
  outletId?: string
): Promise<TableSession[]> {
  // table_sessions doesn't carry outlet_id (sessions are short-lived
  // and tied to a table). For outlet scoping, narrow by joining
  // through restaurant_tables.outlet_id at the application layer.
  const rows = await db
    .select()
    .from(sessionsTable)
    .where(and(eq(sessionsTable.client_id, clientId), eq(sessionsTable.status, 'open')))
    .orderBy(desc(sessionsTable.last_activity_at));
  const all = rows.map(dbRowToSession);
  if (!outletId) return all;
  // Pull this outlet's table numbers + filter.
  const outletTables = await db
    .select({ table_number: tablesTable.table_number })
    .from(tablesTable)
    .where(and(eq(tablesTable.client_id, clientId), eq(tablesTable.outlet_id, outletId)));
  const allowed = new Set(outletTables.map((t) => t.table_number));
  return all.filter((s) => allowed.has(s.table_number));
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
  /** Multi-outlet binding (Phase 3D/3K). Defaults to 'main' so single-
   *  outlet callers keep working unchanged. */
  outlet_id?: string;
  /** Customer delivery lat/lng from WhatsApp location share or
   *  map-pin (Phase 3K). NULL when not provided — table-orders and
   *  takeaway typically have none. */
  delivery_lat?: number | null;
  delivery_lng?: number | null;
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
    outlet_id: input.outlet_id || 'main',
    delivery_lat: input.delivery_lat != null ? input.delivery_lat.toFixed(7) : null,
    delivery_lng: input.delivery_lng != null ? input.delivery_lng.toFixed(7) : null,
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

// Returns the most recent NON-cancelled order for a (client, customer)
// pair. Used by the webhook's "reorder" / "phir wahi" keyword path so
// returning customers can repeat their last meal in one tap.
export async function getLastOrderForCustomer(
  clientId: string,
  customerPhone: string
): Promise<DineInOrder | null> {
  const rows = await db
    .select()
    .from(ordersTable)
    .where(and(
      eq(ordersTable.client_id, clientId),
      eq(ordersTable.customer_phone, customerPhone),
    ))
    .orderBy(desc(ordersTable.created_at))
    .limit(10);
  for (const r of rows) {
    if (r.status !== 'cancelled') return dbRowToOrder(r);
  }
  return null;
}

/**
 * Anti-abuse helper: returns the most recent non-cancelled order for
 * a (clientId, customerPhone) inside a rolling time window. Used by:
 *   - /api/menu/submit  → reject a second submit within `windowMs`
 *   - /m/<clientId>     → render an "already ordered" panel
 *                         instead of the menu form
 *   - webhook menu-link → don't re-issue a fresh link after a
 *                         confirmed order
 *
 * Window defaults to 2 MINUTES — long enough to catch double-taps and
 * accidental duplicate-submits, short enough that a genuine customer
 * who wants to place a SECOND order (e.g. for a colleague at a
 * different address) only has to wait a moment. The "already ordered"
 * page also exposes an explicit "Place a different order" bypass
 * button for impatient legitimate customers.
 *
 * Cancelled orders are ignored so a customer who got rejected
 * (min-order / out-of-zone) can retry immediately.
 */
export const RECENT_ORDER_WINDOW_MS = 2 * 60 * 1000;

export async function getRecentOrderForCustomer(
  clientId: string,
  customerPhone: string,
  windowMs: number = RECENT_ORDER_WINDOW_MS
): Promise<DineInOrder | null> {
  const since = new Date(Date.now() - windowMs);
  const rows = await db
    .select()
    .from(ordersTable)
    .where(and(
      eq(ordersTable.client_id, clientId),
      eq(ordersTable.customer_phone, customerPhone),
      gte(ordersTable.created_at, since),
    ))
    .orderBy(desc(ordersTable.created_at))
    .limit(5);
  for (const r of rows) {
    if (r.status !== 'cancelled') return dbRowToOrder(r);
  }
  return null;
}

export async function listOrdersForToday(
  clientId: string,
  orderType?: DineInOrderType,
  outletId?: string
): Promise<DineInOrder[]> {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const baseClauses = [
    eq(ordersTable.client_id, clientId),
    gte(ordersTable.created_at, dayStart),
  ];
  if (orderType) baseClauses.push(eq(ordersTable.order_type, orderType));
  if (outletId) baseClauses.push(eq(ordersTable.outlet_id, outletId));
  const rows = await db
    .select()
    .from(ordersTable)
    .where(and(...baseClauses))
    .orderBy(desc(ordersTable.created_at));
  return rows.map(dbRowToOrder);
}

export async function updateOrderStatus(orderId: string, status: DineInOrderStatus): Promise<void> {
  // served_at marks the moment the kitchen completed the order. Set it
  // for any "completed" status (served / delivered / picked_up), not just
  // dine_in's served — so analytics can compute prep-to-completion times
  // uniformly across order types.
  const completed = status === 'served' || status === 'delivered' || status === 'picked_up';
  await db
    .update(ordersTable)
    .set({ status, served_at: completed ? new Date() : undefined })
    .where(eq(ordersTable.id, orderId));
}

// ─── Analytics helpers ───
//
// Owner-side dashboard queries. Kept here so the table joins live next
// to the schema instead of leaking drizzle-orm details into the page
// component. All filters are scoped per client_id.

export interface RestaurantStats {
  todayRevenue: number;
  todayOrderCount: number;
  last7DaysRevenue: Array<{ date: string; revenue: number; orderCount: number }>;
  topItemsThisMonth: Array<{ name: string; qty: number; revenue: number }>;
  /** Order count per IST hour-of-day (0-23) bucketed across the last 7
   *  days. Lets the owner spot peak ordering windows for staff scheduling. */
  peakHoursLast7d: number[];
  /** Customer retention this month: total unique customers, how many
   *  ordered ≥2 times, repeat percentage. */
  customerRetention: { totalCustomers: number; repeatCustomers: number; repeatPct: number };
}

export async function getRestaurantStats(
  clientId: string,
  outletId?: string
): Promise<RestaurantStats> {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  // Last 7 days of orders + this month's orders. Two single-table reads —
  // no joins needed, all aggregation happens in JS since volumes are
  // small (a busy restaurant ≈ 50-200 orders/day).
  const weekClauses = [
    eq(ordersTable.client_id, clientId),
    gte(ordersTable.created_at, weekStart),
  ];
  const monthClauses = [
    eq(ordersTable.client_id, clientId),
    gte(ordersTable.created_at, monthStart),
  ];
  if (outletId) {
    weekClauses.push(eq(ordersTable.outlet_id, outletId));
    monthClauses.push(eq(ordersTable.outlet_id, outletId));
  }
  const weekRows = await db
    .select()
    .from(ordersTable)
    .where(and(...weekClauses))
    .orderBy(asc(ordersTable.created_at));
  const monthRows = await db
    .select()
    .from(ordersTable)
    .where(and(...monthClauses));

  // Bucket weekRows by IST date (YYYY-MM-DD), excluding cancelled orders.
  const byDate = new Map<string, { revenue: number; orderCount: number }>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    byDate.set(key, { revenue: 0, orderCount: 0 });
  }
  let todayRevenue = 0;
  let todayOrderCount = 0;
  for (const r of weekRows) {
    if (r.status === 'cancelled') continue;
    const d = new Date(r.created_at);
    const key = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const total = parseFloat(r.total ?? '0') || 0;
    const bucket = byDate.get(key);
    if (bucket) {
      bucket.revenue += total;
      bucket.orderCount += 1;
    }
    if (d.getTime() >= todayStart.getTime()) {
      todayRevenue += total;
      todayOrderCount += 1;
    }
  }

  // Top items this month — flatten items JSON, sum qty + revenue per name.
  const byName = new Map<string, { qty: number; revenue: number }>();
  for (const r of monthRows) {
    if (r.status === 'cancelled') continue;
    let items: Array<{ name?: string; qty?: number; price?: number }> = [];
    try {
      const parsed = JSON.parse(r.items || '[]');
      if (Array.isArray(parsed)) items = parsed;
    } catch { /* skip malformed */ }
    for (const it of items) {
      const name = String(it.name || '').trim();
      if (!name) continue;
      const qty = Math.max(1, Math.floor(Number(it.qty) || 1));
      const price = Math.max(0, Number(it.price) || 0);
      const cur = byName.get(name) || { qty: 0, revenue: 0 };
      cur.qty += qty;
      cur.revenue += qty * price;
      byName.set(name, cur);
    }
  }
  const topItemsThisMonth = [...byName.entries()]
    .map(([name, v]) => ({ name, qty: v.qty, revenue: v.revenue }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  // Peak hours: bucket weekRows by IST hour-of-day (0-23). Cancelled
  // orders excluded so the heatmap reflects real demand, not abandoned
  // attempts.
  const peakHoursLast7d = new Array(24).fill(0) as number[];
  for (const r of weekRows) {
    if (r.status === 'cancelled') continue;
    const d = new Date(r.created_at);
    // Get IST hour via toLocaleString trick.
    const istHourStr = d.toLocaleString('en-GB', {
      timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false,
    });
    const hr = parseInt(istHourStr, 10);
    if (hr >= 0 && hr <= 23) peakHoursLast7d[hr] += 1;
  }

  // Customer retention: how many distinct customer phones ordered
  // ≥2 times this month vs total. Simple, useful for marketing.
  const orderCountByPhone = new Map<string, number>();
  for (const r of monthRows) {
    if (r.status === 'cancelled') continue;
    const phone = (r.customer_phone || '').trim();
    if (!phone) continue;
    orderCountByPhone.set(phone, (orderCountByPhone.get(phone) || 0) + 1);
  }
  const totalCustomers = orderCountByPhone.size;
  const repeatCustomers = [...orderCountByPhone.values()].filter((n) => n >= 2).length;
  const repeatPct = totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 100) : 0;

  return {
    todayRevenue,
    todayOrderCount,
    last7DaysRevenue: [...byDate.entries()].map(([date, v]) => ({ date, revenue: v.revenue, orderCount: v.orderCount })),
    topItemsThisMonth,
    peakHoursLast7d,
    customerRetention: { totalCustomers, repeatCustomers, repeatPct },
  };
}

// Per-outlet revenue breakdown for the multi-outlet overview panel
// (Phase 3J). Returns a map keyed by outlet_id with this-month
// revenue + order count. Cancelled orders are excluded — same
// convention as getRestaurantStats. Single-outlet kitchens still
// get a single 'main' entry (synthetic).
export async function getRevenueByOutletThisMonth(
  clientId: string
): Promise<Map<string, { revenue: number; orderCount: number }>> {
  const now = new Date();
  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      outlet_id: ordersTable.outlet_id,
      total: ordersTable.total,
      status: ordersTable.status,
    })
    .from(ordersTable)
    .where(and(eq(ordersTable.client_id, clientId), gte(ordersTable.created_at, monthStart)));

  const out = new Map<string, { revenue: number; orderCount: number }>();
  for (const r of rows) {
    if (r.status === 'cancelled') continue;
    const id = r.outlet_id || 'main';
    const cur = out.get(id) || { revenue: 0, orderCount: 0 };
    cur.revenue += Number(r.total) || 0;
    cur.orderCount += 1;
    out.set(id, cur);
  }
  return out;
}
