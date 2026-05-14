// Marketing audience helper.
//
// Foundation for any future Marketing-template broadcast feature
// (specials, winback, birthday). Two-part responsibility:
//
//   1. CONSENT GATE — only return customers who have an explicit
//      `marketing_opt_in` event in consent_log AND no later
//      `marketing_opt_out` event. This is the Meta + DPDPA §6
//      pre-condition for any Marketing template.
//
//   2. SEGMENTATION — annotate each opted-in customer with last-order
//      timestamp + days-since-last-order, so the broadcast layer can
//      target subsets (e.g. "lapsed 60d", "active <30d", "all").
//
// Returns nothing else by design — this layer is intentionally PII-
// minimal. Name + address etc. should not leak into broadcast logic
// until the moment of send.

import { db } from '@/lib/db';
import { consent_log, dine_in_orders } from '@/lib/db/schema';
import { and, desc, eq, max, sql } from 'drizzle-orm';

export interface MarketingAudienceRow {
  customer_phone: string;
  opted_in_at: Date;          // most recent marketing_opt_in event
  opted_out_at: Date | null;  // most recent marketing_opt_out (always null in the returned set — opted-out customers are filtered out)
  last_order_at: Date | null;
  days_since_last_order: number | null;  // null when never ordered
}

export interface ListAudienceOptions {
  /** Only customers whose last order is >= `minDaysLapsed` ago.
   *  Null/0 = include all opted-in customers regardless of last order. */
  minDaysLapsed?: number;
  /** Cap on rows returned. Defaults to 5000 — well under WhatsApp's
   *  10,000/day messaging-limit ceiling so a single broadcast batch
   *  cannot saturate the portfolio's send budget. */
  limit?: number;
}

/**
 * Returns the broadcast-eligible audience for one restaurant.
 *
 * A customer appears in the result IFF all are true:
 *   - they have at least one `marketing_opt_in` event for this client
 *   - their most recent marketing event is NOT `marketing_opt_out`
 *   - if `minDaysLapsed` is set, their last order is older than that
 *     (or they never ordered)
 *
 * The query stays portable Postgres — no Drizzle-specific aggregates
 * that don't translate. Two queries are cheaper here than a join
 * because consent_log + dine_in_orders both index on client_id.
 */
export async function listMarketingAudience(
  client_id: string,
  options: ListAudienceOptions = {}
): Promise<MarketingAudienceRow[]> {
  const limit = options.limit && options.limit > 0 ? options.limit : 5000;

  // Step 1 — most-recent consent event per (client, phone). We pull
  // opt-in AND opt-out events, then collapse client-side so we can
  // honour "the latest event wins" semantics without a window function.
  const events = await db
    .select({
      customer_phone: consent_log.customer_phone,
      event_type: consent_log.event_type,
      created_at: consent_log.created_at,
    })
    .from(consent_log)
    .where(
      and(
        eq(consent_log.client_id, client_id),
        sql`${consent_log.event_type} IN ('marketing_opt_in', 'marketing_opt_out')`
      )
    )
    .orderBy(desc(consent_log.created_at));

  // Collapse: walk newest-to-oldest, keep the first event per phone.
  const latestByPhone = new Map<string, { event_type: string; at: Date }>();
  for (const e of events) {
    if (!latestByPhone.has(e.customer_phone)) {
      latestByPhone.set(e.customer_phone, {
        event_type: e.event_type,
        at: new Date(e.created_at),
      });
    }
  }

  // Keep only phones whose LATEST event is opt-in.
  const optedInPhones: string[] = [];
  const optInTime = new Map<string, Date>();
  for (const [phone, ev] of latestByPhone) {
    if (ev.event_type === 'marketing_opt_in') {
      optedInPhones.push(phone);
      optInTime.set(phone, ev.at);
    }
  }

  if (optedInPhones.length === 0) return [];

  // Step 2 — last order per opted-in phone. Single grouped query.
  const lastOrders = await db
    .select({
      customer_phone: dine_in_orders.customer_phone,
      last_order_at: max(dine_in_orders.created_at).as('last_order_at'),
    })
    .from(dine_in_orders)
    .where(
      and(
        eq(dine_in_orders.client_id, client_id),
        sql`${dine_in_orders.customer_phone} = ANY(${optedInPhones})`
      )
    )
    .groupBy(dine_in_orders.customer_phone);

  const lastOrderByPhone = new Map<string, Date>();
  for (const o of lastOrders) {
    if (o.last_order_at) lastOrderByPhone.set(o.customer_phone, new Date(o.last_order_at));
  }

  const now = Date.now();
  const rows: MarketingAudienceRow[] = [];
  for (const phone of optedInPhones) {
    const optedInAt = optInTime.get(phone)!;
    const lastOrderAt = lastOrderByPhone.get(phone) || null;
    const daysSinceLastOrder = lastOrderAt
      ? Math.floor((now - lastOrderAt.getTime()) / 86_400_000)
      : null;

    if (typeof options.minDaysLapsed === 'number' && options.minDaysLapsed > 0) {
      // "Lapsed N days" includes customers who have NEVER ordered —
      // they're also valid for re-engagement once they have opted in.
      if (daysSinceLastOrder !== null && daysSinceLastOrder < options.minDaysLapsed) {
        continue;
      }
    }

    rows.push({
      customer_phone: phone,
      opted_in_at: optedInAt,
      opted_out_at: null,
      last_order_at: lastOrderAt,
      days_since_last_order: daysSinceLastOrder,
    });

    if (rows.length >= limit) break;
  }

  return rows;
}

/**
 * Single-customer check — used at message-send time as a final defence-
 * in-depth gate before issuing an outbound Marketing template. Returns
 * true iff the latest marketing event for (client, phone) is
 * `marketing_opt_in` (never opted out since).
 */
export async function isOptedInToMarketing(
  client_id: string,
  customer_phone: string
): Promise<boolean> {
  const rows = await db
    .select({
      event_type: consent_log.event_type,
    })
    .from(consent_log)
    .where(
      and(
        eq(consent_log.client_id, client_id),
        eq(consent_log.customer_phone, customer_phone),
        sql`${consent_log.event_type} IN ('marketing_opt_in', 'marketing_opt_out')`
      )
    )
    .orderBy(desc(consent_log.created_at))
    .limit(1);

  return rows.length > 0 && rows[0].event_type === 'marketing_opt_in';
}
