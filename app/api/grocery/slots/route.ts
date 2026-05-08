import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getClientByOwnerUserId } from '@/lib/db/clients';
import { listSlots, createSlot } from '@/lib/db/grocery-slots';

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
  return NextResponse.json({ slots: await listSlots(c.client_id) });
}

export async function POST(req: NextRequest) {
  const c = await getCtx();
  if (!c) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const b = await req.json();
  if (!b?.label || !b?.start_time || !b?.end_time || !b?.cutoff_time) {
    return NextResponse.json({ error: 'label, start, end, cutoff required' }, { status: 400 });
  }
  const s = await createSlot({
    client_id: c.client_id,
    label: b.label,
    start_time: b.start_time,
    end_time: b.end_time,
    cutoff_time: b.cutoff_time,
    days_of_week: Array.isArray(b.days_of_week) ? b.days_of_week.map(Number) : undefined,
    is_active: b.is_active !== false,
  });
  return NextResponse.json({ slot: s });
}
