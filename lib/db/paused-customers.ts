// Per-customer "human is taking over" pause helpers.
//
// The webhook calls isCustomerPaused() before running AI; if the customer
// is paused, the bot stays silent and the owner answers manually via the
// /api/client/conversations/send endpoint.
//
// pauseCustomer / resumeCustomer are upsert/delete; both safe to call
// repeatedly without duplicate-key errors.

import { and, eq } from 'drizzle-orm';
import { db } from './index';
import { paused_customers } from './schema';

export async function isCustomerPaused(
  clientId: string,
  customerPhone: string
): Promise<boolean> {
  const rows = await db
    .select({ until: paused_customers.paused_until })
    .from(paused_customers)
    .where(
      and(
        eq(paused_customers.client_id, clientId),
        eq(paused_customers.customer_phone, customerPhone)
      )
    )
    .limit(1);
  if (rows.length === 0) return false;
  const until = rows[0].until;
  // NULL paused_until == indefinite pause. A future-set value means the
  // pause auto-expires; any past timestamp means the pause has lapsed
  // (treat the row as stale; isCustomerPaused returns false).
  if (until && until.getTime() < Date.now()) return false;
  return true;
}

export async function pauseCustomer(
  clientId: string,
  customerPhone: string,
  byUserId: string,
  reason: string = ''
): Promise<void> {
  await db
    .insert(paused_customers)
    .values({
      client_id: clientId,
      customer_phone: customerPhone,
      paused_by: byUserId,
      reason,
    })
    .onConflictDoUpdate({
      target: [paused_customers.client_id, paused_customers.customer_phone],
      set: {
        paused_at: new Date(),
        paused_until: null,
        paused_by: byUserId,
        reason,
      },
    });
}

export async function resumeCustomer(
  clientId: string,
  customerPhone: string
): Promise<void> {
  await db
    .delete(paused_customers)
    .where(
      and(
        eq(paused_customers.client_id, clientId),
        eq(paused_customers.customer_phone, customerPhone)
      )
    );
}

// Returns the set of customer phones currently paused for this client —
// used by the conversations UI to render a "human takeover" badge on the
// matching threads. Cheap query; the table is small.
export async function listPausedCustomers(clientId: string): Promise<string[]> {
  const rows = await db
    .select({ phone: paused_customers.customer_phone, until: paused_customers.paused_until })
    .from(paused_customers)
    .where(eq(paused_customers.client_id, clientId));
  return rows
    .filter((r) => !r.until || r.until.getTime() >= Date.now())
    .map((r) => r.phone);
}
