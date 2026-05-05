// ─── Webhook message dedup (durable, Postgres-backed) ───
//
// Meta's WhatsApp Cloud API will retry the same webhook delivery (with
// the same message id under `messages[].id`) if our 200 OK isn't seen
// within their timeout. The legacy in-memory Set in lib/whatsapp.ts was
// wiped on every Vercel cold start, so two concurrent invocations or a
// retry landing on a fresh instance both reprocessed the message —
// creating duplicate orders, double-bookings and extra LLM calls.
//
// markMessageProcessedIfNew() is the durable check: we INSERT the
// message id with ON CONFLICT DO NOTHING and use the RETURNING clause
// to detect whether a new row was created. First caller wins, every
// later caller (including concurrent ones in a different lambda) sees
// the row already exists and returns false → skip processing.
//
// Old rows are pruned by `pruneProcessedMessages` on a daily cron (Meta
// retries are bounded to under 24h; we keep a 7-day safety window).

import { db } from './index';
import { processed_webhook_messages } from './schema';
import { lt } from 'drizzle-orm';

export async function markMessageProcessedIfNew(messageId: string): Promise<boolean> {
  if (!messageId) return true; // No id = treat as new (don't block processing).
  const result = await db
    .insert(processed_webhook_messages)
    .values({ message_id: messageId })
    .onConflictDoNothing({ target: processed_webhook_messages.message_id })
    .returning({ id: processed_webhook_messages.message_id });
  return result.length > 0;
}

// Daily cleanup. Deletes rows older than `days` days. Returns count pruned.
export async function pruneProcessedMessages(days: number = 7): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await db
    .delete(processed_webhook_messages)
    .where(lt(processed_webhook_messages.processed_at, cutoff))
    .returning({ id: processed_webhook_messages.message_id });
  return result.length;
}
