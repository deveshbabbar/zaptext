// app/client/restaurant/page.tsx
//
// Restaurant workspace overview. KPI cards for today's bookings + quick
// links into the four sub-pages (Menu, Orders, Tables, Specials). Mirrors
// the structure of /admin/grocery/page.tsx so users moving between bots
// get a consistent feel.

import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { getBookingsForDate, getBookingsByClient } from '@/lib/db/bookings';
import { getISTDate } from '@/lib/utils';
import { PageTopbar, PageHead, Pill, Kpi, Panel, StatusPill } from '@/components/app/primitives';

export default async function RestaurantOverviewPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'restaurant') {
    redirect('/client/dashboard');
  }
  const clientId = user.activeBot.client_id;
  const today = getISTDate();

  const [todayBookings, pending] = await Promise.all([
    getBookingsForDate(clientId, today).catch(() => []),
    getBookingsByClient(clientId, 'pending_approval').catch(() => []),
  ]);

  const confirmedToday = todayBookings.filter((b) => b.status === 'confirmed').length;
  const cancelledToday = todayBookings.filter((b) => b.status === 'cancelled').length;
  // Parse menuCategories out of the bot's knowledge_base_json (the same field
  // the menu editor + onboarding form write to). Tolerate malformed JSON.
  let menuCategories: Array<{ items?: unknown[] }> = [];
  try {
    const kb = user.activeBot.knowledge_base_json
      ? (JSON.parse(user.activeBot.knowledge_base_json) as Record<string, unknown>)
      : {};
    if (Array.isArray(kb.menuCategories)) {
      menuCategories = kb.menuCategories as Array<{ items?: unknown[] }>;
    }
  } catch {
    // ignore — bad JSON just means we render zero items
  }
  const totalMenuItems = menuCategories.reduce(
    (n, c) => n + (Array.isArray(c.items) ? c.items.length : 0),
    0
  );

  return (
    <>
      <PageTopbar
        crumbs={
          <>
            Restaurant / <b className="text-foreground">Overview</b>
          </>
        }
        actions={
          <Pill variant="ink" href="/client/restaurant/menu">
            Manage menu
          </Pill>
        }
      />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead
          title={
            <>
              {user.activeBot.business_name}{' '}
              <span className="zt-serif">workspace.</span>
            </>
          }
          sub="Today's bookings, menu changes, and order activity at a glance."
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Kpi
            label="Today's bookings"
            value={todayBookings.length}
            trend={
              pending.length > 0 ? `${pending.length} pending overall` : undefined
            }
          />
          <Kpi label="Confirmed today" value={confirmedToday} />
          <Kpi label="Cancelled today" value={cancelledToday} />
          <Kpi
            label="Menu items"
            value={totalMenuItems}
            trend={
              totalMenuItems === 0
                ? 'No menu set — start with Bulk Import'
                : `${menuCategories.length} section${menuCategories.length === 1 ? '' : 's'}`
            }
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <Panel
            title="Quick actions"
            sub="Jump into the most common restaurant workflows."
          >
            <div className="grid grid-cols-2 gap-2.5">
              <Pill variant="ghost" href="/client/restaurant/menu">
                🍽️ Menu ({totalMenuItems})
              </Pill>
              <Pill variant="ghost" href="/client/restaurant/orders">
                📦 Today&apos;s orders
              </Pill>
              <Pill variant="ghost" href="/client/restaurant/tables">
                🪑 Table bookings ({todayBookings.length})
              </Pill>
              <Pill variant="ghost" href="/client/restaurant/specials">
                ⭐ Daily specials
              </Pill>
            </div>
          </Panel>

          <Panel
            title="Today's table bookings"
            sub={
              todayBookings.length === 0
                ? `No bookings on the books for ${today}.`
                : `${todayBookings.length} booking${todayBookings.length === 1 ? '' : 's'} for ${today}`
            }
            action={
              todayBookings.length > 0 ? (
                <a href="/client/restaurant/tables">View all</a>
              ) : undefined
            }
          >
            {todayBookings.length === 0 ? (
              <div className="text-[13px] text-[var(--mute)] py-2">
                Table reservations will land here as soon as customers confirm via WhatsApp.
              </div>
            ) : (
              <ul className="flex flex-col">
                {todayBookings.slice(0, 6).map((b) => (
                  <li
                    key={b.booking_id}
                    className="flex items-center justify-between gap-3 py-2 border-b border-[var(--line)] last:border-b-0"
                  >
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold truncate">
                        {b.customer_name || b.customer_phone}
                      </div>
                      <div className="text-[11.5px] text-[var(--mute)] zt-mono uppercase tracking-[.06em]">
                        {b.time_slot}
                        {b.service ? ` · ${b.service}` : ''}
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
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
