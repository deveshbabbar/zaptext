// ─── Admin email-log read endpoint ───
//
// Powers /admin/email-log. Returns recent send outcomes + 24h stat
// counts so the operator can answer "did the booking notification
// actually go out?" without grepping Vercel logs. Admin-only.

import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import {
  listRecentEmails,
  listFailedEmails,
  getEmailStats,
} from '@/lib/db/email-send-log';

export async function GET(req: NextRequest) {
  const user = await getUserRole();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const failedOnly = req.nextUrl.searchParams.get('failed') === '1';
  const limitRaw = parseInt(req.nextUrl.searchParams.get('limit') || '200', 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(1000, limitRaw)) : 200;

  const [rows, stats] = await Promise.all([
    failedOnly ? listFailedEmails(limit) : listRecentEmails(limit),
    getEmailStats(24),
  ]);

  return NextResponse.json({
    ok: true,
    failedOnly,
    count: rows.length,
    stats,
    rows,
  });
}
