import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getClientByOwnerUserId } from '@/lib/db/clients';
import { listGroups, createGroup } from '@/lib/db/grocery-substitution-groups';

async function getCtx() {
  const { userId } = await auth();
  if (!userId) return null;
  const c = await getClientByOwnerUserId(userId);
  if (!c || c.type !== 'grocery') return null;
  return c;
}

export async function GET() {
  const c = await getCtx();
  if (!c) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ groups: await listGroups(c.client_id) });
}

export async function POST(req: NextRequest) {
  const c = await getCtx();
  if (!c) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const b = await req.json();
  if (!b?.name || !Array.isArray(b?.product_ids)) {
    return NextResponse.json({ error: 'name + product_ids required' }, { status: 400 });
  }
  const g = await createGroup(c.client_id, String(b.name), b.product_ids.map(String));
  return NextResponse.json({ group: g });
}
