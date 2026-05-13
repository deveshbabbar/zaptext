import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { getBookingsForDate, getBookingsByClient } from '@/lib/db/bookings';
import { getISTDate } from '@/lib/utils';
import { PageTopbar, PageHead, Pill, Kpi, Panel, StatusPill } from '@/components/app/primitives';
import { SubTypesChips } from '@/components/client/sub-types-chips';

export default async function TiffinOverviewPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'tiffin') redirect('/client/dashboard');
  const today = getISTDate();
  const [todayDeliveries, pending] = await Promise.all([
    getBookingsForDate(user.activeBot.client_id, today).catch(() => []),
    getBookingsByClient(user.activeBot.client_id, 'pending_approval').catch(() => []),
  ]);
  let plans: Array<Record<string, unknown>> = [];
  let kb: Record<string, unknown> = {};
  try {
    kb = user.activeBot.knowledge_base_json ? (JSON.parse(user.activeBot.knowledge_base_json) as Record<string, unknown>) : {};
    if (Array.isArray(kb.plans)) plans = kb.plans as Array<Record<string, unknown>>;
  } catch { /* ignore */ }

  return (
    <>
      <PageTopbar crumbs={<>Tiffin / <b className="text-foreground">Overview</b></>} actions={<Pill variant="ink" href="/client/tiffin/plans">Manage plans</Pill>} />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead title={<>{user.activeBot.business_name} <span className="zt-serif">workspace.</span></>} sub="Active subscribers, today's delivery route, and weekly menu." />
        <SubTypesChips kb={kb} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Kpi label="Subscription plans" value={plans.length} trend={plans.length === 0 ? 'Bulk import to start' : undefined} />
          <Kpi label="Deliveries today" value={todayDeliveries.length} />
          <Kpi label="Confirmed today" value={todayDeliveries.filter((b) => b.status === 'confirmed').length} />
          <Kpi label="Pending approvals" value={pending.length} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <Panel title="Quick actions">
            <div className="grid grid-cols-2 gap-2.5">
              <Pill variant="ghost" href="/client/tiffin/plans">🍱 Plans ({plans.length})</Pill>
              <Pill variant="ghost" href="/client/tiffin/route">📍 Today&apos;s route ({todayDeliveries.length})</Pill>
              <Pill variant="ghost" href="/client/conversations">💬 Subscribers</Pill>
              <Pill variant="ghost" href="/client/settings">⚙️ Bot settings</Pill>
            </div>
          </Panel>
          <Panel title="Today's deliveries" sub={`${todayDeliveries.length} for ${today}`}>
            {todayDeliveries.length === 0 ? (
              <div className="text-[13px] text-[var(--mute)] py-2">No deliveries scheduled for today.</div>
            ) : (
              <ul className="flex flex-col">
                {todayDeliveries.slice(0, 6).map((b) => (
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
