// app/client/restaurant/page.tsx
//
// Restaurant workspace overview. KPI cards for today's bookings + quick
// links into the four sub-pages (Menu, Orders, Tables, Specials). Mirrors
// the structure of /admin/grocery/page.tsx so users moving between bots
// get a consistent feel.

import { requireRestaurantViewer } from '@/lib/restaurant/viewer-context';
import { getBookingsForDate, getBookingsByClient } from '@/lib/db/bookings';
import { getRestaurantStats, getRevenueByOutletThisMonth } from '@/lib/db/restaurant-dine-in';
import { getOutletsForClient, isMultiOutletEnabled } from '@/lib/db/outlets';
import { getISTDate } from '@/lib/utils';
import { PageTopbar, PageHead, Pill, Kpi, Panel, StatusPill } from '@/components/app/primitives';
import { SubTypesChips } from '@/components/client/sub-types-chips';

export default async function RestaurantOverviewPage() {
  // Phase 3I v2 — viewer-context. Owner sees chain-wide; outlet
  // manager sees their outlet only. Stats query forwards
  // restrictedOutletId so the KPIs are scoped automatically.
  const viewer = await requireRestaurantViewer();
  const user = { activeBot: viewer.activeBot };
  const clientId = viewer.activeBot.client_id;
  const today = getISTDate();

  const [todayBookings, pending, stats, multiOutlet, outlets, outletRevenue] = await Promise.all([
    getBookingsForDate(clientId, today).catch(() => []),
    getBookingsByClient(clientId, 'pending_approval').catch(() => []),
    getRestaurantStats(clientId, viewer.restrictedOutletId || undefined).catch(() => ({
      todayRevenue: 0, todayOrderCount: 0,
      last7DaysRevenue: [], topItemsThisMonth: [],
      peakHoursLast7d: new Array(24).fill(0),
      customerRetention: { totalCustomers: 0, repeatCustomers: 0, repeatPct: 0 },
    })),
    isMultiOutletEnabled(clientId).catch(() => false),
    getOutletsForClient(clientId).catch(() => []),
    getRevenueByOutletThisMonth(clientId).catch(() => new Map<string, { revenue: number; orderCount: number }>()),
  ]);

  // Per-outlet breakdown table (Phase 3J). Render only for multi-outlet
  // kitchens AND only for OWNERS — outlet managers (3I v2) don't need
  // a cross-outlet comparison; their KPIs are already scoped above.
  const outletBreakdown = multiOutlet && viewer.role === 'owner'
    ? outlets
        .filter((o) => o.isActive)
        .map((o) => {
          const stat = outletRevenue.get(o.id) || { revenue: 0, orderCount: 0 };
          return {
            id: o.id,
            slug: o.slug,
            name: o.name,
            revenue: stat.revenue,
            orderCount: stat.orderCount,
          };
        })
        .sort((a, b) => b.revenue - a.revenue)
    : [];
  const peakRev = Math.max(1, ...stats.last7DaysRevenue.map((d) => d.revenue));
  const peakHourMax = Math.max(1, ...stats.peakHoursLast7d);

  const confirmedToday = todayBookings.filter((b) => b.status === 'confirmed').length;
  const cancelledToday = todayBookings.filter((b) => b.status === 'cancelled').length;
  // Parse menuCategories out of the bot's knowledge_base_json (the same field
  // the menu editor + onboarding form write to). Tolerate malformed JSON.
  let menuCategories: Array<{ items?: unknown[] }> = [];
  let kb: Record<string, unknown> = {};
  try {
    kb = user.activeBot.knowledge_base_json
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
        <SubTypesChips kb={kb} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Kpi
            label="Revenue today"
            value={`₹${Math.round(stats.todayRevenue).toLocaleString('en-IN')}`}
            trend={stats.todayOrderCount > 0 ? `${stats.todayOrderCount} order${stats.todayOrderCount === 1 ? '' : 's'}` : undefined}
          />
          <Kpi
            label="Today's bookings"
            value={todayBookings.length}
            trend={
              pending.length > 0 ? `${pending.length} pending overall` : undefined
            }
          />
          <Kpi label="Confirmed today" value={confirmedToday} />
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

        {/* Revenue + best-sellers analytics row. Lightweight bar-chart
            rendered with CSS — no chart library dep. Only shows when
            there's at least one order in the last 7 days. */}
        {(stats.last7DaysRevenue.some((d) => d.revenue > 0) || stats.topItemsThisMonth.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <Panel
              title="Revenue — last 7 days"
              sub={`₹${Math.round(stats.last7DaysRevenue.reduce((s, d) => s + d.revenue, 0)).toLocaleString('en-IN')} total`}
            >
              {stats.last7DaysRevenue.every((d) => d.revenue === 0) ? (
                <p className="text-[13px] text-[var(--mute)] py-2">No orders yet this week. Once customers start ordering, daily revenue + count will plot here.</p>
              ) : (
                <div className="flex items-end gap-1.5" style={{ height: 140 }}>
                  {stats.last7DaysRevenue.map((d) => {
                    const heightPct = peakRev > 0 ? Math.max(2, (d.revenue / peakRev) * 100) : 2;
                    const dayLabel = new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                        <div className="text-[10.5px] font-semibold text-[var(--ink)] zt-mono">
                          {d.revenue > 0 ? `₹${Math.round(d.revenue).toLocaleString('en-IN')}` : '—'}
                        </div>
                        <div
                          style={{
                            width: '100%',
                            height: `${heightPct}%`,
                            background: 'var(--ink)',
                            borderRadius: '4px 4px 0 0',
                            minHeight: 2,
                          }}
                          title={`${d.date}: ₹${Math.round(d.revenue).toLocaleString('en-IN')} · ${d.orderCount} orders`}
                        />
                        <div className="text-[10.5px] text-[var(--mute)]">{dayLabel}</div>
                        <div className="text-[10px] text-[var(--mute)] zt-mono">{d.orderCount}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>

            <Panel
              title="Best-sellers this month"
              sub={stats.topItemsThisMonth.length === 0 ? 'No completed orders this month yet' : `Top ${stats.topItemsThisMonth.length} of all items`}
            >
              {stats.topItemsThisMonth.length === 0 ? (
                <p className="text-[13px] text-[var(--mute)] py-2">As orders flow in, your kitchen&apos;s top sellers will rank here — useful for menu pricing + planning.</p>
              ) : (
                <ol className="flex flex-col" style={{ counterReset: 'best 0' }}>
                  {stats.topItemsThisMonth.map((it, i) => (
                    <li key={it.name} className="flex items-center justify-between gap-3 py-1.5 border-b border-[var(--line)] last:border-b-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="zt-mono text-[11px] text-[var(--mute)] w-5 text-right">#{i + 1}</span>
                        <span className="text-[13.5px] font-semibold truncate">{it.name}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-[11.5px] text-[var(--mute)] zt-mono">{it.qty} sold</span>
                        <span className="text-[12.5px] font-bold zt-mono">₹{Math.round(it.revenue).toLocaleString('en-IN')}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </div>
        )}

        {/* Peak-hours heatmap + customer retention. Heatmap is 24 vertical
            columns (one per IST hour) — colour intensity scales with order
            count over the last 7 days. Helps owner schedule kitchen + delivery
            staff for actual demand windows, not guessed ones. */}
        {(stats.peakHoursLast7d.some((n) => n > 0) || stats.customerRetention.totalCustomers > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <Panel
              title="Peak hours — last 7 days"
              sub={`Total ${stats.peakHoursLast7d.reduce((s, n) => s + n, 0)} orders · darker = busier window`}
              className="lg:col-span-2"
            >
              {stats.peakHoursLast7d.every((n) => n === 0) ? (
                <p className="text-[13px] text-[var(--mute)] py-2">Once orders start flowing, your busiest hours will plot here — useful for scheduling kitchen + delivery staff at the right times.</p>
              ) : (
                <>
                  <div className="flex items-end gap-[3px]" style={{ height: 110 }}>
                    {stats.peakHoursLast7d.map((count, hr) => {
                      const intensity = peakHourMax > 0 ? count / peakHourMax : 0;
                      const heightPct = Math.max(2, intensity * 100);
                      // Hour band labels for the under-axis
                      const showLabel = hr % 3 === 0;
                      return (
                        <div key={hr} className="flex-1 flex flex-col items-center gap-1" title={`${hr}:00 – ${hr + 1}:00 IST · ${count} orders`}>
                          <div
                            style={{
                              width: '100%',
                              height: `${heightPct}%`,
                              background: `color-mix(in oklab, var(--ink) ${Math.round(intensity * 100)}%, transparent)`,
                              minHeight: count > 0 ? 4 : 2,
                              borderRadius: '3px 3px 0 0',
                              border: count === 0 ? '1px dashed var(--line)' : 'none',
                            }}
                          />
                          {showLabel && (
                            <div className="text-[9.5px] text-[var(--mute)] zt-mono">{hr.toString().padStart(2, '0')}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-[10.5px] text-[var(--mute)] mt-2 text-center">Hour-of-day (IST, 0–23)</div>
                </>
              )}
            </Panel>

            <Panel
              title="Customer retention"
              sub="This month, who came back?"
            >
              {stats.customerRetention.totalCustomers === 0 ? (
                <p className="text-[13px] text-[var(--mute)] py-2">No customers yet this month. Once the first 5-10 orders land, you&apos;ll see how many came back.</p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[.06em] text-[var(--mute)] font-semibold mb-1">Repeat customer rate</div>
                    <div className="text-[34px] font-bold leading-none">{stats.customerRetention.repeatPct}<span className="text-[18px] text-[var(--mute)]">%</span></div>
                  </div>
                  <div className="flex justify-between text-[12.5px] pt-2 border-t border-[var(--line)]">
                    <div>
                      <div className="font-bold text-[15px]">{stats.customerRetention.repeatCustomers}</div>
                      <div className="text-[10.5px] text-[var(--mute)] uppercase tracking-[.06em]">2+ orders</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-[15px]">{stats.customerRetention.totalCustomers}</div>
                      <div className="text-[10.5px] text-[var(--mute)] uppercase tracking-[.06em]">total this month</div>
                    </div>
                  </div>
                  {stats.customerRetention.repeatPct < 20 && stats.customerRetention.totalCustomers >= 10 && (
                    <p className="text-[11.5px] text-[var(--mute)] pt-2 border-t border-[var(--line)]">
                      Tip: try a loyalty offer or follow-up message — under 20% retention is a marketing opportunity.
                    </p>
                  )}
                </div>
              )}
            </Panel>
          </div>
        )}

        {/* Per-outlet performance — Phase 3J. Only rendered for
            multi-outlet kitchens. Single-outlet KPIs already live in
            the top KPI row. Revenue + order count for the current
            month, sorted busiest first. */}
        {outletBreakdown.length > 0 && (
          <div className="grid grid-cols-1 gap-4 mb-4">
            <Panel
              title="Outlet performance"
              sub={`This month — ${outletBreakdown.length} active outlet${outletBreakdown.length === 1 ? '' : 's'}, sorted by revenue.`}
              action={<a href="/client/restaurant/outlets" className="text-xs underline">Manage outlets</a>}
            >
              {outletBreakdown.every((o) => o.orderCount === 0) ? (
                <p className="text-[13px] text-[var(--mute)] py-2">
                  No orders this month yet. As orders land, per-outlet revenue
                  will rank here so you can spot outliers across the chain.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {outletBreakdown.map((o, i) => {
                    const top = outletBreakdown[0].revenue || 1;
                    const sharePct = top > 0 ? Math.round((o.revenue / top) * 100) : 0;
                    return (
                      <li
                        key={o.id}
                        className="flex items-center justify-between gap-3 py-2 border-b border-[var(--line)] last:border-b-0"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="zt-mono text-[11px] text-[var(--mute)] w-5 text-right">#{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[14px] font-semibold truncate">{o.name}</span>
                              <span className="text-[10px] uppercase tracking-[.06em] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                                @{o.slug}
                              </span>
                            </div>
                            <div
                              style={{
                                height: 4,
                                marginTop: 4,
                                background: 'var(--bg-2)',
                                borderRadius: 99,
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${Math.max(2, sharePct)}%`,
                                  height: '100%',
                                  background: 'var(--ink)',
                                }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0 text-right">
                          <div>
                            <div className="text-[11.5px] text-[var(--mute)] zt-mono uppercase tracking-[.06em]">
                              Orders
                            </div>
                            <div className="text-[14px] font-semibold zt-mono">{o.orderCount}</div>
                          </div>
                          <div>
                            <div className="text-[11.5px] text-[var(--mute)] zt-mono uppercase tracking-[.06em]">
                              Revenue
                            </div>
                            <div className="text-[14px] font-bold zt-mono">
                              ₹{Math.round(o.revenue).toLocaleString('en-IN')}
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>
        )}

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
