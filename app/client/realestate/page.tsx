import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { getBookingsForDate, getBookingsByClient } from '@/lib/db/bookings';
import { getISTDate } from '@/lib/utils';
import { PageTopbar, PageHead, Pill, Kpi, Panel, StatusPill } from '@/components/app/primitives';

export default async function RealEstateOverviewPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'realestate') redirect('/client/dashboard');
  const today = getISTDate();
  const [todayVisits, pending] = await Promise.all([
    getBookingsForDate(user.activeBot.client_id, today).catch(() => []),
    getBookingsByClient(user.activeBot.client_id, 'pending_approval').catch(() => []),
  ]);
  let listings: Array<Record<string, unknown>> = [];
  let builderProjects: Array<Record<string, unknown>> = [];
  try {
    const kb = user.activeBot.knowledge_base_json ? (JSON.parse(user.activeBot.knowledge_base_json) as Record<string, unknown>) : {};
    if (Array.isArray(kb.currentListings)) listings = kb.currentListings as Array<Record<string, unknown>>;
    if (Array.isArray(kb.builderProjects)) builderProjects = kb.builderProjects as Array<Record<string, unknown>>;
  } catch { /* ignore */ }

  return (
    <>
      <PageTopbar
        crumbs={<>Real Estate / <b className="text-foreground">Overview</b></>}
        actions={<Pill variant="ink" href="/client/realestate/listings">Manage listings</Pill>}
      />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead title={<>{user.activeBot.business_name} <span className="zt-serif">workspace.</span></>} sub="Listings, site visits, and active leads at a glance." />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Kpi label="Active listings" value={listings.length} trend={listings.length === 0 ? 'Bulk-import to get started' : undefined} />
          <Kpi label="Builder projects" value={builderProjects.length} />
          <Kpi label="Site visits today" value={todayVisits.length} />
          <Kpi label="Pending approvals" value={pending.length} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <Panel title="Quick actions" sub="Real-estate workflows.">
            <div className="grid grid-cols-2 gap-2.5">
              <Pill variant="ghost" href="/client/realestate/listings">🏠 Listings ({listings.length})</Pill>
              <Pill variant="ghost" href="/client/realestate/visits">📅 Site visits ({todayVisits.length})</Pill>
              <Pill variant="ghost" href="/client/conversations">💬 Leads</Pill>
              <Pill variant="ghost" href="/client/settings">⚙️ Bot settings</Pill>
            </div>
          </Panel>
          <Panel title="Site visits today" sub={`${todayVisits.length} scheduled for ${today}`}>
            {todayVisits.length === 0 ? (
              <div className="text-[13px] text-[var(--mute)] py-2">No site visits booked for today.</div>
            ) : (
              <ul className="flex flex-col">
                {todayVisits.slice(0, 6).map((b) => (
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
