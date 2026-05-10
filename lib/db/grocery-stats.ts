// lib/db/grocery-stats.ts
//
// Aggregated KPIs for the grocery admin dashboard. One round-trip per
// metric — small set, runs only on a server-rendered admin page, so no
// need for a single-query mega-aggregation. Today's date is computed in
// IST (every grocery client is in India). The 7-day "active customers"
// window uses Postgres's NOW() against the timestamptz `created_at`
// column; counting DISTINCT customer_phone keeps repeat-buyers from
// inflating the number.

import { and, count, countDistinct, eq, gte, sql, sum } from 'drizzle-orm';
import { db } from './index';
import {
  grocery_orders,
  grocery_products,
  grocery_daily_catalog,
  grocery_recurring_orders,
} from './schema';
import { todayIsoIST } from '../grocery/date-utils';

export interface GroceryStats {
  todayOrderCount: number;
  todayRevenue: number;
  pendingOrderCount: number;
  activeCustomers7d: number;
  productsTotal: number;
  inStockToday: number;
  outOfStockToday: number;
  activeRecurring: number;
}

export async function getGroceryStats(client_id: string): Promise<GroceryStats> {
  const today = todayIsoIST();

  const [
    todayOrdersRow,
    pendingOrdersRow,
    active7dRow,
    productsRow,
    catalogRow,
    activeRecurringRow,
  ] = await Promise.all([
    // Today's order count + revenue. We bucket on slot_date (delivery
    // day) rather than created_at so "Today's orders" matches how the
    // owner thinks about it — orders out for today's slots.
    db
      .select({
        cnt: count(),
        rev: sum(grocery_orders.total),
      })
      .from(grocery_orders)
      .where(
        and(eq(grocery_orders.client_id, client_id), eq(grocery_orders.slot_date, today))
      ),

    // Pending orders (any date — owner needs to act on these regardless
    // of which slot they're scheduled for).
    db
      .select({ cnt: count() })
      .from(grocery_orders)
      .where(
        and(eq(grocery_orders.client_id, client_id), eq(grocery_orders.status, 'pending'))
      ),

    // Distinct customers active in the last 7 days (by created_at).
    db
      .select({ cnt: countDistinct(grocery_orders.customer_phone) })
      .from(grocery_orders)
      .where(
        and(
          eq(grocery_orders.client_id, client_id),
          gte(grocery_orders.created_at, sql`NOW() - INTERVAL '7 days'`)
        )
      ),

    // Total products in the master catalog.
    db
      .select({ cnt: count() })
      .from(grocery_products)
      .where(eq(grocery_products.client_id, client_id)),

    // Today's catalog: in-stock vs out-of-stock split. Uses FILTER so
    // both numbers come back in a single row.
    db
      .select({
        in_stock: sql<number>`COUNT(*) FILTER (WHERE ${grocery_daily_catalog.in_stock} = true)`,
        out_stock: sql<number>`COUNT(*) FILTER (WHERE ${grocery_daily_catalog.in_stock} = false)`,
      })
      .from(grocery_daily_catalog)
      .where(
        and(
          eq(grocery_daily_catalog.client_id, client_id),
          eq(grocery_daily_catalog.date, today)
        )
      ),

    // Active recurring subscriptions.
    db
      .select({ cnt: count() })
      .from(grocery_recurring_orders)
      .where(
        and(
          eq(grocery_recurring_orders.client_id, client_id),
          eq(grocery_recurring_orders.is_active, true)
        )
      ),
  ]);

  const todayOrderCount = Number(todayOrdersRow[0]?.cnt ?? 0);
  const todayRevenue =
    parseFloat((todayOrdersRow[0]?.rev as unknown as string) ?? '0') || 0;
  const pendingOrderCount = Number(pendingOrdersRow[0]?.cnt ?? 0);
  const activeCustomers7d = Number(active7dRow[0]?.cnt ?? 0);
  const productsTotal = Number(productsRow[0]?.cnt ?? 0);
  const inStockToday = Number(catalogRow[0]?.in_stock ?? 0);
  const outOfStockToday = Number(catalogRow[0]?.out_stock ?? 0);
  const activeRecurring = Number(activeRecurringRow[0]?.cnt ?? 0);

  return {
    todayOrderCount,
    todayRevenue,
    pendingOrderCount,
    activeCustomers7d,
    productsTotal,
    inStockToday,
    outOfStockToday,
    activeRecurring,
  };
}
