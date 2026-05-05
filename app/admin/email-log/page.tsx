'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { PageTopbar, PageHead, Panel } from '@/components/app/primitives';

interface Row {
  id: string;
  toEmail: string;
  subject: string;
  status: 'sent' | 'failed' | 'retrying';
  attemptCount: number;
  lastError: string;
  sentAt: string;
}

interface Stats {
  windowHours: number;
  sent: number;
  failed: number;
  retrying: number;
}

interface Data {
  ok: boolean;
  failedOnly: boolean;
  count: number;
  stats: Stats;
  rows: Row[];
}

function fmtTime(iso: string): string {
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
    return iso;
  }
}

export default function AdminEmailLogPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [failedOnly, setFailedOnly] = useState(false);

  async function load(failedOnlyArg = failedOnly) {
    setErr(null);
    try {
      const res = await fetch(
        `/api/admin/email-log?limit=300${failedOnlyArg ? '&failed=1' : ''}`
      );
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleFailed() {
    const next = !failedOnly;
    setFailedOnly(next);
    setLoading(true);
    load(next);
  }

  const stats = data?.stats;

  return (
    <>
      <PageTopbar crumbs={<>Admin → Email log</>} />
      <PageHead
        title="Email send log"
        sub="Every transactional email's delivery outcome. 24-hour stats up top, full feed below."
        actions={
          <button
            onClick={toggleFailed}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #ddd',
              background: failedOnly ? '#fde7e7' : '#fff',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {failedOnly ? 'Showing failed only — click for all' : 'Show failed only'}
          </button>
        }
      />

      {stats && (
        <div style={statGrid}>
          <Stat label={`Sent (last ${stats.windowHours}h)`} value={stats.sent.toLocaleString()} tone="ok" />
          <Stat
            label={`Failed (last ${stats.windowHours}h)`}
            value={stats.failed.toLocaleString()}
            tone={stats.failed > 0 ? 'err' : 'ok'}
          />
          <Stat
            label={`Retrying (last ${stats.windowHours}h)`}
            value={stats.retrying.toLocaleString()}
            tone={stats.retrying > 0 ? 'warn' : 'ok'}
          />
        </div>
      )}

      <Panel>
        {loading && <div style={{ padding: 24, color: '#888' }}>Loading…</div>}
        {err && <div style={{ padding: 24, color: '#c33' }}>Error: {err}</div>}
        {!loading && !err && data && (
          <>
            <div style={{ padding: '12px 16px', color: '#666', fontSize: 13 }}>
              Showing {data.count} entries{failedOnly ? ' (failed only)' : ''}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f7f7f8', textAlign: 'left' }}>
                    <th style={th}>When (IST)</th>
                    <th style={th}>To</th>
                    <th style={th}>Subject</th>
                    <th style={th}>Status</th>
                    <th style={th}>Tries</th>
                    <th style={th}>Last error</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.id} style={{ borderTop: '1px solid #eee' }}>
                      <td style={td}>{fmtTime(r.sentAt)}</td>
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{r.toEmail}</td>
                      <td style={td}>{r.subject}</td>
                      <td style={td}><span style={pill(r.status)}>{r.status.toUpperCase()}</span></td>
                      <td style={td}>{r.attemptCount}</td>
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 11, color: '#933', maxWidth: 360 }}>
                        {r.lastError || '—'}
                      </td>
                    </tr>
                  ))}
                  {data.rows.length === 0 && (
                    <tr>
                      <td style={{ ...td, color: '#888', textAlign: 'center' }} colSpan={6}>
                        No email sends recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>
    </>
  );
}

function Stat({ label, value, tone = 'ok' }: { label: string; value: string; tone?: 'ok' | 'warn' | 'err' }) {
  const c: Record<string, string> = { ok: '#0a0', warn: '#c80', err: '#c33' };
  return (
    <div style={statCard}>
      <div style={{ fontSize: 13, color: '#666' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: c[tone] || '#222', marginTop: 4 }}>{value}</div>
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
const th: CSSProperties = {
  padding: '10px 12px',
  fontWeight: 600,
  fontSize: 12,
  color: '#444',
  borderBottom: '1px solid #e5e5e7',
};
const td: CSSProperties = { padding: '10px 12px', verticalAlign: 'top' };

function pill(status: string): CSSProperties {
  const m: Record<string, [string, string]> = {
    sent: ['#0a0', '#e6f5e6'],
    retrying: ['#c80', '#fff5e0'],
    failed: ['#c33', '#fde7e7'],
  };
  const [color, bg] = m[status] || ['#666', '#eee'];
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
