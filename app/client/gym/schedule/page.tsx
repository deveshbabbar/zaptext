import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { getBookingsByClient } from '@/lib/db/bookings';
import { getISTDate } from '@/lib/utils';
import { PageTopbar, PageHead, Panel, StatusPill } from '@/components/app/primitives';

export default async function GymSchedulePage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'gym') redirect('/client/dashboard');
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
      <PageTopbar crumbs={<>Gym / <a href="/client/gym" className="hover:underline">Overview</a> / <b className="text-foreground">Schedule</b></>} />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead title={<>Class <span className="zt-serif">schedule.</span></>} sub={`${upcoming.length} class${upcoming.length === 1 ? '' : 'es'} from today onwards. PT bookings flow in from WhatsApp.`} />
        {upcoming.length === 0 ? (
          <Panel title="No upcoming classes"><p className="text-sm text-muted-foreground">Class slots and PT bookings will appear here.</p></Panel>
        ) : (
          <div className="space-y-4">
            {[...byDate.entries()].map(([date, list]) => (
              <Panel key={date} title={date === today ? `Today · ${date}` : date} sub={`${list.length} class${list.length === 1 ? '' : 'es'}`}>
                <ul className="divide-y divide-border">
                  {list.map((b) => (
                    <li key={b.booking_id} className="py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[14px] font-semibold truncate">{b.customer_name || b.customer_phone}</div>
                        <div className="text-[11.5px] text-[var(--mute)] zt-mono uppercase tracking-[.06em]">{b.time_slot}{b.service ? ` · ${b.service}` : ''}</div>
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
