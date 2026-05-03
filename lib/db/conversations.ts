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
import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from './index';
import { conversations as conversationsTable } from './schema';
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

export async function getClientConversations(clientId: string): Promise<ConversationRow[]> {
  const rows = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.client_id, clientId))
    .orderBy(asc(conversationsTable.timestamp));
  return rows.map(dbRowToConvo);
}
