import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { getBookingsByClient } from '@/lib/db/bookings';
import { getISTDate } from '@/lib/utils';
import { PageTopbar, PageHead, Panel, StatusPill } from '@/components/app/primitives';

export default async function RealEstateVisitsPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'realestate') redirect('/client/dashboard');
  const today = getISTDate();
  const all = await getBookingsByClient(user.activeBot.client_id).catch(() => []);
  const upcoming = all
    .filter((b) => (b.date || '') >= today)
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : (a.time_slot < b.time_slot ? -1 : 1)));
  const byDate = new Map<string, typeof upcoming>();
  for (const b of upcoming) {
    const list = byDate.get(b.date) || [];
    list.push(b);
    byDate.set(b.date, list);
  }
  return (
    <>
      <PageTopbar crumbs={<>Real Estate / <a href="/client/realestate" className="hover:underline">Overview</a> / <b className="text-foreground">Site visits</b></>} />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead title={<>Site <span className="zt-serif">visits.</span></>} sub={`${upcoming.length} upcoming visit${upcoming.length === 1 ? '' : 's'}. WhatsApp confirms and reschedules flow in automatically.`} />
        {upcoming.length === 0 ? (
          <Panel title="No upcoming visits"><p className="text-sm text-muted-foreground">Site-visit bookings will appear here as customers confirm via WhatsApp.</p></Panel>
        ) : (
          <div className="space-y-4">
            {[...byDate.entries()].map(([date, list]) => (
              <Panel key={date} title={date === today ? `Today · ${date}` : date} sub={`${list.length} visit${list.length === 1 ? '' : 's'}`}>
                <ul className="divide-y divide-border">
                  {list.map((b) => (
                    <li key={b.booking_id} className="py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[14px] font-semibold truncate">{b.customer_name || b.customer_phone}</div>
                        <div className="text-[11.5px] text-[var(--mute)] zt-mono uppercase tracking-[.06em]">{b.time_slot}{b.service ? ` · ${b.service}` : ''}{b.notes ? ` · ${b.notes}` : ''}</div>
                      </div>
                      <StatusPill variant={b.status === 'confirmed' || b.status === 'completed' ? 'ok' : b.status === 'cancelled' || b.status === 'no_show' ? 'cancel' : 'pending'}>{b.status}</StatusPill>
                    </li>
                  ))}
                </ul>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
