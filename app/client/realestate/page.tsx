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
  let blockSendIfReraMissing = true;
  try {
    const kb = user.activeBot.knowledge_base_json ? (JSON.parse(user.activeBot.knowledge_base_json) as Record<string, unknown>) : {};
    if (Array.isArray(kb.currentListings)) listings = kb.currentListings as Array<Record<string, unknown>>;
    if (Array.isArray(kb.builderProjects)) builderProjects = kb.builderProjects as Array<Record<string, unknown>>;
    if (typeof kb.blockSendIfReraMissing === 'boolean') blockSendIfReraMissing = kb.blockSendIfReraMissing;
  } catch { /* ignore */ }

  // Compliance gate audit — bot will refuse to share listings missing RERA
  // when blockSendIfReraMissing is true (default). This is the single most
  // common silent demo killer for real-estate bots.
  const missingReraListings = listings.filter((l) => {
    const r = (l.reraNumber as string | undefined)?.trim();
    return !r;
  });
  const missingCarpetArea = listings.filter((l) => {
    const c = (l.carpetAreaSqft as string | number | undefined);
    return c === undefined || c === '' || c === null;
  });

  return (
    <>
      <PageTopbar
        crumbs={<>Real Estate / <b className="text-foreground">Overview</b></>}
        actions={<Pill variant="ink" href="/client/realestate/listings">Manage listings</Pill>}
      />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead title={<>{user.activeBot.business_name} <span className="zt-serif">workspace.</span></>} sub="Listings, site visits, and active leads at a glance." />

        {/* RERA compliance gate — surfaces silent send-blocks that would
            otherwise only appear as the bot refusing to answer customers. */}
        {(missingReraListings.length > 0 || missingCarpetArea.length > 0) && (
          <div
            className="mb-5 rounded-[12px] border"
            style={{
              padding: '14px 16px',
              borderColor: blockSendIfReraMissing ? '#dc2626' : '#f59e0b',
              background: blockSendIfReraMissing ? '#dc262610' : '#f59e0b10',
            }}
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold mb-1">
                  {blockSendIfReraMissing ? '🚫 RERA compliance gate active' : '⚠ RERA fields missing'}
                </div>
                <div className="text-[12.5px] text-[var(--mute)]">
                  {missingReraListings.length > 0 && (
                    <>
                      <b>{missingReraListings.length}</b> of <b>{listings.length}</b> listings missing RERA number.{' '}
                      {blockSendIfReraMissing
                        ? 'Bot will refuse to share these to customers (RERA Act §4).'
                        : 'Bot will share but without legal disclosure — owner liable.'}
                    </>
                  )}
                  {missingReraListings.length > 0 && missingCarpetArea.length > 0 && <br />}
                  {missingCarpetArea.length > 0 && (
                    <>
                      <b>{missingCarpetArea.length}</b> listings missing carpet-area (RERA-mandated metric).
                    </>
                  )}
                </div>
              </div>
              <Pill variant="ink" href="/client/realestate/listings">Fix listings</Pill>
            </div>
          </div>
        )}

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
