// app/admin/grocery/page.tsx
//
// Grocery vertical dashboard. Mirrors the structure of /admin/dashboard
// but is a server component — no client-side fetching. Auth + client
// resolution mirrors the other /admin/grocery/* pages so the parent
// layout's redirect rules apply consistently.

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getClientByOwnerUserId } from '@/lib/db/clients';
import { getGroceryStats } from '@/lib/db/grocery-stats';
import { getCatalogForDate } from '@/lib/db/grocery-daily-catalog';
import { todayIsoIST } from '@/lib/grocery/date-utils';
import {
  PageTopbar,
  PageHead,
  Pill,
  Kpi,
  Panel,
  StatusPill,
} from '@/components/app/primitives';

export default async function GroceryDashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const client = await getClientByOwnerUserId(userId);
  if (!client || client.type !== 'grocery') redirect('/admin');

  const today = todayIsoIST();
  const [stats, catalog] = await Promise.all([
    getGroceryStats(client.client_id),
    getCatalogForDate(client.client_id, today),
  ]);

  const fmtINR = (n: number) =>
    `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  const topItems = catalog.slice(0, 10);
  const totalToday = stats.inStockToday + stats.outOfStockToday;

  return (
    <>
      <PageTopbar
        crumbs={
          <>
            Admin / Grocery / <b className="text-foreground">Dashboard</b>
          </>
        }
        actions={
          <Pill variant="ink" href="/admin/grocery/today">
            Aaj ki list update
          </Pill>
        }
      />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead
          title={
            <>
              Grocery <span className="zt-serif">overview.</span>
            </>
          }
          sub="Today's catalog, orders, and customer activity at a glance."
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Kpi
            label="Today's orders"
            value={stats.todayOrderCount}
            trend={
              stats.pendingOrderCount > 0
                ? `${stats.pendingOrderCount} pending`
                : undefined
            }
          />
          <Kpi label="Today's revenue" value={fmtINR(stats.todayRevenue)} />
          <Kpi label="Active customers (7d)" value={stats.activeCustomers7d} />
          <Kpi
            label="In-stock items"
            value={stats.inStockToday}
            trend={
              totalToday > 0
                ? `${stats.inStockToday} / ${totalToday} listed today`
                : 'No catalog set for today'
            }
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <Panel
            title="Quick actions"
            sub="Jump into the most common workflows for today."
          >
            <div className="grid grid-cols-2 gap-2.5">
              <Pill variant="ghost" href="/admin/grocery/today">
                📋 Aaj ki list
              </Pill>
              <Pill variant="ghost" href="/admin/grocery/products">
                🛒 Products ({stats.productsTotal})
              </Pill>
              <Pill variant="ghost" href="/admin/grocery/orders">
                📦 Orders
                {stats.pendingOrderCount > 0
                  ? ` (${stats.pendingOrderCount} pending)`
                  : ''}
              </Pill>
              <Pill variant="ghost" href="/admin/grocery/recurring">
                🔁 Recurring ({stats.activeRecurring})
              </Pill>
            </div>
          </Panel>

          <Panel
            title="Today's stock"
            sub={
              totalToday > 0
                ? `${stats.inStockToday} of ${totalToday} items in stock for ${today}`
                : `No catalog set for ${today} yet — start with "Aaj ki list".`
            }
            action={
              totalToday > 0 ? (
                <a href="/admin/grocery/today">Update</a>
              ) : undefined
            }
          >
            {topItems.length === 0 ? (
              <div className="text-[13px] text-[var(--mute)] py-2">
                No products listed for today.
              </div>
            ) : (
              <ul className="flex flex-col">
                {topItems.map((c) => (
                  <li
                    key={c.product.id}
                    className="flex items-center justify-between gap-3 py-2 border-b border-[var(--line)] last:border-b-0"
                  >
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold capitalize truncate">
                        {c.product.name}
                      </div>
                      <div className="text-[11.5px] text-[var(--mute)] zt-mono uppercase tracking-[.06em]">
                        {fmtINR(c.price_per_unit)} / {c.product.unit}
                      </div>
                    </div>
                    <StatusPill variant={c.in_stock ? 'ok' : 'cancel'}>
                      {c.in_stock ? 'in stock' : 'out'}
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
