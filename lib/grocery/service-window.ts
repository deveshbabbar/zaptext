// lib/grocery/service-window.ts
//
// Did this customer message this bot within the last 24 hours? If yes, free-
// form replies are allowed under Meta WhatsApp policy. If no, only utility
// templates can be sent — and v1 has no utility template registered for the
// recurring-order prompt, so we skip out-of-window customers.
//
// Source of truth: the `conversations` table, which logs every inbound and
// outbound message via the webhook hot-path. We filter by direction='incoming'
// because Meta's 24hr service window is reset only by *customer-initiated*
// messages, not bot-side outbound.

import { and, desc, eq, gte } from 'drizzle-orm';
import { db } from '../db/index';
import { conversations } from '../db/schema';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export async function isWithinServiceWindow(
  client_id: string,
  customer_phone: string
): Promise<boolean> {
  const cutoff = new Date(Date.now() - TWENTY_FOUR_HOURS_MS);
  const rows = await db
    .select({ ts: conversations.timestamp })
    .from(conversations)
    .where(
      and(
        eq(conversations.client_id, client_id),
        eq(conversations.customer_phone, customer_phone),
        eq(conversations.direction, 'incoming'),
        gte(conversations.timestamp, cutoff)
      )
    )
    .orderBy(desc(conversations.timestamp))
    .limit(1);
  return rows.length > 0;
}
