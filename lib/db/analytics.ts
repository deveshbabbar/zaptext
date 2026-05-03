// ─── Neon-backed analytics store ───
//
// Drop-in replacement for the analytics functions previously exported from
// lib/google-sheets.ts.
//
// Postgres lets us collapse the legacy "read-then-write" upsert pattern
// (which was 3 round-trips on Sheets) into a single statement using
// INSERT ... ON CONFLICT DO UPDATE. We then run one more query to refresh
// the unique-customers count from the conversations table — this preserves
// the legacy semantics where `unique_customers` is recomputed every time
// from raw conversation rows (so even retroactive inserts are reflected).

import { and, eq, sql } from 'drizzle-orm';
import { db } from './index';
import { analytics as analyticsTable, conversations as conversationsTable } from './schema';
import { getISTDate } from '../utils';
import type { AnalyticsRow } from '../types';

type DbAnalyticsRow = typeof analyticsTable.$inferSelect;

function dbRowToAnalytics(row: DbAnalyticsRow): AnalyticsRow {
  return {
    date: row.date,
    client_id: row.client_id,
    total_messages: row.total_messages,
    unique_customers: row.unique_customers,
  };
}

export async function updateAnalytics(clientId: string, _customerPhone: string): Promise<void> {
  const today = getISTDate(); // 'YYYY-MM-DD' IST

  // Atomically bump total_messages. unique_customers is set to 1 on first
  // insert; the next statement re-derives the true count.
  await db
    .insert(analyticsTable)
    .values({
      date: today,
      client_id: clientId,
      total_messages: 1,
      unique_customers: 1,
    })
    .onConflictDoUpdate({
      target: [analyticsTable.date, analyticsTable.client_id],
      set: {
        total_messages: sql`${analyticsTable.total_messages} + 1`,
      },
    });

  // Re-derive unique_customers from conversations. Postgres `to_char` keeps
  // us in sync with the IST 'YYYY-MM-DD' day boundary regardless of how
  // the conversation timestamps were stored (UTC under the hood).
  const distinctRes = await db.execute<{ count: number }>(
    sql`SELECT COUNT(DISTINCT customer_phone)::int AS count
        FROM ${conversationsTable}
        WHERE ${conversationsTable.client_id} = ${clientId}
          AND to_char(${conversationsTable.timestamp} AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') = ${today}`
  );
  const distinctRows = (distinctRes as unknown as { rows: Array<{ count: number }> }).rows ?? [];
  const uniqueCount = distinctRows[0]?.count ?? 1;

  await db
    .update(analyticsTable)
    .set({ unique_customers: uniqueCount })
    .where(and(eq(analyticsTable.date, today), eq(analyticsTable.client_id, clientId)));
}

export async function getClientAnalytics(
  clientId: string,
  days: number = 7
): Promise<AnalyticsRow[]> {
  // Pull all rows for this client, sort newest-first in memory, take last N.
  // For the volumes we deal with (one row per client per day) this is fine;
  // a date-range filter can be added later if needed.
  const rows = await db
    .select()
    .from(analyticsTable)
    .where(eq(analyticsTable.client_id, clientId));
  return rows
    .map(dbRowToAnalytics)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, days);
}
