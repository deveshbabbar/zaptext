// app/client/coaching/page.tsx — Coaching workspace overview.

import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { getBookingsForDate, getBookingsByClient } from '@/lib/db/bookings';
import { getISTDate } from '@/lib/utils';
import { PageTopbar, PageHead, Pill, Kpi, Panel, StatusPill } from '@/components/app/primitives';

export default async function CoachingOverviewPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'coaching') redirect('/client/dashboard');

  const today = getISTDate();
  const [todayBookings, pending] = await Promise.all([
    getBookingsForDate(user.activeBot.client_id, today).catch(() => []),
    getBookingsByClient(user.activeBot.client_id, 'pending_approval').catch(() => []),
  ]);

  let courses: Array<Record<string, unknown>> = [];
  try {
    const kb = user.activeBot.knowledge_base_json
      ? (JSON.parse(user.activeBot.knowledge_base_json) as Record<string, unknown>)
      : {};
    if (Array.isArray(kb.coursesOffered)) courses = kb.coursesOffered as Array<Record<string, unknown>>;
  } catch { /* ignore */ }

  return (
    <>
      <PageTopbar
        crumbs={<>Coaching / <b className="text-foreground">Overview</b></>}
        actions={<Pill variant="ink" href="/client/coaching/courses">Manage courses</Pill>}
      />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead
          title={<>{user.activeBot.business_name} <span className="zt-serif">workspace.</span></>}
          sub="Today's classes, fees due, and student inquiries at a glance."
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Kpi label="Courses offered" value={courses.length} trend={courses.length === 0 ? 'Start with Bulk import' : undefined} />
          <Kpi label="Today's classes" value={todayBookings.length} />
          <Kpi label="Pending approvals" value={pending.length} />
          <Kpi label="Confirmed today" value={todayBookings.filter((b) => b.status === 'confirmed').length} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <Panel title="Quick actions" sub="Jump into the most common coaching workflows.">
            <div className="grid grid-cols-2 gap-2.5">
              <Pill variant="ghost" href="/client/coaching/courses">📚 Courses ({courses.length})</Pill>
              <Pill variant="ghost" href="/client/coaching/batches">📅 Batches ({todayBookings.length})</Pill>
              <Pill variant="ghost" href="/client/conversations">💬 Inquiries</Pill>
              <Pill variant="ghost" href="/client/settings">⚙️ Bot settings</Pill>
            </div>
          </Panel>
          <Panel title="Today's batches" sub={`${todayBookings.length} scheduled for ${today}`}>
            {todayBookings.length === 0 ? (
              <div className="text-[13px] text-[var(--mute)] py-2">No classes booked for today.</div>
            ) : (
              <ul className="flex flex-col">
                {todayBookings.slice(0, 6).map((b) => (
                  <li key={b.booking_id} className="flex items-center justify-between gap-3 py-2 border-b border-[var(--line)] last:border-b-0">
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold truncate">{b.customer_name || b.customer_phone}</div>
                      <div className="text-[11.5px] text-[var(--mute)] zt-mono uppercase tracking-[.06em]">
                        {b.time_slot}{b.service ? ` · ${b.service}` : ''}
                      </div>
                    </div>
                    <StatusPill variant={b.status === 'confirmed' || b.status === 'completed' ? 'ok' : b.status === 'cancelled' || b.status === 'no_show' ? 'cancel' : 'pending'}>{b.status}</StatusPill>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
