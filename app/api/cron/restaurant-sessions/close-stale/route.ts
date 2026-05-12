// Auto-close stale restaurant table sessions.
//
// Webhook traffic already triggers an opportunistic sweep, but tables with
// zero post-scan activity (customer scans → never orders → never messages
// again) would otherwise stay open indefinitely. This cron runs every 15
// minutes and closes any session inactive for >2 hours, stamping
// closed_reason='timeout'.
//
// We deliberately do NOT send a bill on cron-timeout closes — the customer
// who never engaged shouldn't get a surprise WhatsApp from us hours later.
// Bills are sent by the manager-close path or when orders actually exist.
//
// Schedule: every 15 min in vercel.json. Authed by Bearer CRON_SECRET.

import { NextRequest, NextResponse } from 'next/server';
import { closeStaleSessions } from '@/lib/db/restaurant-dine-in';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const closedCount = await closeStaleSessions();
    return NextResponse.json({ ok: true, closed: closedCount });
  } catch (err) {
    console.error('[cron] close-stale restaurant sessions failed', err);
    return NextResponse.json({ ok: false, error: 'sweep failed' }, { status: 500 });
  }
}
