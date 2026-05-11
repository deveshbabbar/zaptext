import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { getBookingsByClient } from '@/lib/db/bookings';
import { getISTDate } from '@/lib/utils';
import { PageTopbar, PageHead, Panel, StatusPill } from '@/components/app/primitives';

export default async function CoachingBatchesPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'coaching') redirect('/client/dashboard');
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
      <PageTopbar
        crumbs={<>Coaching / <a href="/client/coaching" className="hover:underline">Overview</a> / <b className="text-foreground">Batches</b></>}
      />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead
          title={<>Upcoming <span className="zt-serif">batches.</span></>}
          sub={`${upcoming.length} class${upcoming.length === 1 ? '' : 'es'} from today onwards. Demo / mock-test / orientation bookings flow in from WhatsApp.`}
        />
        {upcoming.length === 0 ? (
          <Panel title="No upcoming batches">
            <p className="text-sm text-muted-foreground">Class slots and demo bookings will appear here as students confirm via WhatsApp.</p>
          </Panel>
        ) : (
          <div className="space-y-4">
            {[...byDate.entries()].map(([date, list]) => (
              <Panel key={date} title={date === today ? `Today · ${date}` : date} sub={`${list.length} class${list.length === 1 ? '' : 'es'}`}>
                <ul className="divide-y divide-border">
                  {list.map((b) => (
                    <li key={b.booking_id} className="py-2 flex items-center justify-between gap-3">
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
              </Panel>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
