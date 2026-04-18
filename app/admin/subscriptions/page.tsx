'use client';

import { useEffect, useState } from 'react';
import { PageTopbar, PageHead, Panel, StatusPill } from '@/components/app/primitives';

interface PlanStat { name: string; price: number; activeCount: number; revenue: number; }
interface SubscriptionItem {
  userId: string; plan: string; status: string; amount: number;
  startDate: string; endDate: string; businessNames: string[];
}
interface Data {
  planStats: PlanStat[];
  subscriptions: SubscriptionItem[];
  totalActive: number;
  totalMRR: number;
}

export default function SubscriptionsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/subscriptions')
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const planStats = data?.planStats || [];
  const subscriptions = data?.subscriptions || [];

  return (
    <>
      <PageTopbar
        crumbs={
          <>
            <b className="text-foreground">Subscriptions</b> · {data?.totalActive ?? 0} active · MRR ₹{(data?.totalMRR ?? 0).toLocaleString('en-IN')}
          </>
        }
      />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead
          title={<>All <span className="zt-serif">subscriptions.</span></>}
          sub="Per-plan breakdown and every active client."
        />

        {loading ? (
          <div className="animate-pulse h-64 bg-[var(--card)] border border-[var(--line)] rounded-[18px]" />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
              {planStats.map((p) => (
                <div
                  key={p.name}
                  className="rounded-[18px] border border-[var(--line)] bg-[var(--card)]"
                  style={{ padding: '18px 20px' }}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <h3 className="text-[16px] font-bold tracking-[-0.015em]">{p.name}</h3>
                    <span className="zt-mono text-[11px] text-[var(--mute)] rounded-full border border-[var(--line)]" style={{ padding: '2px 8px' }}>
                      ₹{p.price.toLocaleString('en-IN')}/mo
                    </span>
                  </div>
                  <div className="text-[11.5px] text-[var(--mute)] zt-mono uppercase tracking-[.06em]">Active</div>
                  <div className="text-[28px] font-bold tracking-[-0.025em] leading-none mt-1">{p.activeCount}</div>
                  <div className="mt-3 text-[11.5px] text-[var(--mute)] zt-mono uppercase tracking-[.06em]">Revenue</div>
                  <div className="text-[16px] font-semibold text-[var(--ink)]">
                    ₹{p.revenue.toLocaleString('en-IN')}/mo
                  </div>
                </div>
              ))}
            </div>

            <Panel title="All subscriptions">
              {subscriptions.length === 0 ? (
                <p className="text-[13px] text-[var(--mute)] text-center py-6 m-0">
                  No paid subscriptions yet — clients on free trial.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Business', 'Plan', 'Started', 'Ends', 'Amount', 'Status'].map((h) => (
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
                      {subscriptions.map((s, i) => (
                        <tr key={`${s.userId}-${i}`}>
                          <td className="font-semibold" style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
                            {s.businessNames.join(', ')}
                          </td>
                          <td className="capitalize" style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
                            {s.plan}
                          </td>
                          <td className="zt-mono text-[11.5px] text-[var(--mute)]" style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
                            {s.startDate || '—'}
                          </td>
                          <td className="zt-mono text-[11.5px] text-[var(--mute)]" style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
                            {s.endDate || '—'}
                          </td>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
                            ₹{(s.amount || 0).toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
                            <StatusPill variant={s.status === 'active' ? 'active' : 'ok'}>
                              {s.status || 'unknown'}
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
