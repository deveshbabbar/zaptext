// lib/db/grocery-daily-catalog.ts
//
// Per-day price + stock snapshot. Single writer is upsertDailyCatalog,
// called by catalog-parser orchestration and by the admin POST endpoint.
// Unique index on (client_id, product_id, date) makes upsert a single SQL
// statement with ON CONFLICT.

import { and, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from './index';
import { grocery_daily_catalog, grocery_products } from './schema';
import type { CatalogEntry, DailyCatalogRow, GroceryUnit } from '../grocery/types';

type DailyRow = typeof grocery_daily_catalog.$inferSelect;
type ProductRow = typeof grocery_products.$inferSelect;

function rowToDaily(r: DailyRow): DailyCatalogRow {
  return {
    id: r.id,
    client_id: r.client_id,
    product_id: r.product_id,
    date: r.date,
    price_per_unit: parseFloat(r.price_per_unit as unknown as string),
    in_stock: r.in_stock,
    stock_qty:
      r.stock_qty == null ? null : parseFloat(r.stock_qty as unknown as string),
    updated_at: r.updated_at?.toISOString() ?? '',
  };
}

export interface UpsertItem {
  product_id: string;
  price_per_unit: number;
  in_stock: boolean;
  stock_qty?: number | null;
}

export async function upsertDailyCatalog(
  client_id: string,
  date: string, // YYYY-MM-DD
  items: UpsertItem[]
): Promise<void> {
  if (items.length === 0) return;
  for (const item of items) {
    if (item.price_per_unit < 0) {
      throw new Error(
        `upsertDailyCatalog: negative price for product ${item.product_id}`
      );
    }
  }
  await db
    .insert(grocery_daily_catalog)
    .values(
      items.map((it) => ({
        id: randomUUID(),
        client_id,
        product_id: it.product_id,
        date,
        price_per_unit: it.price_per_unit.toFixed(2),
        in_stock: it.in_stock,
        stock_qty: it.stock_qty == null ? null : it.stock_qty.toFixed(2),
      }))
    )
    .onConflictDoUpdate({
      target: [
        grocery_daily_catalog.client_id,
        grocery_daily_catalog.product_id,
        grocery_daily_catalog.date,
      ],
      set: {
        price_per_unit: sql`excluded.price_per_unit`,
        in_stock: sql`excluded.in_stock`,
        stock_qty: sql`excluded.stock_qty`,
        updated_at: sql`now()`,
      },
    });
}

export async function getCatalogForDate(
  client_id: string,
  date: string
): Promise<CatalogEntry[]> {
  const rows = await db
    .select({
      d: grocery_daily_catalog,
      p: grocery_products,
    })
    .from(grocery_daily_catalog)
    .innerJoin(
      grocery_products,
      and(
        eq(grocery_daily_catalog.product_id, grocery_products.id),
        eq(grocery_daily_catalog.client_id, grocery_products.client_id)
      )
    )
    .where(
      and(
        eq(grocery_daily_catalog.client_id, client_id),
        eq(grocery_daily_catalog.date, date)
      )
    )
    .orderBy(grocery_products.name);

  return rows.map((r) => ({
    product: {
      id: r.p.id,
      client_id: r.p.client_id,
      name: r.p.name,
      name_aliases: safeParseArray(r.p.name_aliases),
      unit: r.p.unit as GroceryUnit,
      image_url: r.p.image_url,
      created_at: r.p.created_at?.toISOString() ?? '',
    },
    price_per_unit: parseFloat(r.d.price_per_unit as unknown as string),
    in_stock: r.d.in_stock,
    stock_qty:
      r.d.stock_qty == null ? null : parseFloat(r.d.stock_qty as unknown as string),
  }));
}

function safeParseArray(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export async function copyYesterdayToToday(
  client_id: string,
  todayDate: string,
  yesterdayDate: string
): Promise<number> {
  const yesterdayRows = await db
    .select()
    .from(grocery_daily_catalog)
    .where(
      and(
        eq(grocery_daily_catalog.client_id, client_id),
        eq(grocery_daily_catalog.date, yesterdayDate)
      )
    );

  if (yesterdayRows.length === 0) return 0;

  await upsertDailyCatalog(
    client_id,
    todayDate,
    yesterdayRows.map((r) => ({
      product_id: r.product_id,
      price_per_unit: parseFloat(r.price_per_unit as unknown as string),
      in_stock: r.in_stock,
      stock_qty:
        r.stock_qty == null ? null : parseFloat(r.stock_qty as unknown as string),
    }))
  );

  return yesterdayRows.length;
}
