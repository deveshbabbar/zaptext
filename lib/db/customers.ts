// ─── Cross-source customer aggregator ───────────────────────────────────
//
// Pulls every unique customer_phone that has interacted with a client's
// bot from FOUR sources and merges them into a single per-phone summary:
//
//   1. conversations    — anyone who sent a WhatsApp message (no name)
//   2. bookings         — anyone who booked an appointment / table
//   3. dine_in_orders   — anyone who placed a restaurant order
//      (dine-in / takeaway / delivery via /m menu page or QR)
//   4. grocery_orders   — anyone who placed a grocery order
//
// We GROUP BY customer_phone at the SQL layer (4 parallel queries) so a
// busy client with 10k+ rows per source still gets one short response.
// Names are merged in JS — bookings/dine_in/grocery each carry the
// freshest customer-supplied name; we pick the most recent non-empty.
// conversations has no name field, so messages-only customers show "".

import { eq, sql, max, count } from 'drizzle-orm';
import { db } from './index';
import {
  conversations as conversationsTable,
  bookings as bookingsTable,
  dine_in_orders as dineInOrdersTable,
  grocery_orders as groceryOrdersTable,
} from './schema';

export type CustomerSource = 'chat' | 'bookings' | 'orders' | 'grocery';

export interface CustomerSummary {
  phone: string;                       // raw E.164 / digits as stored
  name: string;                        // best available (may be "")
  sources: CustomerSource[];           // which tables we saw this phone in
  messageCount: number;
  bookingCount: number;
  orderCount: number;
  groceryOrderCount: number;
  firstSeen: string;                   // ISO-8601, earliest across sources
  lastSeen: string;                    // ISO-8601, latest across sources
}

interface NameCandidate {
  name: string;
  at: number; // epoch ms
}

function bumpName(
  best: NameCandidate | null,
  name: string,
  at: Date | null
): NameCandidate | null {
  const trimmed = (name || '').trim();
  if (!trimmed) return best;
  const ts = at ? at.getTime() : 0;
  if (!best || ts > best.at) return { name: trimmed, at: ts };
  return best;
}

function bumpDate(current: Date | null, candidate: Date | null, mode: 'min' | 'max'): Date | null {
  if (!candidate) return current;
  if (!current) return candidate;
  if (mode === 'max') return candidate.getTime() > current.getTime() ? candidate : current;
  return candidate.getTime() < current.getTime() ? candidate : current;
}

interface Acc {
  phone: string;
  bestName: NameCandidate | null;
  sources: Set<CustomerSource>;
  messageCount: number;
  bookingCount: number;
  orderCount: number;
  groceryOrderCount: number;
  first: Date | null;
  last: Date | null;
}

function ensure(map: Map<string, Acc>, phone: string): Acc {
  let row = map.get(phone);
  if (!row) {
    row = {
      phone,
      bestName: null,
      sources: new Set<CustomerSource>(),
      messageCount: 0,
      bookingCount: 0,
      orderCount: 0,
      groceryOrderCount: 0,
      first: null,
      last: null,
    };
    map.set(phone, row);
  }
  return row;
}

