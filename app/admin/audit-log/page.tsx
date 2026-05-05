'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { PageTopbar, PageHead, Panel } from '@/components/app/primitives';

interface Row {
  id: string;
  actorUserId: string;
  actorEmail: string;
  action: string;
  targetUserId: string;
  targetEmail: string;
  targetResource: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

interface Data {
  ok: boolean;
  count: number;
  rows: Row[];
}

function fmtTime(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function AdminAuditLogPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      const res = await fetch('/api/admin/audit-log?limit=300');
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
  }, []);

  return (
    <>
      <PageTopbar crumbs={<>Admin → Audit log</>} />
      <PageHead
        title="Admin Audit Log"
        sub="Every admin-side mutation: plan grants, bot seedings, deletions. Append-only, newest first."
      />
      <Panel>
        {loading && <div style={{ padding: 24, color: '#888' }}>Loading…</div>}
        {err && <div style={{ padding: 24, color: '#c33' }}>Error: {err}</div>}
        {!loading && !err && data && (
          <>
            <div style={{ padding: '12px 16px', color: '#666', fontSize: 13 }}>
              Showing {data.count} most recent entries
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f7f7f8', textAlign: 'left' }}>
                    <th style={th}>When (IST)</th>
                    <th style={th}>Actor</th>
                    <th style={th}>Action</th>
                    <th style={th}>Target</th>
                    <th style={th}>Resource</th>
                    <th style={th}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.id} style={{ borderTop: '1px solid #eee' }}>
                      <td style={td}>{fmtTime(r.createdAt)}</td>
                      <td style={td}>
                        <div>{r.actorEmail || r.actorUserId}</div>
                        {r.actorEmail && (
                          <div style={{ color: '#888', fontSize: 11 }}>{r.actorUserId}</div>
                        )}
                      </td>
                      <td style={{ ...td, fontFamily: 'monospace' }}>{r.action}</td>
                      <td style={td}>
                        <div>{r.targetEmail || r.targetUserId || '—'}</div>
                        {r.targetEmail && r.targetUserId && (
                          <div style={{ color: '#888', fontSize: 11 }}>{r.targetUserId}</div>
                        )}
                      </td>
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>
                        {r.targetResource || '—'}
                      </td>
                      <td style={td}>
                        {r.details ? (
                          <pre
                            style={{
                              margin: 0,
                              fontSize: 11,
                              background: '#f7f7f8',
                              padding: 8,
                              borderRadius: 4,
                              maxWidth: 360,
                              overflow: 'auto',
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {JSON.stringify(r.details, null, 2)}
                          </pre>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                  {data.rows.length === 0 && (
                    <tr>
                      <td style={{ ...td, color: '#888', textAlign: 'center' }} colSpan={6}>
                        No audit entries yet.
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
const td: CSSProperties = {
  padding: '10px 12px',
  verticalAlign: 'top',
};
