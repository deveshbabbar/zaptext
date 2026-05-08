// app/api/cron/grocery-recurring/route.ts
//
// Daily morning cron: prompts grocery customers with active recurring rows
// for today's day-of-week to confirm their regular order. Idempotent —
// `runRecurringForDay` skips rows already marked for today.
//
// Auth: Bearer CRON_SECRET, matching the pattern in
// app/api/cron/morning-summary/route.ts.

import { NextRequest, NextResponse } from 'next/server';
import { runRecurringForDay } from '@/lib/grocery/recurring-orders';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const report = await runRecurringForDay();
  return NextResponse.json({ ok: true, report });
}
