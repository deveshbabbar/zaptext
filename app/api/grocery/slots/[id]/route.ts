import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getClientByOwnerUserId } from '@/lib/db/clients';
import { getSlot, updateSlot, deleteSlot } from '@/lib/db/grocery-slots';

async function authzSlot(id: string) {
  const { userId } = await auth();
  if (!userId) return null;
  const c = await getClientByOwnerUserId(userId);
  if (!c || c.type !== 'grocery') return null;
  const s = await getSlot(id);
  if (!s || s.client_id !== c.client_id) return null;
  return s;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const s = await authzSlot(id);
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const b = await req.json();
  await updateSlot(id, {
    label: b.label,
    start_time: b.start_time,
    end_time: b.end_time,
    cutoff_time: b.cutoff_time,
    days_of_week: Array.isArray(b.days_of_week) ? b.days_of_week.map(Number) : undefined,
    is_active: b.is_active,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const s = await authzSlot(id);
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  await deleteSlot(id);
  return NextResponse.json({ ok: true });
}