export async function listCustomersForClient(clientId: string): Promise<CustomerSummary[]> {
  if (!clientId) return [];

  // Four parallel GROUP-BY-phone queries — one per source. Each returns
  // (phone, name?, first, last, count). Postgres handles 100k+ rows per
  // source easily; total wall time ≈ max(per-source latency) because all
  // four run concurrently on Neon's HTTP driver.
  const [chatRows, bookingRows, orderRows, groceryRows] = await Promise.all([
    db
      .select({
        phone: conversationsTable.customer_phone,
        first: sql<Date>`MIN(${conversationsTable.timestamp})`,
        last: sql<Date>`MAX(${conversationsTable.timestamp})`,
        count: count(),
      })
      .from(conversationsTable)
      .where(eq(conversationsTable.client_id, clientId))
      .groupBy(conversationsTable.customer_phone),
    db
      .select({
        phone: bookingsTable.customer_phone,
        name: bookingsTable.customer_name,
        first: sql<Date>`MIN(${bookingsTable.created_at})`,
        last: max(bookingsTable.created_at),
        count: count(),
      })
      .from(bookingsTable)
      .where(eq(bookingsTable.client_id, clientId))
      .groupBy(bookingsTable.customer_phone, bookingsTable.customer_name),
    db
      .select({
        phone: dineInOrdersTable.customer_phone,
        name: dineInOrdersTable.customer_name,
        first: sql<Date>`MIN(${dineInOrdersTable.created_at})`,
        last: max(dineInOrdersTable.created_at),
        count: count(),
      })
      .from(dineInOrdersTable)
      .where(eq(dineInOrdersTable.client_id, clientId))
      .groupBy(dineInOrdersTable.customer_phone, dineInOrdersTable.customer_name),
    db
      .select({
        phone: groceryOrdersTable.customer_phone,
        name: groceryOrdersTable.customer_name,
        first: sql<Date>`MIN(${groceryOrdersTable.created_at})`,
        last: max(groceryOrdersTable.created_at),
        count: count(),
      })
      .from(groceryOrdersTable)
      .where(eq(groceryOrdersTable.client_id, clientId))
      .groupBy(groceryOrdersTable.customer_phone, groceryOrdersTable.customer_name),
  ]);

  const merged = new Map<string, Acc>();

  for (const r of chatRows) {
    if (!r.phone) continue;
    const acc = ensure(merged, r.phone);
    acc.sources.add('chat');
    acc.messageCount += Number(r.count || 0);
    acc.first = bumpDate(acc.first, r.first ?? null, 'min');
    acc.last = bumpDate(acc.last, r.last ?? null, 'max');
  }

  for (const r of bookingRows) {
    if (!r.phone) continue;
    const acc = ensure(merged, r.phone);
    acc.sources.add('bookings');
    acc.bookingCount += Number(r.count || 0);
    acc.first = bumpDate(acc.first, r.first ?? null, 'min');
    acc.last = bumpDate(acc.last, r.last ?? null, 'max');
    acc.bestName = bumpName(acc.bestName, r.name ?? '', r.last ?? null);
  }

  for (const r of orderRows) {
    if (!r.phone) continue;
    const acc = ensure(merged, r.phone);
    acc.sources.add('orders');
    acc.orderCount += Number(r.count || 0);
    acc.first = bumpDate(acc.first, r.first ?? null, 'min');
    acc.last = bumpDate(acc.last, r.last ?? null, 'max');
    acc.bestName = bumpName(acc.bestName, r.name ?? '', r.last ?? null);
  }

  for (const r of groceryRows) {
    if (!r.phone) continue;
    const acc = ensure(merged, r.phone);
    acc.sources.add('grocery');
    acc.groceryOrderCount += Number(r.count || 0);
    acc.first = bumpDate(acc.first, r.first ?? null, 'min');
    acc.last = bumpDate(acc.last, r.last ?? null, 'max');
    acc.bestName = bumpName(acc.bestName, r.name ?? '', r.last ?? null);
  }

  const out: CustomerSummary[] = [];
  for (const acc of merged.values()) {
    // Stable source order so the UI badges never flicker.
    const sortedSources: CustomerSource[] = (['chat', 'bookings', 'orders', 'grocery'] as const)
      .filter((s) => acc.sources.has(s));
    out.push({
      phone: acc.phone,
      name: acc.bestName?.name ?? '',
      sources: sortedSources,
      messageCount: acc.messageCount,
      bookingCount: acc.bookingCount,
      orderCount: acc.orderCount,
      groceryOrderCount: acc.groceryOrderCount,
      firstSeen: acc.first ? acc.first.toISOString() : '',
      lastSeen: acc.last ? acc.last.toISOString() : '',
    });
  }

  // Most recently active first — matches the conversations page sort so
  // the two surfaces feel consistent to the owner.
  out.sort((a, b) => (b.lastSeen || '').localeCompare(a.lastSeen || ''));
  return out;
}

// Convenience: aggregate totals for the dashboard header. Avoids the
// caller iterating the array twice.
export function summariseCustomerList(rows: CustomerSummary[]): {
  totalCustomers: number;
  totalMessages: number;
  totalBookings: number;
  totalOrders: number;
  totalGroceryOrders: number;
} {
  let totalMessages = 0;
  let totalBookings = 0;
  let totalOrders = 0;
  let totalGroceryOrders = 0;
  for (const r of rows) {
    totalMessages += r.messageCount;
    totalBookings += r.bookingCount;
    totalOrders += r.orderCount;
    totalGroceryOrders += r.groceryOrderCount;
  }
  return {
    totalCustomers: rows.length,
    totalMessages,
    totalBookings,
    totalOrders,
    totalGroceryOrders,
  };
}
