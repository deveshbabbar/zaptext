// ─── Atomic usage counters ───
//
// The webhook used to count outbound rows in `conversations` and apply
// the quota check before sending a reply. Under concurrency two messages
// could both read used=N, both pass the cap check, and both insert,
// putting a bot above its monthly cap. This module replaces that pattern
// with an atomic INSERT … ON CONFLICT DO UPDATE … RETURNING that hands
// back the post-increment count in one round-trip.

import { sql } from 'drizzle-orm';
import { db } from './index';
import { usage_counters } from './schema';

// Returns the period_key for a Date in UTC. Monthly bucketing is precise
// enough for billing (off by at most ~5h30m at the IST/UTC boundary, well
// inside the soft-cap warning window).
export function monthKey(d: Date = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// Atomic increment-and-return. Caller compares `count` to its plan cap to
// decide whether to allow / soft-warn / refuse.
//
// ON CONFLICT (client_id, period_key) DO UPDATE — the composite primary
// key on the table makes the conflict target inferable from the column
// list passed to onConflictDoUpdate.
export async function incrementUsageAtomic(
  clientId: string,
  periodKey: string
): Promise<{ count: number }> {
  const rows = await db
    .insert(usage_counters)
    .values({
      client_id: clientId,
      period_key: periodKey,
      count: 1,
      period_start: new Date(),
      updated_at: new Date(),
    })
    .onConflictDoUpdate({
      target: [usage_counters.client_id, usage_counters.period_key],
      set: {
        count: sql`${usage_counters.count} + 1`,
        updated_at: new Date(),
      },
    })
    .returning({ count: usage_counters.count });
  return { count: rows[0]?.count ?? 0 };
}

// Read-only — used by the /admin/quota dashboard. Doesn't increment.
export async function getUsageForClient(
  clientId: string,
  periodKey: string
): Promise<number> {
  const rows = await db
    .select({ count: usage_counters.count })
    .from(usage_counters)
    .where(sql`${usage_counters.client_id} = ${clientId} AND ${usage_counters.period_key} = ${periodKey}`)
    .limit(1);
  return rows[0]?.count ?? 0;
}
