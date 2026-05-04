// ─── Neon-backed pending-payment tracker ─────────────────────────────────
//
// Replaces the Sheets-backed pending_payments table previously implemented
// inline in lib/payments.ts. Same function signatures so the existing
// webhook callers (setPendingPayment / getPendingPayment / clearPendingPayment)
// don't change.
//
// Why it had to move: lib/payments.ts was the last hot-path code in the
// codebase still calling googleapis. Removing Google Cloud credentials would
// have silently broken the [PAY:] flow (bot sends payment ask → waits on
// customer screenshot → looks up the pending row to verify amount/UPI).

import { and, eq } from 'drizzle-orm';
import { db } from './index';
import { pending_payments } from './schema';

const PENDING_TTL_MS = 30 * 60 * 1000;

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export async function setPendingPayment(
  clientId: string,
  customerPhone: string,
  amount: number,
  note: string
): Promise<void> {
  const phone = normalizePhone(customerPhone);
  const expiresAt = new Date(Date.now() + PENDING_TTL_MS);

  // Upsert on the composite PK (client_id, customer_phone). Matches the legacy
  // "find existing row and overwrite, else append" behavior — but atomic, so
  // two concurrent [PAY:] tags for the same customer can't race.
  await db
    .insert(pending_payments)
    .values({
      client_id: clientId,
      customer_phone: phone,
      amount: String(amount),
      note,
      expires_at: expiresAt,
    })
    .onConflictDoUpdate({
      target: [pending_payments.client_id, pending_payments.customer_phone],
      set: {
        amount: String(amount),
        note,
        expires_at: expiresAt,
      },
    });
}

export async function getPendingPayment(
  clientId: string,
  customerPhone: string
): Promise<{ amount: number; note: string } | null> {
  const phone = normalizePhone(customerPhone);
  const rows = await db
    .select()
    .from(pending_payments)
    .where(and(eq(pending_payments.client_id, clientId), eq(pending_payments.customer_phone, phone)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  // TTL check + lazy cleanup. Mirrors the legacy implementation which
  // best-effort-deleted expired rows on read.
  if (!row.expires_at || row.expires_at.getTime() < Date.now()) {
    await clearPendingPayment(clientId, customerPhone).catch(() => {});
    return null;
  }
  const amount = typeof row.amount === 'string' ? parseFloat(row.amount) : Number(row.amount ?? 0);
  return { amount, note: row.note ?? '' };
}

export async function clearPendingPayment(
  clientId: string,
  customerPhone: string
): Promise<void> {
  const phone = normalizePhone(customerPhone);
  await db
    .delete(pending_payments)
    .where(and(eq(pending_payments.client_id, clientId), eq(pending_payments.customer_phone, phone)));
}
