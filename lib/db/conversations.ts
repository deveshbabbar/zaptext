// ─── Neon-backed conversations store ───
//
// Drop-in replacement for the conversation-related functions previously
// exported from lib/google-sheets.ts. The hot path here is the WhatsApp
// webhook: every inbound message inserts an "incoming" row, every reply
// inserts an "outgoing" row, and the prompt builder fetches the last
// N messages for context. This was 6+ seconds on Sheets; on Neon it's
// well under 100 ms.
//
// Conversion notes:
// - Legacy ConversationRow has no `id` — Sheets used row position as PK.
//   Postgres needs a real PK, so we synthesize a UUID per row. The id is
//   not surfaced to callers (the legacy shape is preserved on read).
// - timestamp Date → ISO string at the boundary, same as clients.ts.

import { v4 as uuid } from 'uuid';
import { and, asc, desc, eq, gte } from 'drizzle-orm';
import { db } from './index';
import { conversations as conversationsTable, clients as clientsTable } from './schema';
import type { ConversationRow } from '../types';

type DbConvoRow = typeof conversationsTable.$inferSelect;

function dbRowToConvo(row: DbConvoRow): ConversationRow {
  return {
    timestamp: row.timestamp ? row.timestamp.toISOString() : '',
    client_id: row.client_id,
    customer_phone: row.customer_phone,
    direction: row.direction as ConversationRow['direction'],
    message: row.message,
    message_type: row.message_type,
  };
}

// Last `limit` messages for one customer, oldest-first (so the LLM gets
// chronological context). Matches the legacy Sheets implementation which
// took `.slice(-limit)` of an oldest-first array.
export async function getConversationHistory(
  clientId: string,
  customerPhone: string,
  limit: number = 10
): Promise<ConversationRow[]> {
  // Newest-first then reverse — pulls only `limit` rows from the DB instead
  // of the entire conversations log.
  const rows = await db
    .select()
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.client_id, clientId),
        eq(conversationsTable.customer_phone, customerPhone)
      )
    )
    .orderBy(desc(conversationsTable.timestamp))
    .limit(limit);
  return rows.reverse().map(dbRowToConvo);
}

export async function addConversationMessage(msg: ConversationRow): Promise<void> {
  await db.insert(conversationsTable).values({
    id: uuid(),
    timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
    client_id: msg.client_id,
    customer_phone: msg.customer_phone,
    direction: msg.direction,
    message: msg.message,
    message_type: msg.message_type || 'text',
  });
}

// Returns true if the customer has an INCOMING message older than the
// just-arrived one within the last `days` window. Used by the welcome-menu
// flow to decide whether the current message counts as "first contact".
//
// IMPORTANT: assumes the caller has ALREADY logged the current incoming.
// We exclude messages newer than `excludeAfter` (the timestamp of the
// current message) so the freshly-logged row doesn't count itself.
// Returns the number of outbound messages for a client in the CURRENT
// calendar month (UTC-based; close enough for IST since the rollover
// difference is at most 5h30m). Used by the webhook to enforce monthly
// AI-reply caps for paid plans (Starter 2k / Growth 10k / Scale 50k /
// Enterprise 200k). Trial keeps using lifetime count via getClientConversations.
// Per-OWNER lifetime outbound count, summed across every bot the owner
// has. Used by the trial gate so a single Clerk user can't reset their
// 50-message free trial by spinning up new bots — each new bot used to
// start its own 0-count at the per-bot getClientConversations check.
//
// Implemented as a JOIN so we don't N+1 across getBotsByOwner() and run
// one count query per bot.
export async function getOutboundCountForOwner(ownerUserId: string): Promise<number> {
  if (!ownerUserId) return 0;
  const rows = await db
    .select({ id: conversationsTable.id })
    .from(conversationsTable)
    .innerJoin(clientsTable, eq(conversationsTable.client_id, clientsTable.client_id))
    .where(
      and(
        eq(clientsTable.owner_user_id, ownerUserId),
        eq(conversationsTable.direction, 'outgoing')
      )
    );
  return rows.length;
}

export async function getOutboundCountThisMonth(clientId: string): Promise<number> {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const rows = await db
    .select({ id: conversationsTable.id })
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.client_id, clientId),
        eq(conversationsTable.direction, 'outgoing'),
        gte(conversationsTable.timestamp, start)
      )
    );
  return rows.length;
}

export async function hasRecentInboundMessage(
  clientId: string,
  customerPhone: string,
  days: number,
  excludeAfter: Date
): Promise<boolean> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ ts: conversationsTable.timestamp })
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.client_id, clientId),
        eq(conversationsTable.customer_phone, customerPhone),
        eq(conversationsTable.direction, 'incoming'),
        gte(conversationsTable.timestamp, cutoff)
      )
    )
    .limit(50);
  // Exclude the current message via JS — comparing timestamps in Drizzle
  // with Date objects has occasionally been flaky on Neon plans.
  const excludeMs = excludeAfter.getTime();
  return rows.some((r) => r.ts.getTime() < excludeMs);
}

export async function getClientConversations(clientId: string): Promise<ConversationRow[]> {
  const rows = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.client_id, clientId))
    .orderBy(asc(conversationsTable.timestamp));
  return rows.map(dbRowToConvo);
}
