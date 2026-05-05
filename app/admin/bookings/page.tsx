'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { PageTopbar, PageHead, Panel } from '@/components/app/primitives';

interface Row {
  bookingId: string;
  clientId: string;
  businessName: string;
  customerName: string;
  customerPhone: string;
  date: string;
  timeSlot: string;
  service: string;
  status: string;
  createdAt: string;
  notes: string;
}

interface Data {
  ok: boolean;
  filter: { status: string | null };
  count: number;
  rows: Row[];
}

const STATUS_FILTERS: Array<{ key: string; label: string }> = [
  { key: '', label: 'All' },
  { key: 'pending_approval', label: 'Pending approval' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'completed', label: 'Completed' },
  { key: 'no_show', label: 'No-show' },
];

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

export default function AdminBookingsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  async function load(filter = statusFilter) {
    setErr(null);
    try {
      const url = `/api/admin/bookings?limit=300${filter ? `&status=${encodeURIComponent(filter)}` : ''}`;
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
      <PageTopbar crumbs={<>Admin → Bookings</>} />
      <PageHead
        title="Cross-tenant bookings"
        sub="Every booking across every client. Filter by status to chase pending-approval queues or recent cancellations."
      />

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
              Showing {data.count} bookings
              {data.filter.status ? ` · status=${data.filter.status}` : ''}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f7f7f8', textAlign: 'left' }}>
                    <th style={th}>Created (IST)</th>
                    <th style={th}>Business</th>
                    <th style={th}>Customer</th>
                    <th style={th}>When</th>
                    <th style={th}>Service</th>
                    <th style={th}>Status</th>
                    <th style={th}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.bookingId} style={{ borderTop: '1px solid #eee' }}>
                      <td style={td}>{fmtTime(r.createdAt)}</td>
                      <td style={td}>
                        <div>{r.businessName}</div>
                        <div style={{ color: '#888', fontSize: 11, fontFamily: 'monospace' }}>{r.clientId}</div>
                      </td>
                      <td style={td}>
                        <div>{r.customerName || '—'}</div>
                        <div style={{ color: '#888', fontSize: 11, fontFamily: 'monospace' }}>{r.customerPhone}</div>
                      </td>
                      <td style={td}>
                        <div>{r.date}</div>
                        <div style={{ color: '#888', fontSize: 12 }}>{r.timeSlot}</div>
                      </td>
                      <td style={td}>{r.service || '—'}</td>
                      <td style={td}><span style={pill(r.status)}>{r.status}</span></td>
                      <td style={{ ...td, fontSize: 11, color: '#666', maxWidth: 280 }}>
                        {r.notes || '—'}
                      </td>
                    </tr>
                  ))}
                  {data.rows.length === 0 && (
                    <tr>
                      <td style={{ ...td, color: '#888', textAlign: 'center' }} colSpan={7}>
                        No bookings match this filter.
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
    pending_approval: ['#c80', '#fff5e0'],
    confirmed: ['#0a0', '#e6f5e6'],
    cancelled: ['#c33', '#fde7e7'],
    completed: ['#0066cc', '#e0eef9'],
    no_show: ['#666', '#ececec'],
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
