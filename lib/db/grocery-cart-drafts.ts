import { and, eq, lt } from 'drizzle-orm';
import { db } from './index';
import { grocery_cart_drafts } from './schema';
import type { CartDraft } from '../grocery/types';

const TTL_MS = 30 * 60 * 1000;

function key(client_id: string, customer_phone: string): string {
  return `${client_id}:${customer_phone}`;
}

export async function getDraft(
  client_id: string,
  customer_phone: string
): Promise<CartDraft | null> {
  const id = key(client_id, customer_phone);
  const rows = await db
    .select()
    .from(grocery_cart_drafts)
    .where(eq(grocery_cart_drafts.id, id))
    .limit(1);
  if (rows.length === 0) return null;
  const r = rows[0];
  if (r.expires_at.getTime() < Date.now()) {
    await db.delete(grocery_cart_drafts).where(eq(grocery_cart_drafts.id, id));
    return null;
  }
  try {
    return JSON.parse(r.payload) as CartDraft;
  } catch {
    return null;
  }
}

export async function saveDraft(draft: CartDraft): Promise<void> {
  const id = key(draft.client_id, draft.customer_phone);
  const expires_at = new Date(Date.now() + TTL_MS);
  draft.expires_at = expires_at.toISOString();
  await db
    .insert(grocery_cart_drafts)
    .values({
      id,
      client_id: draft.client_id,
      customer_phone: draft.customer_phone,
      payload: JSON.stringify(draft),
      expires_at,
    })
    .onConflictDoUpdate({
      target: grocery_cart_drafts.id,
      set: {
        payload: JSON.stringify(draft),
        expires_at,
      },
    });
}

export async function deleteDraft(client_id: string, customer_phone: string): Promise<void> {
  await db.delete(grocery_cart_drafts).where(eq(grocery_cart_drafts.id, key(client_id, customer_phone)));
}

// Called by the recurring-orders cron (cheap cleanup). Removes expired rows.
export async function purgeExpiredDrafts(): Promise<number> {
  const result = await db
    .delete(grocery_cart_drafts)
    .where(lt(grocery_cart_drafts.expires_at, new Date()))
    .returning({ id: grocery_cart_drafts.id });
  return result.length;
}
