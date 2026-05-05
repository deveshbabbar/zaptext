// ─── Admin audit-log read endpoint ───
//
// Powers /admin/audit-log. Returns recent admin mutations in newest-first
// order. Admin-only.

import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { listAuditLog } from '@/lib/db/audit-log';

export async function GET(req: NextRequest) {
  const user = await getUserRole();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const limitRaw = parseInt(req.nextUrl.searchParams.get('limit') || '200', 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(1000, limitRaw)) : 200;
  const rows = await listAuditLog(limit);
  return NextResponse.json({ ok: true, count: rows.length, rows });
}
