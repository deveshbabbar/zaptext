// ─── Admin observability snapshot ───
//
// Powers /admin/health. Aggregates health signals from across the
// platform in a single call so the operator gets a one-pane view of:
//   - cron status (last run per task)
//   - subscriptions: active / expiring soon
//   - clients: status mix / churn-risk
//   - bookings: pending_approval queue
// Admin-only.

import { NextResponse } from 'next/server';
import { and, count, desc, eq, gt, lt } from 'drizzle-orm';
import { getUserRole } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  clients,
  subscriptions,
  bookings,
  cron_runs,
  conversations,
} from '@/lib/db/schema';

export async function GET() {
  const user = await getUserRole();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Independent aggregates run in parallel.
  const [
    clientsByStatus,
    activeSubsCount,
    expiringSubsCount,
    pendingBookingsCount,
    last7DaysOutbound,
    cronTasks,
  ] = await Promise.all([
    db.select({ status: clients.status, n: count() }).from(clients).groupBy(clients.status),
    db
      .select({ n: count() })
      .from(subscriptions)
      .where(and(eq(subscriptions.status, 'active'), gt(subscriptions.end_date, now))),
    db
      .select({ n: count() })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, 'active'),
          gt(subscriptions.end_date, now),
          lt(subscriptions.end_date, new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000))
        )
      ),
    db.select({ n: count() }).from(bookings).where(eq(bookings.status, 'pending_approval')),
    db
      .select({ n: count() })
      .from(conversations)
      .where(
        and(eq(conversations.direction, 'outgoing'), gt(conversations.timestamp, sevenDaysAgo))
      ),
    db.select().from(cron_runs).orderBy(desc(cron_runs.started_at)).limit(25),
  ]);

  // Bots with no inbound traffic in last 30 days — churn-risk signal.
  const recentlyActive = await db
    .selectDistinct({ client_id: conversations.client_id })
    .from(conversations)
    .where(
      and(eq(conversations.direction, 'incoming'), gt(conversations.timestamp, thirtyDaysAgo))
    );
  const recentlyActiveSet = new Set(recentlyActive.map((r) => r.client_id));
  const allClients = await db
    .select({ client_id: clients.client_id, status: clients.status })
    .from(clients);
  const churnRiskCount = allClients.filter(
    (c) => c.status === 'active' && !recentlyActiveSet.has(c.client_id)
  ).length;

  // Compress cron rows into per-task latest summary the UI can render
  // without heavy logic.
  const cronByTask = new Map<
    string,
    { lastStartedAt: string; lastFinishedAt: string | null; lastOk: boolean; inFlight: boolean }
  >();
  for (const r of cronTasks) {
    if (!cronByTask.has(r.task)) {
      cronByTask.set(r.task, {
        lastStartedAt: r.started_at ? r.started_at.toISOString() : '',
        lastFinishedAt: r.finished_at ? r.finished_at.toISOString() : null,
        lastOk: r.ok,
        inFlight: !r.finished_at,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    now: now.toISOString(),
    clients: {
      byStatus: clientsByStatus.map((r) => ({ status: r.status, count: Number(r.n) })),
      churnRiskCount,
    },
    subscriptions: {
      activeCount: Number(activeSubsCount[0]?.n ?? 0),
      expiringIn7DaysCount: Number(expiringSubsCount[0]?.n ?? 0),
    },
    bookings: {
      pendingApprovalCount: Number(pendingBookingsCount[0]?.n ?? 0),
    },
    messages: {
      outboundLast7Days: Number(last7DaysOutbound[0]?.n ?? 0),
    },
    cron: {
      tasks: Array.from(cronByTask.entries()).map(([task, v]) => ({ task, ...v })),
      recent: cronTasks.slice(0, 10).map((r) => ({
        task: r.task,
        startedAt: r.started_at?.toISOString() ?? '',
        finishedAt: r.finished_at?.toISOString() ?? null,
        ok: r.ok,
      })),
    },
  });
}
