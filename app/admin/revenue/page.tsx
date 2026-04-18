'use client';

import { useEffect, useState } from 'react';
import { PageTopbar, PageHead, Kpi, Panel, StatusPill } from '@/components/app/primitives';

interface ChartPoint { month: string; value: number; }
interface RecentSub {
  userId: string;
  plan: string;
  status: string;
  amount: number;
  startDate: string;
  endDate: string;
  createdAt: string;
  businessNames: string[];
}
interface RevenueData {
  mrr: number;
  totalRevenue: number;
  activeCount: number;
  churnRate: number;
  chart: ChartPoint[];
  recent: RecentSub[];
}

export default function RevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/revenue')
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const mrr = data?.mrr || 0;
  const totalRevenue = data?.totalRevenue || 0;
  const activeCount = data?.activeCount || 0;
  const churnRate = data?.churnRate || 0;
  const chartData = data?.chart || [];
  const recent = data?.recent || [];
  const chartMax = Math.max(1, ...chartData.map((d) => d.value));

  return (
    <>
      <PageTopbar crumbs={<><b className="text-foreground">Revenue</b> · MRR ₹{mrr.toLocaleString('en-IN')}</>} />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead
          title={<>Monthly <span className="zt-serif">revenue.</span></>}
          sub="MRR, churn, total — and every recent transaction."
        />

        {loading ? (
          <div className="animate-pulse h-64 bg-[var(--card)] border border-[var(--line)] rounded-[18px]" />
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <Kpi label="MRR" value={`₹${mrr.toLocaleString('en-IN')}`} trend="Monthly recurring" />
              <Kpi label="Total revenue" value={`₹${totalRevenue.toLocaleString('en-IN')}`} trend="All time" />
              <Kpi label="Active subscriptions" value={activeCount} />
              <Kpi label="Churn rate" value={`${churnRate}%`} trend="Last 30 days" />
            </div>

            <Panel title="Revenue growth" sub="Last 6 months" className="mb-4">
              {chartData.length === 0 ? (
                <p className="text-[13px] text-[var(--mute)] text-center py-4 m-0">No data.</p>
              ) : (
                <div className="flex items-end gap-3 h-48 mt-2">
                  {chartData.map((d) => {
                    const h = (d.value / chartMax) * 100;
                    return (
                      <div key={d.month} className="flex-1 flex flex-col items-center gap-2">
                        <div className="zt-mono text-[10.5px] text-[var(--mute)]">
                          ₹{d.value.toLocaleString('en-IN')}
                        </div>
                        <div className="w-full bg-[var(--bg-2)] rounded-[6px] flex items-end h-full overflow-hidden">
                          <div
                            className="w-full bg-[var(--ink)] rounded-[6px] transition-all"
                            style={{ height: `${h}%` }}
                          />
                        </div>
                        <div className="zt-mono text-[11px] font-semibold">{d.month}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>

            <Panel title="Recent transactions">
              {recent.length === 0 ? (
                <p className="text-[13px] text-[var(--mute)] text-center py-6 m-0">No transactions yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Business', 'Plan', 'Amount', 'Date', 'Status'].map((h) => (
                          <th
                            key={h}
                            className="zt-mono text-[10.5px] uppercase tracking-[.08em] text-[var(--mute)] font-medium"
                            style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--line)' }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((r, i) => (
                        <tr key={`${r.userId}-${i}`}>
                          <td className="font-semibold" style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
                            {r.businessNames.join(', ')}
                          </td>
                          <td className="capitalize" style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
                            {r.plan}
                          </td>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
                            ₹{(r.amount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="zt-mono text-[11.5px] text-[var(--mute)]" style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
                            {r.createdAt || r.startDate || '—'}
                          </td>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
                            <StatusPill variant={r.status === 'active' ? 'active' : 'ok'}>
                              {r.status || 'unknown'}
                            </StatusPill>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </>
        )}
      </div>
    </>
  );
}
