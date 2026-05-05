'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { PageTopbar, PageHead, Panel } from '@/components/app/primitives';

interface CronTaskRow {
  task: string;
  lastStartedAt: string;
  lastFinishedAt: string | null;
  lastOk: boolean;
  inFlight: boolean;
}
interface HealthData {
  ok: boolean;
  now: string;
  clients: {
    byStatus: Array<{ status: string; count: number }>;
    churnRiskCount: number;
  };
  subscriptions: { activeCount: number; expiringIn7DaysCount: number };
  bookings: { pendingApprovalCount: number };
  messages: { outboundLast7Days: number };
  cron: { tasks: CronTaskRow[] };
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso || '—';
  }
}

function ago(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return iso;
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

export default function AdminHealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      const res = await fetch('/api/admin/health');
      const body = await res.json();
      if (!res.ok) {
        setErr(body?.error || `HTTP ${res.status}`);
      } else {
        setData(body);
      }
    } catch (e) {
      setErr(String(e).slice(0, 200));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <PageTopbar crumbs={<>Admin → Health</>} />
      <PageHead
        title="Platform Health"
        sub="One-pane operator view: subscriptions, bookings, message volume, cron status. Refreshes every minute."
      />

      {loading && !data && (
        <Panel><div style={{ padding: 24, color: '#888' }}>Loading…</div></Panel>
      )}
      {err && (
        <Panel><div style={{ padding: 24, color: '#c33' }}>Error: {err}</div></Panel>
      )}

      {data && (
        <>
          <div style={statGrid}>
            <Stat label="Active subscriptions" value={data.subscriptions.activeCount.toLocaleString()} />
            <Stat
              label="Expiring in 7 days"
              value={data.subscriptions.expiringIn7DaysCount.toLocaleString()}
              tone={data.subscriptions.expiringIn7DaysCount > 0 ? 'warn' : 'ok'}
            />
            <Stat label="Pending-approval bookings" value={data.bookings.pendingApprovalCount.toLocaleString()} />
            <Stat label="Outbound messages (7d)" value={data.messages.outboundLast7Days.toLocaleString()} />
            <Stat
              label="Bots silent for 30+ days"
              value={data.clients.churnRiskCount.toLocaleString()}
              tone={data.clients.churnRiskCount > 0 ? 'warn' : 'ok'}
            />
          </div>

          <Panel>
            <div style={panelHead}>Clients by status</div>
            <div style={{ padding: '8px 16px 16px' }}>
              {data.clients.byStatus.map((s) => (
                <div key={s.status} style={inlineRow}>
                  <span style={{ fontFamily: 'monospace' }}>{s.status}</span>
                  <span style={{ color: '#666' }}>{s.count}</span>
                </div>
              ))}
              {data.clients.byStatus.length === 0 && <div style={{ color: '#888' }}>No clients yet.</div>}
            </div>
          </Panel>

          <Panel>
            <div style={panelHead}>Cron tasks — latest run per task</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f7f7f8', textAlign: 'left' }}>
                  <th style={th}>Task</th>
                  <th style={th}>Started</th>
                  <th style={th}>Finished</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.cron.tasks.map((t) => (
                  <tr key={t.task} style={{ borderTop: '1px solid #eee' }}>
                    <td style={{ ...td, fontFamily: 'monospace' }}>{t.task}</td>
                    <td style={td}>
                      {fmtTime(t.lastStartedAt)}{' '}
                      <span style={{ color: '#999' }}>({ago(t.lastStartedAt)})</span>
                    </td>
                    <td style={td}>
                      {t.lastFinishedAt ? fmtTime(t.lastFinishedAt) : <em style={{ color: '#999' }}>in flight…</em>}
                    </td>
                    <td style={td}>
                      {t.inFlight ? (
                        <span style={pill('warn')}>RUNNING</span>
                      ) : t.lastOk ? (
                        <span style={pill('ok')}>OK</span>
                      ) : (
                        <span style={pill('err')}>FAILED</span>
                      )}
                    </td>
                  </tr>
                ))}
                {data.cron.tasks.length === 0 && (
                  <tr><td style={{ ...td, color: '#888' }} colSpan={4}>No cron runs recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </Panel>
        </>
      )}
    </>
  );
}

function Stat({ label, value, tone = 'ok' }: { label: string; value: string; tone?: 'ok' | 'warn' | 'err' }) {
  const colorMap: Record<string, string> = { ok: '#0a0', warn: '#c80', err: '#c33' };
  return (
    <div style={statCard}>
      <div style={{ fontSize: 13, color: '#666' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: colorMap[tone] || '#222', marginTop: 4 }}>{value}</div>
    </div>
  );
}

const statGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 12,
  marginBottom: 20,
};
const statCard: CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e5e7',
  borderRadius: 8,
  padding: '14px 16px',
};
const panelHead: CSSProperties = {
  padding: '12px 16px',
  fontWeight: 600,
  borderBottom: '1px solid #eee',
};
const inlineRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '6px 0',
};
const th: CSSProperties = {
  padding: '10px 12px',
  fontWeight: 600,
  fontSize: 12,
  color: '#444',
  borderBottom: '1px solid #e5e5e7',
};
const td: CSSProperties = { padding: '10px 12px', verticalAlign: 'top' };

function pill(tone: 'ok' | 'warn' | 'err'): CSSProperties {
  const m: Record<string, [string, string]> = {
    ok: ['#0a0', '#e6f5e6'],
    warn: ['#c80', '#fff5e0'],
    err: ['#c33', '#fde7e7'],
  };
  const [color, bg] = m[tone];
  return {
    display: 'inline-block',
    padding: '2px 8px',
    background: bg,
    color,
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
  };
}
