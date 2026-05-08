// app/api/grocery/recurring/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getClientByOwnerUserId } from '@/lib/db/clients';
import { listRecurring, setRecurringActive } from '@/lib/db/grocery-recurring-orders';
import { db } from '@/lib/db';
import { grocery_recurring_orders } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function authzRecurring(id: string) {
  const { userId } = await auth();
  if (!userId) return null;
  const c = await getClientByOwnerUserId(userId);
  if (!c || c.type !== 'grocery') return null;
  const all = await listRecurring(c.client_id);
  return all.find((r) => r.id === id) ?? null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const r = await authzRecurring(id);
  if (!r) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const b = await req.json();
  if (typeof b.is_active !== 'boolean') {
    return NextResponse.json({ error: 'is_active boolean required' }, { status: 400 });
  }
  await setRecurringActive(id, b.is_active);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const r = await authzRecurring(id);
  if (!r) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  await db.delete(grocery_recurring_orders).where(eq(grocery_recurring_orders.id, id));
  return NextResponse.json({ ok: true });
}
