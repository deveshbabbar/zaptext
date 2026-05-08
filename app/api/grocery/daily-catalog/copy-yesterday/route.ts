// app/api/grocery/daily-catalog/copy-yesterday/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getClientByOwnerUserId } from '@/lib/db/clients';
import { copyYesterdayToToday } from '@/lib/db/grocery-daily-catalog';
import { todayIsoIST, yesterdayIsoIST } from '@/lib/grocery/date-utils';

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const c = await getClientByOwnerUserId(userId);
  if (!c || c.type !== 'grocery') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const count = await copyYesterdayToToday(c.client_id, todayIsoIST(), yesterdayIsoIST());
  return NextResponse.json({ ok: true, count });
}
