'use client';

import { useEffect, useState } from 'react';
import { PageTopbar, PageHead, Panel, StatusPill } from '@/components/app/primitives';

interface TemplateRow {
  name: string;
  language: string;
  category: string;
  description: string;
  body_preview: string;
  status: string;
  meta_template_id: string;
  last_error: string;
  submitted_at: string | null;
  updated_at: string | null;
}
interface Data {
  waba_id: string;
  total: number;
  counts: Record<string, number>;
  refreshed_from_meta: boolean;
  templates: TemplateRow[];
}

// Maps Meta + our local statuses to a StatusPill variant. The primitives
// component accepts active | ok | pending | cancel — anything unknown
// falls back to 'ok' so the UI never breaks if Meta adds a new state.
function pillVariant(status: string): 'active' | 'ok' | 'pending' | 'cancel' {
  if (status === 'APPROVED') return 'active';
  if (status === 'PENDING' || status === 'IN_APPEAL' || status === 'PAUSED' || status === 'NOT_SUBMITTED') return 'pending';
  if (status === 'REJECTED' || status === 'DISABLED') return 'cancel';
  return 'ok';
}

export default function TemplatesPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load(refreshFromMeta = false) {
    setRefreshing(refreshFromMeta);
    setErr(null);
    try {
      const url = refreshFromMeta
        ? '/api/admin/templates/status?refresh=1'
        : '/api/admin/templates/status';
      const res = await fetch(url);
      const body = await res.json();
      if (!res.ok) {
        setErr(body?.message || body?.error || `HTTP ${res.status}`);
      } else {
        setData(body);
      }
    } catch (e) {
      setErr(String(e).slice(0, 200));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load(false);
  }, []);

  const counts = data?.counts || {};
  const templates = data?.templates || [];
  const approvedCount = counts.APPROVED || 0;
  const pendingCount = counts.PENDING || 0;
  const rejectedCount = counts.REJECTED || 0;
  const notSubmitted = counts.NOT_SUBMITTED || 0;

  return (
    <>
      <PageTopbar
        crumbs={
          <>
            <b className="text-foreground">WhatsApp templates</b>
            {data ? (
              <>
                {' '}· WABA <span className="zt-mono text-[11.5px] text-[var(--mute)]">{data.waba_id}</span>
                {' '}· {approvedCount} approved · {pendingCount} pending · {rejectedCount} rejected
              </>
            ) : null}
          </>
        }
      />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead
          title={<>Message <span className="zt-serif">templates.</span></>}
          sub="Status of every template submitted to Meta. Pending templates usually approve within a few hours."
        />

        <div className="flex items-center gap-2 mb-5">
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing || loading}
            className="rounded-full border border-[var(--line)] bg-[var(--card)] hover:bg-[var(--bg-mute)] disabled:opacity-50 zt-mono text-[11.5px] uppercase tracking-[.06em]"
            style={{ padding: '8px 16px' }}
          >
            {refreshing ? 'Refreshing from Meta...' : 'Refresh from Meta'}
          </button>
          <span className="text-[11.5px] text-[var(--mute)] zt-mono">
            (pulls live state from Meta and updates the local cache)
          </span>
        </div>

        {loading ? (
          <div className="animate-pulse h-64 bg-[var(--card)] border border-[var(--line)] rounded-[18px]" />
        ) : err ? (
          <Panel title="Error">
            <p className="text-[13px] text-red-500 m-0" style={{ wordBreak: 'break-word' }}>{err}</p>
            <p className="text-[12px] text-[var(--mute)] mt-2 mb-0">
              Check WHATSAPP_BUSINESS_ACCOUNT_ID and WHATSAPP_ACCESS_TOKEN are set in Vercel.
            </p>
          </Panel>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-6">
              <StatCard label="Approved" value={approvedCount} sub="ready to send" tone="active" />
              <StatCard label="Pending" value={pendingCount} sub="Meta reviewing" tone="warn" />
              <StatCard label="Rejected" value={rejectedCount} sub="needs body fix" tone="error" />
              <StatCard label="Not submitted" value={notSubmitted} sub="run submit-templates" tone="mute" />
            </div>

            <Panel title={`All templates (${templates.length})`}>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Name', 'Lang', 'Category', 'Status', 'Body preview', 'Updated', 'Last error'].map((h) => (
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
                    {templates.map((t) => (
                      <tr key={`${t.name}-${t.language}`}>
                        <td className="font-semibold zt-mono text-[12px]" style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
                          {t.name}
                        </td>
                        <td className="zt-mono text-[11.5px] uppercase text-[var(--mute)]" style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
                          {t.language}
                        </td>
                        <td className="zt-mono text-[11.5px] text-[var(--mute)]" style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
                          {t.category}
                        </td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
                          <StatusPill variant={pillVariant(t.status)}>{t.status}</StatusPill>
                        </td>
                        <td className="text-[12px] text-[var(--ink)]" style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', maxWidth: 360 }}>
                          {t.body_preview}{t.body_preview.length >= 100 ? '...' : ''}
                        </td>
                        <td className="zt-mono text-[11px] text-[var(--mute)]" style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
                          {t.updated_at ? new Date(t.updated_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                        </td>
                        <td className="text-[11.5px] text-red-500" style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', maxWidth: 280, wordBreak: 'break-word' }}>
                          {t.last_error || ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        )}
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub: string;
  tone: 'active' | 'warn' | 'error' | 'mute';
}) {
  const valueColor =
    tone === 'active' ? 'text-emerald-500'
    : tone === 'warn' ? 'text-amber-500'
    : tone === 'error' ? 'text-red-500'
    : 'text-[var(--ink)]';
  return (
    <div
      className="rounded-[18px] border border-[var(--line)] bg-[var(--card)]"
      style={{ padding: '18px 20px' }}
    >
      <div className="text-[11.5px] text-[var(--mute)] zt-mono uppercase tracking-[.06em]">{label}</div>
      <div className={`text-[28px] font-bold tracking-[-0.025em] leading-none mt-1 ${valueColor}`}>{value}</div>
      <div className="text-[11.5px] text-[var(--mute)] mt-2">{sub}</div>
    </div>
  );
}
