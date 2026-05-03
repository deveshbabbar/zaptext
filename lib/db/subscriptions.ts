// ─── Neon-backed subscriptions store ───
//
// Drop-in replacement for the subscription functions previously exported
// from lib/subscription.ts. Same SubscriptionRecord shape, same function
// signatures — the 9 importing routes don't change.
//
// Why subscriptions matter for the webhook hot path: every inbound
// WhatsApp message calls getActiveSubscription(client.owner_user_id) to
// decide whether the bot should reply, send a trial-limit upgrade
// prompt, or send the offline message. On Sheets that read alone could
// be 2-4 seconds; on Neon (with the user_id index) it's well under 50 ms.

import { v4 as uuid } from 'uuid';
import { and, desc, eq, gt } from 'drizzle-orm';
import { db } from './index';
import { subscriptions as subscriptionsTable } from './schema';
import type { PlanKey } from '../plans';

export interface SubscriptionRecord {
  userId: string;
  plan: PlanKey;
  status: 'active' | 'expired' | 'cancelled';
  razorpayPaymentId: string;
  razorpayOrderId: string;
  amount: number;
  startDate: string;
  endDate: string;
  createdAt: string;
}

type DbSubRow = typeof subscriptionsTable.$inferSelect;

function dbRowToRecord(row: DbSubRow): SubscriptionRecord {
  return {
    userId: row.user_id,
    plan: row.plan as PlanKey,
    status: row.status as SubscriptionRecord['status'],
    razorpayPaymentId: row.razorpay_payment_id ?? '',
    razorpayOrderId: row.razorpay_order_id ?? '',
    // numeric(12,2) comes back as string from drizzle; coerce to number for
    // the legacy contract.
    amount: typeof row.amount === 'string' ? parseFloat(row.amount) : (row.amount ?? 0),
    startDate: row.start_date ? row.start_date.toISOString() : '',
    endDate: row.end_date ? row.end_date.toISOString() : '',
    createdAt: row.created_at ? row.created_at.toISOString() : '',
  };
}

// Most recent active row whose end_date is still in the future. Matches the
// legacy Sheets implementation which scanned rows newest-first and returned
// the first active+future-end record.
export async function getActiveSubscription(userId: string): Promise<SubscriptionRecord | null> {
  if (!userId) return null;
  const now = new Date();
  const rows = await db
    .select()
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.user_id, userId),
        eq(subscriptionsTable.status, 'active'),
        gt(subscriptionsTable.end_date, now)
      )
    )
    .orderBy(desc(subscriptionsTable.created_at))
    .limit(1);
  return rows[0] ? dbRowToRecord(rows[0]) : null;
}

// Idempotency helper: prevent the same Razorpay payment from creating two
// subscription rows on duplicate /api/payment/verify calls.
export async function getSubscriptionByPaymentId(paymentId: string): Promise<SubscriptionRecord | null> {
  if (!paymentId) return null;
  const rows = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.razorpay_payment_id, paymentId))
    .limit(1);
  return rows[0] ? dbRowToRecord(rows[0]) : null;
}

export async function createSubscription(record: SubscriptionRecord): Promise<void> {
  await db
    .insert(subscriptionsTable)
    .values({
      id: uuid(),
      user_id: record.userId,
      plan: record.plan,
      status: record.status,
      razorpay_payment_id: record.razorpayPaymentId || '',
      razorpay_order_id: record.razorpayOrderId || '',
      amount: String(record.amount ?? 0),
      start_date: record.startDate ? new Date(record.startDate) : new Date(),
      end_date: record.endDate ? new Date(record.endDate) : new Date(),
      created_at: record.createdAt ? new Date(record.createdAt) : new Date(),
    })
    // Skip silently if the same razorpay_payment_id already landed (double
    // verify call). Trials use a per-user empty payment id, so idempotency
    // there is enforced at the application layer instead — see
    // app/api/client/start-trial/route.ts.
    .onConflictDoNothing({ target: subscriptionsTable.razorpay_payment_id });
}

export async function getSubscriptionHistory(userId: string): Promise<SubscriptionRecord[]> {
  if (!userId) return [];
  const rows = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.user_id, userId))
    .orderBy(desc(subscriptionsTable.created_at));
  return rows.map(dbRowToRecord);
}
