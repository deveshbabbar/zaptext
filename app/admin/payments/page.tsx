'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { PageTopbar, PageHead, Panel } from '@/components/app/primitives';

interface Row {
  userId: string;
  plan: string;
  status: 'active' | 'expired' | 'cancelled';
  razorpayPaymentId: string;
  razorpayOrderId: string;
  amount: number;
  startDate: string;
  endDate: string;
  createdAt: string;
}

interface Data {
  ok: boolean;
  filter: { status: string | null };
  totalCount: number;
  filteredCount: number;
  tally: Record<string, number>;
  totalRevenueRupees: number;
  rows: Row[];
}

const STATUS_FILTERS: Array<{ key: string; label: string }> = [
  { key: '', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'expired', label: 'Expired' },
  { key: 'cancelled', label: 'Cancelled / refunded' },
];

function fmt(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: '2-digit',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function AdminPaymentsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  async function load(filter = statusFilter) {
    setErr(null);
    try {
      const url = `/api/admin/payments${filter ? `?status=${encodeURIComponent(filter)}` : ''}`;
      const res = await fetch(url);
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

  function applyFilter(s: string) {
    setStatusFilter(s);
    setLoading(true);
    load(s);
  }

  return (
    <>
      <PageTopbar crumbs={<>Admin → Payments</>} />
      <PageHead
        title="Payments &amp; subscriptions log"
        sub="Full audit-friendly view: active, expired, refunded. Use /admin/revenue for MRR aggregates and /admin/subscriptions for current paying customers."
      />

      {data && (
        <div style={statGrid}>
          <Stat label="Total subscriptions" value={data.totalCount.toLocaleString()} />
          <Stat label="Active" value={(data.tally.active || 0).toLocaleString()} tone="ok" />
          <Stat
            label="Cancelled / refunded"
            value={(data.tally.cancelled || 0).toLocaleString()}
            tone={(data.tally.cancelled || 0) > 0 ? 'warn' : 'ok'}
          />
          <Stat label="Total recognised revenue" value={`₹${data.totalRevenueRupees.toLocaleString()}`} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => applyFilter(f.key)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: statusFilter === f.key ? '1px solid #333' : '1px solid #ddd',
              background: statusFilter === f.key ? '#222' : '#fff',
              color: statusFilter === f.key ? '#fff' : '#222',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Panel>
        {loading && <div style={{ padding: 24, color: '#888' }}>Loading…</div>}
        {err && <div style={{ padding: 24, color: '#c33' }}>Error: {err}</div>}
        {!loading && !err && data && (
          <>
            <div style={{ padding: '12px 16px', color: '#666', fontSize: 13 }}>
              Showing {data.filteredCount} of {data.totalCount}
              {data.filter.status ? ` · status=${data.filter.status}` : ''}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f7f7f8', textAlign: 'left' }}>
                    <th style={th}>Created</th>
                    <th style={th}>User</th>
                    <th style={th}>Plan</th>
                    <th style={th}>Amount</th>
                    <th style={th}>Status</th>
                    <th style={th}>Period</th>
                    <th style={th}>Razorpay</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={`${r.razorpayPaymentId || r.userId}-${r.createdAt}`} style={{ borderTop: '1px solid #eee' }}>
                      <td style={td}>{fmt(r.createdAt)}</td>
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>{r.userId}</td>
                      <td style={td}>{r.plan}</td>
                      <td style={td}>₹{(r.amount || 0).toLocaleString()}</td>
                      <td style={td}><span style={pill(r.status)}>{r.status}</span></td>
                      <td style={td}>
                        <div>{fmt(r.startDate)}</div>
                        <div style={{ color: '#888', fontSize: 11 }}>→ {fmt(r.endDate)}</div>
                      </td>
                      <td style={{ ...td, fontSize: 11, fontFamily: 'monospace' }}>
                        <div>{r.razorpayPaymentId || '—'}</div>
                        <div style={{ color: '#888' }}>{r.razorpayOrderId || ''}</div>
                      </td>
                    </tr>
                  ))}
                  {data.rows.length === 0 && (
                    <tr>
                      <td style={{ ...td, color: '#888', textAlign: 'center' }} colSpan={7}>
                        No subscriptions match this filter.
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
      <div style={{ fontSize: 24, fontWeight: 700, color: c[tone] || '#222', marginTop: 4 }}>{value}</div>
    </div>
  );
}

const statGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
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
  const map: Record<string, [string, string]> = {
    active: ['#0a0', '#e6f5e6'],
    expired: ['#666', '#ececec'],
    cancelled: ['#c33', '#fde7e7'],
  };
  const [color, bg] = map[status] || ['#666', '#ececec'];
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
