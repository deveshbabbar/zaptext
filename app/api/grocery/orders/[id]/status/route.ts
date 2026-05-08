// app/api/grocery/orders/[id]/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getClientByOwnerUserId } from '@/lib/db/clients';
import { getOrder, updateOrderStatus } from '@/lib/db/grocery-orders';
import type { OrderStatus } from '@/lib/grocery/types';

const ALLOWED: OrderStatus[] = ['pending', 'confirmed', 'packed', 'delivered', 'cancelled'];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const c = await getClientByOwnerUserId(userId);
  if (!c || c.type !== 'grocery') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const o = await getOrder(id);
  if (!o || o.client_id !== c.client_id) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const b = await req.json();
  if (!ALLOWED.includes(b.status))
    return NextResponse.json({ error: 'invalid status' }, { status: 400 });
  await updateOrderStatus(id, b.status);
  return NextResponse.json({ ok: true });
}
