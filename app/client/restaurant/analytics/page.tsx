// Restaurant analytics — today's sales per table, average ticket size,
// peak hours, top-selling items. All derived from dine_in_orders for the
// current IST day; no separate analytics rollup table needed yet.

import { requireRestaurantViewer } from '@/lib/restaurant/viewer-context';
import { listOrdersForToday } from '@/lib/db/restaurant-dine-in';
import { PageTopbar, PageHead, Kpi, Panel } from '@/components/app/primitives';

function fmtINR(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export default async function RestaurantAnalyticsPage() {
  // Phase 3I v2 — viewer-context. Outlet managers see only their
  // outlet's orders; owners see chain-wide.
  const viewer = await requireRestaurantViewer();

  const orders = await listOrdersForToday(
    viewer.activeBot.client_id,
    undefined,
    viewer.restrictedOutletId || undefined,
  ).catch(() => []);
  const placed = orders.filter((o) => o.status !== 'cancelled');

  const revenue = placed.reduce((s, o) => s + o.total, 0);
  const avgTicket = placed.length > 0 ? revenue / placed.length : 0;

  const byTable = new Map<string, { table: string; orders: number; revenue: number }>();
  for (const o of placed) {
    const t = o.table_number || (o.order_type === 'home_delivery' ? 'Delivery' : '—');
    const ex = byTable.get(t) || { table: t, orders: 0, revenue: 0 };
    ex.orders += 1;
    ex.revenue += o.total;
    byTable.set(t, ex);
  }
  const topTables = [...byTable.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8);

  const hourBuckets = new Map<number, number>();
  for (const o of placed) {
    const hour = new Date(o.created_at).getHours();
    hourBuckets.set(hour, (hourBuckets.get(hour) || 0) + 1);
  }
  const peakHour = [...hourBuckets.entries()].sort((a, b) => b[1] - a[1])[0];

  const itemQty = new Map<string, number>();
  for (const o of placed) {
    for (const it of o.items) {
      itemQty.set(it.name, (itemQty.get(it.name) || 0) + it.qty);
    }
  }
  const topItems = [...itemQty.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const dineIn = placed.filter((o) => o.order_type === 'dine_in').length;
  const homeDel = placed.filter((o) => o.order_type === 'home_delivery').length;
  const parcel = placed.filter((o) => o.order_type === 'parcel_takeaway').length;

  return (
    <>
      <PageTopbar
        crumbs={
          <>
            Restaurant /{' '}
            <a href="/client/restaurant" className="hover:underline">Overview</a>{' '}
            / <b className="text-foreground">Analytics</b>
          </>
        }
      />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead
          title={<>Today&apos;s <span className="zt-serif">numbers.</span></>}
          sub="Live, derived from the orders feed. Resets at midnight IST."
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Kpi label="Orders" value={placed.length} trend={placed.length === 0 ? 'No orders yet today' : undefined} />
          <Kpi label="Revenue" value={fmtINR(revenue)} />
          <Kpi label="Avg ticket" value={placed.length > 0 ? fmtINR(avgTicket) : '—'} />
          <Kpi
            label="Peak hour"
            value={peakHour ? `${peakHour[0]}:00` : '—'}
            trend={peakHour ? `${peakHour[1]} orders` : undefined}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <Panel title="Top tables" sub="Sorted by revenue today">
            {topTables.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No table activity yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {topTables.map((t) => (
                  <li key={t.table} className="flex items-center justify-between py-2">
                    <span className="text-[14px] font-semibold">Table {t.table}</span>
                    <span className="text-[12.5px] text-foreground/70">
                      {t.orders} order{t.orders === 1 ? '' : 's'} · <b className="text-foreground">{fmtINR(t.revenue)}</b>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Order mix" sub={`${placed.length} orders today (excl. cancelled)`}>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-[26px] font-bold">{dineIn}</div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Dine-in</div>
              </div>
              <div>
                <div className="text-[26px] font-bold">{parcel}</div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Parcel</div>
              </div>
              <div>
                <div className="text-[26px] font-bold">{homeDel}</div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Home delivery</div>
              </div>
            </div>
          </Panel>
        </div>

        <Panel title="Top items today" sub="Sorted by total quantity sold">
          {topItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No items sold yet today.</p>
          ) : (
            <ul className="divide-y divide-border">
              {topItems.map(([name, qty]) => (
                <li key={name} className="flex items-center justify-between py-2">
                  <span className="text-[14px]">{name}</span>
                  <span className="text-[12.5px] zt-mono text-foreground/70">{qty}× sold</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
