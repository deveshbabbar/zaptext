'use client';

import { useEffect, useMemo, useState } from 'react';
import { BUSINESS_TYPES } from '@/lib/constants';
import { ClientRow } from '@/lib/types';
import { PageTopbar, PageHead, Kpi, Panel, StatusPill } from '@/components/app/primitives';

export default function AnalyticsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/clients')
      .then((r) => r.json())
      .then((d) => {
        setClients(d.clients || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const active = clients.filter((c) => c.status === 'active').length;
    const paused = clients.filter((c) => c.status === 'paused').length;
    const now = new Date();
    const createdThisMonth = clients.filter((c) => {
      const d = new Date(c.created_at);
      return !isNaN(d.getTime()) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    return { total: clients.length, active, paused, createdThisMonth };
  }, [clients]);

  const typeBreakdown = useMemo(() => {
    return BUSINESS_TYPES.map((bt) => ({
      ...bt,
      count: clients.filter((c) => c.type === bt.type).length,
    })).sort((a, b) => b.count - a.count);
  }, [clients]);

  const maxTypeCount = Math.max(1, ...typeBreakdown.map((t) => t.count));

  const cityBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    clients.forEach((c) => {
      const city = (c.city || 'Unknown').trim() || 'Unknown';
      map.set(city, (map.get(city) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [clients]);

  const recent = useMemo(() => {
    return [...clients]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [clients]);

  return (
    <>
      <PageTopbar
        crumbs={<><b className="text-foreground">Analytics</b> · {stats.total} total · {stats.active} active</>}
      />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead
          title={<>Usage <span className="zt-serif">at a glance.</span></>}
          sub="Across every bot, every client, every city."
        />

        {loading ? (
          <div className="animate-pulse h-64 bg-[var(--card)] border border-[var(--line)] rounded-[18px]" />
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <Kpi label="Total bots" value={stats.total} />
              <Kpi label="Active" value={stats.active} />
              <Kpi label="Paused" value={stats.paused} />
              <Kpi label="Created this month" value={stats.createdThisMonth} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <Panel title="Bots by business type" sub="Ranked by count">
                {clients.length === 0 ? (
                  <p className="text-[13px] text-[var(--mute)] text-center py-4 m-0">No bots yet</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {typeBreakdown.map((bt) => {
                      const pct = (bt.count / maxTypeCount) * 100;
                      return (
                        <div key={bt.type}>
                          <div className="flex items-center justify-between text-[13px] mb-1">
                            <span className="flex items-center gap-2">
                              <span>{bt.icon}</span>
                              <span>{bt.label}</span>
                            </span>
                            <span className="font-semibold">{bt.count}</span>
                          </div>
                          <div className="h-2 bg-[var(--bg-2)] rounded-full overflow-hidden">
                            <div className="h-full bg-[var(--ink)] transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Panel>

              <Panel title="Top cities" sub="Where your customers are">
                {cityBreakdown.length === 0 ? (
                  <p className="text-[13px] text-[var(--mute)] text-center py-4 m-0">No data</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {cityBreakdown.map((c) => {
                      const pct = (c.count / (cityBreakdown[0]?.count || 1)) * 100;
                      return (
                        <div key={c.city}>
                          <div className="flex items-center justify-between text-[13px] mb-1">
                            <span>{c.city}</span>
                            <span className="font-semibold">{c.count}</span>
                          </div>
                          <div className="h-2 bg-[var(--bg-2)] rounded-full overflow-hidden">
                            <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Panel>
            </div>

            <Panel title="Recent activity" sub="5 most recent clients">
              {recent.length === 0 ? (
                <p className="text-[13px] text-[var(--mute)] text-center py-4 m-0">No activity</p>
              ) : (
                <div className="flex flex-col">
                  {recent.map((c, i) => {
                    const meta = BUSINESS_TYPES.find((bt) => bt.type === c.type);
                    return (
                      <div
                        key={c.client_id}
                        className="flex items-center justify-between py-3"
                        style={{ borderBottom: i < recent.length - 1 ? '1px solid var(--line)' : 'none' }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-[24px]">{meta?.icon || '🤖'}</div>
                          <div>
                            <div className="font-semibold text-[14px]">{c.business_name}</div>
                            <div className="text-[12px] text-[var(--mute)]">
                              {meta?.label} · {c.city}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusPill
                            variant={c.status === 'active' ? 'active' : c.status === 'pending' ? 'pending' : 'ok'}
                          >
                            {c.status}
                          </StatusPill>
                          <span className="zt-mono text-[11.5px] text-[var(--mute)]">{c.created_at}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </>
        )}
      </div>
    </>
  );
}
