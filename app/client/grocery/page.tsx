// app/client/grocery/page.tsx — Grocery vertical overview / dashboard.
//
// All other grocery pages (catalog, products, zones, slots, orders,
// recurring) hang off this overview. KPI source: lib/db/grocery-stats.ts
// (single round-trip aggregation).

import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { getGroceryStats } from '@/lib/db/grocery-stats';
import { listOrders } from '@/lib/db/grocery-orders';
import { todayIsoIST } from '@/lib/grocery/date-utils';
import { PageTopbar, PageHead, Pill, Kpi, Panel, StatusPill } from '@/components/app/primitives';
import { SubTypesChips } from '@/components/client/sub-types-chips';

export default async function GroceryOverviewPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'grocery') redirect('/client/dashboard');

  const today = todayIsoIST();
  const [stats, recentPending] = await Promise.all([
    getGroceryStats(user.activeBot.client_id).catch(() => ({
      todayOrderCount: 0, todayRevenue: 0, pendingOrderCount: 0,
      activeCustomers7d: 0, productsTotal: 0, inStockToday: 0,
      outOfStockToday: 0, activeRecurring: 0,
    })),
    listOrders(user.activeBot.client_id, { status: 'pending', limit: 6 }).catch(() => []),
  ]);

  const catalogReady = stats.inStockToday > 0;
  const noProducts = stats.productsTotal === 0;

  // Parse kb for sub-type chips (grocery sub-types include kirana, dairy,
  // mandi, bakery, etc. — surfacing them helps owner confirm config).
  let kb: Record<string, unknown> = {};
  try {
    kb = user.activeBot.knowledge_base_json
      ? (JSON.parse(user.activeBot.knowledge_base_json) as Record<string, unknown>)
      : {};
  } catch { /* ignore */ }

  return (
    <>
      <PageTopbar
        crumbs={<>Grocery / <b className="text-foreground">Overview</b></>}
        actions={<Pill variant="ink" href="/client/grocery/catalog">Update today&apos;s catalog</Pill>}
      />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead
          title={<>{user.activeBot.business_name} <span className="zt-serif">workspace.</span></>}
          sub={`Today's orders, catalog, and delivery activity at a glance — ${today}`}
        />
        <SubTypesChips kb={kb} />

        {/* Setup gates — these are the blocking states for a new grocery
            client. Surfacing them here so the owner sees them on day 1. */}
        {noProducts && (
          <div className="mb-5 rounded-[12px] border" style={{ padding: '14px 16px', borderColor: '#dc2626', background: '#dc262610' }}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold mb-1">🚫 No products in your master catalog</div>
                <div className="text-[12.5px] text-[var(--mute)]">
                  Bot can&apos;t take orders without products. Add at least your top 20 daily-sellers (e.g. tomato, onion, dahi, atta, milk).
                </div>
              </div>
              <Pill variant="ink" href="/client/grocery/products">Add products</Pill>
            </div>
          </div>
        )}
        {!noProducts && !catalogReady && (
          <div className="mb-5 rounded-[12px] border" style={{ padding: '14px 16px', borderColor: '#f59e0b', background: '#f59e0b10' }}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold mb-1">⚠ Today&apos;s catalog not set</div>
                <div className="text-[12.5px] text-[var(--mute)]">
                  Mandi prices change daily. Set today&apos;s prices + stock so the bot quotes correctly.
                  Tip: copy yesterday&apos;s catalog forward and tweak a few rows.
                </div>
              </div>
              <Pill variant="ink" href="/client/grocery/catalog">Set today&apos;s prices</Pill>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Kpi label="Orders today" value={stats.todayOrderCount} />
          <Kpi label="Revenue today" value={`₹${Math.round(stats.todayRevenue).toLocaleString('en-IN')}`} />
          <Kpi label="Pending orders" value={stats.pendingOrderCount} trend={stats.pendingOrderCount > 0 ? 'Action needed' : undefined} />
          <Kpi label="Active recurring" value={stats.activeRecurring} />
          <Kpi label="Products in catalog" value={stats.productsTotal} />
          <Kpi label="In-stock today" value={stats.inStockToday} />
          <Kpi label="Out-of-stock today" value={stats.outOfStockToday} />
          <Kpi label="Active customers (7d)" value={stats.activeCustomers7d} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <Panel title="Quick actions" sub="Most common grocery owner workflows.">
            <div className="grid grid-cols-2 gap-2.5">
              <Pill variant="ghost" href="/client/grocery/catalog">🥬 Today&apos;s catalog</Pill>
              <Pill variant="ghost" href="/client/grocery/products">📦 Master products ({stats.productsTotal})</Pill>
              <Pill variant="ghost" href="/client/grocery/orders">🧾 Orders ({stats.pendingOrderCount} pending)</Pill>
              <Pill variant="ghost" href="/client/grocery/recurring">🔁 Recurring ({stats.activeRecurring})</Pill>
              <Pill variant="ghost" href="/client/grocery/zones">📍 Delivery zones</Pill>
              <Pill variant="ghost" href="/client/grocery/slots">⏰ Delivery slots</Pill>
            </div>
          </Panel>
          <Panel title="Pending orders" sub={`${recentPending.length} awaiting confirmation`}>
            {recentPending.length === 0 ? (
              <div className="text-[13px] text-[var(--mute)] py-2">No pending orders right now.</div>
            ) : (
              <ul className="flex flex-col">
                {recentPending.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 py-2 border-b border-[var(--line)] last:border-b-0">
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold truncate">{o.customer_name || o.customer_phone}</div>
                      <div className="text-[11.5px] text-[var(--mute)] zt-mono uppercase tracking-[.06em]">
                        {o.slot_date} · ₹{Math.round(o.total).toLocaleString('en-IN')} · {o.items.length} items
                      </div>
                    </div>
                    <StatusPill variant="pending">{o.status}</StatusPill>
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
