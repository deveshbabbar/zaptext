// ─── Admin payments view ───
//
// Powers /admin/payments. Returns the full subscriptions log — including
// expired/cancelled rows, which /admin/subscriptions intentionally
// hides. Useful for chasing refunded payments, billing disputes, and
// reconciling captured-but-never-acked Razorpay events. Admin-only.

import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { getAllSubscriptions } from '@/lib/subscription';

export async function GET(req: NextRequest) {
  const user = await getUserRole();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get('status') || '';
  const all = await getAllSubscriptions();
  const filtered = status ? all.filter((s) => s.status === status) : all;

  // Tally per status for the dashboard cards. Total-revenue sums active
  // and expired (paid plans that ran their course); cancelled rows are
  // excluded because that money was refunded.
  const tally: Record<string, number> = {};
  let totalRevenue = 0;
  for (const s of all) {
    tally[s.status] = (tally[s.status] || 0) + 1;
    if (s.status === 'active' || s.status === 'expired') {
      totalRevenue += s.amount || 0;
    }
  }

  return NextResponse.json({
    ok: true,
    filter: { status: status || null },
    totalCount: all.length,
    filteredCount: filtered.length,
    tally,
    totalRevenueRupees: totalRevenue,
    rows: filtered.slice(0, 500),
  });
}
