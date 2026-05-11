// app/client/restaurant/tables/page.tsx
//
// Table reservations for the active restaurant bot. Reuses the generic
// bookings store — restaurant tables ARE bookings in this schema — and
// renders them grouped by date with today first, then upcoming.

import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { getBookingsByClient } from '@/lib/db/bookings';
import { getISTDate } from '@/lib/utils';
import { PageTopbar, PageHead, Panel, StatusPill } from '@/components/app/primitives';

export default async function RestaurantTablesPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'restaurant') {
    redirect('/client/dashboard');
  }
  const today = getISTDate();
  const all = await getBookingsByClient(user.activeBot.client_id).catch(() => []);

  // Filter to today + future, sort ascending. Past bookings are noise here.
  const upcoming = all
    .filter((b) => (b.date || '') >= today)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (a.time_slot || '') < (b.time_slot || '') ? -1 : 1;
    });

  const byDate = new Map<string, typeof upcoming>();
  for (const b of upcoming) {
    const list = byDate.get(b.date) || [];
    list.push(b);
    byDate.set(b.date, list);
  }

  return (
    <>
      <PageTopbar
        crumbs={
          <>
            Restaurant /{' '}
            <a href="/client/restaurant" className="hover:underline">
              Overview
            </a>{' '}
            / <b className="text-foreground">Table bookings</b>
          </>
        }
      />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead
          title={
            <>
              Table <span className="zt-serif">reservations.</span>
            </>
          }
          sub={`${upcoming.length} upcoming booking${upcoming.length === 1 ? '' : 's'} from today onwards. Cancellations and confirmations flow in from WhatsApp automatically.`}
        />

        {upcoming.length === 0 ? (
          <Panel title="No upcoming bookings">
            <p className="text-sm text-muted-foreground">
              No reservations on the books yet. The bot accepts table requests automatically — you&apos;ll see them here.
            </p>
          </Panel>
        ) : (
          <div className="space-y-4">
            {[...byDate.entries()].map(([date, list]) => (
              <Panel
                key={date}
                title={date === today ? `Today · ${date}` : date}
                sub={`${list.length} booking${list.length === 1 ? '' : 's'}`}
              >
                <ul className="divide-y divide-border">
                  {list.map((b) => (
                    <li key={b.booking_id} className="py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[14px] font-semibold truncate">
                          {b.customer_name || b.customer_phone}
                        </div>
                        <div className="text-[11.5px] text-[var(--mute)] zt-mono uppercase tracking-[.06em]">
                          {b.time_slot}
                          {b.service ? ` · ${b.service}` : ''}
                          {b.notes ? ` · ${b.notes}` : ''}
                        </div>
                      </div>
                      <StatusPill
                        variant={
                          b.status === 'confirmed' || b.status === 'completed'
                            ? 'ok'
                            : b.status === 'cancelled' || b.status === 'no_show'
                              ? 'cancel'
                              : 'pending'
                        }
                      >
                        {b.status}
                      </StatusPill>
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
