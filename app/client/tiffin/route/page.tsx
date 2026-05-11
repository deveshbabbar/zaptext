import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { getBookingsForDate } from '@/lib/db/bookings';
import { getISTDate } from '@/lib/utils';
import { PageTopbar, PageHead, Panel, StatusPill } from '@/components/app/primitives';

export default async function TiffinRoutePage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'tiffin') redirect('/client/dashboard');
  const today = getISTDate();
  const deliveries = await getBookingsForDate(user.activeBot.client_id, today).catch(() => []);
  const sorted = [...deliveries].sort((a, b) => (a.time_slot < b.time_slot ? -1 : 1));
  return (
    <>
      <PageTopbar crumbs={<>Tiffin / <a href="/client/tiffin" className="hover:underline">Overview</a> / <b className="text-foreground">Today&apos;s route</b></>} />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead title={<>Today&apos;s <span className="zt-serif">delivery route.</span></>} sub={`${sorted.length} delivery${sorted.length === 1 ? '' : 's'} scheduled for ${today}.`} />
        {sorted.length === 0 ? (
          <Panel title="No deliveries today"><p className="text-sm text-muted-foreground">Subscriber tiffins for today will appear here.</p></Panel>
        ) : (
          <Panel title="Route" sub="Sorted by time slot">
            <ul className="divide-y divide-border">
              {sorted.map((b, i) => (
                <li key={b.booking_id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold truncate">
                      <span className="zt-mono mr-2 text-[var(--mute)]">{String(i + 1).padStart(2, '0')}.</span>
                      {b.customer_name || b.customer_phone}
                    </div>
                    <div className="text-[11.5px] text-[var(--mute)] zt-mono uppercase tracking-[.06em]">
                      {b.time_slot}{b.service ? ` · ${b.service}` : ''}{b.notes ? ` · ${b.notes}` : ''}
                    </div>
                  </div>
                  <StatusPill variant={b.status === 'completed' ? 'ok' : b.status === 'cancelled' || b.status === 'no_show' ? 'cancel' : 'pending'}>{b.status}</StatusPill>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </>
  );
}
