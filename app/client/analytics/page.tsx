'use client';

import { useEffect, useState } from 'react';
import { PageTopbar, PageHead, Panel } from '@/components/app/primitives';

interface Analytics {
  totalCustomers: number;
  totalBookings: number;
  conversionRate: number;
  ownerInterventions: number;
  avgRepliesPerCustomer: number;
  volumeByDay: Array<{ day: string; count: number }>;
  busyHoursIST: Array<{ hour: number; count: number }>;
  topKeywords: Array<{ word: string; count: number }>;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/client/analytics')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setErr(d.error);
        else setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setErr(String(e));
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '28px 32px' }}>
        <div className="animate-pulse h-32 bg-[var(--card)] border border-[var(--line)] rounded-[18px]" />
      </div>
    );
  }

  if (err || !data) {
    return (
      <div style={{ padding: '28px 32px' }}>
        <Panel title="Error">
          <p className="text-[13px] text-red-500 m-0">{err || 'No data'}</p>
        </Panel>
      </div>
    );
  }

  const maxVolume = Math.max(1, ...data.volumeByDay.map((d) => d.count));
  const maxBusy = Math.max(1, ...data.busyHoursIST.map((d) => d.count));
  const maxKw = Math.max(1, ...data.topKeywords.map((d) => d.count));

  return (
    <>
      <PageTopbar
        crumbs={
          <>
            <b className="text-foreground">Analytics</b> · {data.totalCustomers} customers · {data.totalBookings} bookings
          </>
        }
      />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead
          title={<>Conversation <span className="zt-serif">analytics.</span></>}
          sub="Last 30 days of customer activity, busy hours, and the words your customers actually use."
        />

        {/* Stat cards row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 mb-6">
          <Stat label="Customers" value={data.totalCustomers} sub="unique phones" />
          <Stat label="Bookings" value={data.totalBookings} sub="confirmed" />
          <Stat label="Conversion" value={`${data.conversionRate}%`} sub="customer to booking" />
          <Stat label="Avg replies" value={data.avgRepliesPerCustomer} sub="per customer" />
          <Stat label="Owner replies" value={data.ownerInterventions} sub="manual takeovers" />
        </div>

        {/* 30-day volume bar chart */}
        <Panel title="Conversation volume (last 30 days)">
          <div className="flex items-end gap-1 h-40">
            {data.volumeByDay.map((d) => {
              const pct = (d.count / maxVolume) * 100;
              return (
                <div
                  key={d.day}
                  className="flex-1 group relative"
                  title={`${d.day} - ${d.count} message${d.count === 1 ? '' : 's'}`}
                >
                  <div
                    className="rounded-t-sm bg-[var(--accent)]"
                    style={{ height: `${Math.max(pct, d.count > 0 ? 4 : 0)}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] text-[var(--mute)] zt-mono">
            <span>{data.volumeByDay[0]?.day || ''}</span>
            <span>{data.volumeByDay[data.volumeByDay.length - 1]?.day || ''}</span>
          </div>
        </Panel>

        {/* Busy hours heatmap-row */}
        <div className="mt-4">
          <Panel title="Busy hours (Asia/Kolkata)">
            <div className="grid grid-cols-12 sm:grid-cols-24 gap-1">
              {data.busyHoursIST.map((h) => {
                const intensity = h.count / maxBusy;
                const bg = intensity === 0
                  ? 'var(--bg-2)'
                  : `color-mix(in oklab, var(--accent) ${Math.max(15, intensity * 90)}%, transparent)`;
                return (
                  <div key={h.hour} className="flex flex-col items-center gap-1" title={`${h.hour}:00 - ${h.count} msgs`}>
                    <div
                      className="w-full h-8 rounded-[4px] border border-[var(--line)]"
                      style={{ background: bg }}
                    />
                    <span className="text-[9px] text-[var(--mute)] zt-mono">{h.hour}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-[11.5px] text-[var(--mute)] mt-3 mb-0">
              Each cell is one hour of the day. Darker = more inbound messages. Plan staffing or template broadcasts around the peaks.
            </p>
          </Panel>
        </div>

        {/* Top keywords */}
        <div className="mt-4">
          <Panel title="What customers ask about">
            {data.topKeywords.length === 0 ? (
              <p className="text-[13px] text-[var(--mute)] m-0">Not enough conversations yet — keywords will appear once your bot has a few inbound messages.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {data.topKeywords.map((k) => {
                  const pct = (k.count / maxKw) * 100;
                  return (
                    <div key={k.word} className="flex items-center gap-3">
                      <span className="zt-mono text-[12px] w-32 truncate" title={k.word}>{k.word}</span>
                      <div className="flex-1 h-3 rounded-full bg-[var(--bg-2)] overflow-hidden">
                        <div className="h-full bg-[var(--ink)]" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="zt-mono text-[11.5px] text-[var(--mute)] w-10 text-right">{k.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="rounded-[18px] border border-[var(--line)] bg-[var(--card)]" style={{ padding: '18px 20px' }}>
      <div className="text-[11.5px] text-[var(--mute)] zt-mono uppercase tracking-[.06em]">{label}</div>
      <div className="text-[28px] font-bold tracking-[-0.025em] leading-none mt-1">{value}</div>
      <div className="text-[11.5px] text-[var(--mute)] mt-2">{sub}</div>
    </div>
  );
}
