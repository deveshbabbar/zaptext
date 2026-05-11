import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { getBookingsForDate, getBookingsByClient } from '@/lib/db/bookings';
import { getISTDate } from '@/lib/utils';
import { PageTopbar, PageHead, Pill, Kpi, Panel, StatusPill } from '@/components/app/primitives';

export default async function SalonOverviewPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'salon') redirect('/client/dashboard');
  const today = getISTDate();
  const [todayAppts, pending] = await Promise.all([
    getBookingsForDate(user.activeBot.client_id, today).catch(() => []),
    getBookingsByClient(user.activeBot.client_id, 'pending_approval').catch(() => []),
  ]);
  let services: Array<{ category?: string; items?: unknown[] }> = [];
  try {
    const kb = user.activeBot.knowledge_base_json ? (JSON.parse(user.activeBot.knowledge_base_json) as Record<string, unknown>) : {};
    if (Array.isArray(kb.services)) services = kb.services as Array<{ category?: string; items?: unknown[] }>;
  } catch { /* ignore */ }
  const totalServices = services.reduce((n, c) => n + (Array.isArray(c.items) ? c.items.length : 0), 0);

  return (
    <>
      <PageTopbar
        crumbs={<>Salon / <b className="text-foreground">Overview</b></>}
        actions={<Pill variant="ink" href="/client/salon/services">Manage services</Pill>}
      />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead title={<>{user.activeBot.business_name} <span className="zt-serif">workspace.</span></>} sub="Today's appointments, services, and team activity." />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Kpi label="Services" value={totalServices} trend={totalServices === 0 ? 'Start with Bulk import' : `${services.length} section${services.length === 1 ? '' : 's'}`} />
          <Kpi label="Appointments today" value={todayAppts.length} />
          <Kpi label="Confirmed today" value={todayAppts.filter((b) => b.status === 'confirmed').length} />
          <Kpi label="Pending approvals" value={pending.length} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <Panel title="Quick actions">
            <div className="grid grid-cols-2 gap-2.5">
              <Pill variant="ghost" href="/client/salon/services">💇 Services ({totalServices})</Pill>
              <Pill variant="ghost" href="/client/salon/appointments">📅 Appointments ({todayAppts.length})</Pill>
              <Pill variant="ghost" href="/client/staff">👥 Staff</Pill>
              <Pill variant="ghost" href="/client/settings">⚙️ Bot settings</Pill>
            </div>
          </Panel>
          <Panel title="Today's appointments" sub={`${todayAppts.length} for ${today}`}>
            {todayAppts.length === 0 ? (
              <div className="text-[13px] text-[var(--mute)] py-2">No appointments booked for today.</div>
            ) : (
              <ul className="flex flex-col">
                {todayAppts.slice(0, 6).map((b) => (
                  <li key={b.booking_id} className="flex items-center justify-between gap-3 py-2 border-b border-[var(--line)] last:border-b-0">
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold truncate">{b.customer_name || b.customer_phone}</div>
                      <div className="text-[11.5px] text-[var(--mute)] zt-mono uppercase tracking-[.06em]">{b.time_slot}{b.service ? ` · ${b.service}` : ''}</div>
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
