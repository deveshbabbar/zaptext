import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getClientByOwnerUserId } from '@/lib/db/clients';
import { listGroups, updateGroup, deleteGroup } from '@/lib/db/grocery-substitution-groups';

async function authzGroup(id: string) {
  const { userId } = await auth();
  if (!userId) return null;
  const c = await getClientByOwnerUserId(userId);
  if (!c || c.type !== 'grocery') return null;
  const groups = await listGroups(c.client_id);
  const g = groups.find((x) => x.id === id);
  return g ?? null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const g = await authzGroup(id);
  if (!g) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const b = await req.json();
  await updateGroup(id, {
    name: b.name,
    product_ids: Array.isArray(b.product_ids) ? b.product_ids.map(String) : undefined,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const g = await authzGroup(id);
  if (!g) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  await deleteGroup(id);
  return NextResponse.json({ ok: true });
}
