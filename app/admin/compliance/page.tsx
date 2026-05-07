'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { PageTopbar, PageHead, Panel } from '@/components/app/primitives';

interface RejectedTemplate {
  wabaId: string;
  templateName: string;
  language: string;
  category: string;
  lastError: string;
  updatedAt: string;
}
interface ComplianceData {
  ok: boolean;
  now: string;
  optIn: { total: number; accepted: number; coveragePct: number };
  templates: {
    byStatus: Array<{ status: string; count: number }>;
    recentlyRejected: RejectedTemplate[];
  };
  bots: {
    activeCount: number;
    missingWhatsAppNumber: number;
    withPrompt: number;
    emptyPrompt: number;
  };
  messages7d: { inbound: number; outbound: number };
  policy: Record<string, string>;
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

export default function AdminCompliancePage() {
  const [data, setData] = useState<ComplianceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      const res = await fetch('/api/admin/compliance');
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

  const inboundOutboundRatio =
    data && data.messages7d.inbound > 0
      ? (data.messages7d.outbound / data.messages7d.inbound).toFixed(2)
      : '—';

  return (
    <>
      <PageTopbar crumbs={<>Admin → Compliance</>} />
      <PageHead
        title="Meta Compliance Posture"
        sub="WhatsApp Business Policy + DPDP Act 2026 readiness. Refreshes every minute. Use this to show auditors what we enforce in code."
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
            <Stat
              label="Opt-in coverage"
              value={`${data.optIn.coveragePct}%`}
              tone={data.optIn.coveragePct >= 100 ? 'ok' : data.optIn.coveragePct >= 95 ? 'warn' : 'err'}
              sub={`${data.optIn.accepted} of ${data.optIn.total} active bots`}
            />
            <Stat
              label="Bots missing WhatsApp number"
              value={data.bots.missingWhatsAppNumber.toLocaleString()}
              tone={data.bots.missingWhatsAppNumber > 0 ? 'err' : 'ok'}
            />
            <Stat
              label="Bots with empty prompt"
              value={data.bots.emptyPrompt.toLocaleString()}
              tone={data.bots.emptyPrompt > 0 ? 'warn' : 'ok'}
              sub={`${data.bots.withPrompt} configured`}
            />
            <Stat
              label="Inbound messages (7d)"
              value={data.messages7d.inbound.toLocaleString()}
            />
            <Stat
              label="Outbound : Inbound (7d)"
              value={inboundOutboundRatio}
              tone={
                typeof inboundOutboundRatio === 'string' &&
                inboundOutboundRatio !== '—' &&
                Number(inboundOutboundRatio) > 5
                  ? 'warn'
                  : 'ok'
              }
              sub={`${data.messages7d.outbound.toLocaleString()} out / ${data.messages7d.inbound.toLocaleString()} in`}
            />
          </div>

          <Panel>
            <div style={panelHead}>WhatsApp Templates — approval status</div>
            <div style={{ padding: '8px 16px 16px' }}>
              {data.templates.byStatus.length === 0 ? (
                <div style={{ color: '#888' }}>No templates submitted yet.</div>
              ) : (
                data.templates.byStatus.map((s) => (
                  <div key={s.status} style={inlineRow}>
                    <span style={{ fontFamily: 'monospace' }}>{s.status}</span>
                    <span
                      style={{
                        ...pill(
                          s.status === 'APPROVED'
                            ? 'ok'
                            : s.status === 'REJECTED' || s.status === 'DISABLED'
                            ? 'err'
                            : 'warn'
                        ),
                      }}
                    >
                      {s.count}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Panel>

          {data.templates.recentlyRejected.length > 0 && (
            <Panel>
              <div style={panelHead}>Recently rejected templates — operator action required</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f7f7f8', textAlign: 'left' }}>
                    <th style={th}>Template</th>
                    <th style={th}>Language</th>
                    <th style={th}>Category</th>
                    <th style={th}>Reason</th>
                    <th style={th}>When</th>
                  </tr>
                </thead>
                <tbody>
                  {data.templates.recentlyRejected.map((t) => (
                    <tr key={`${t.wabaId}-${t.templateName}-${t.language}`} style={{ borderTop: '1px solid #eee' }}>
                      <td style={{ ...td, fontFamily: 'monospace' }}>{t.templateName}</td>
                      <td style={td}>{t.language}</td>
                      <td style={td}>{t.category}</td>
                      <td style={{ ...td, color: '#c33', maxWidth: 360, whiteSpace: 'normal' }}>
                        {t.lastError}
                      </td>
                      <td style={td}>{fmtTime(t.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}

          <Panel>
            <div style={panelHead}>Platform-wide policy enforcement</div>
            <div style={{ padding: '8px 16px 16px' }}>
              {Object.entries(data.policy).map(([key, value]) => (
                <div key={key} style={{ ...inlineRow, alignItems: 'flex-start' }}>
                  <span style={{ fontFamily: 'monospace', minWidth: 180, color: '#444' }}>{key}</span>
                  <span style={{ color: '#222', textAlign: 'right', maxWidth: 540 }}>{value}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <div style={panelHead}>How to read this dashboard</div>
            <div style={{ padding: '12px 16px', color: '#444', fontSize: 13, lineHeight: 1.6 }}>
              <p>
                <b>Opt-in coverage</b> should always be <b>100%</b> — onboarding rejects bots
                without explicit opt-in attestation. If this drops below 100%, a legacy bot
                exists that pre-dates the opt-in field.
              </p>
              <p>
                <b>Outbound : Inbound &gt; 5</b> means the platform is broadcasting heavily
                relative to incoming traffic. Verify that broadcasts go only to opted-in
                contacts and use APPROVED templates.
              </p>
              <p>
                <b>Empty-prompt bots</b> should always be <b>0</b> — these bots will respond
                with the default error string. Investigate and either fix the prompt or pause
                the bot.
              </p>
              <p>
                <b>Rejected templates</b> need attention: each one is a broadcast capability
                the operator can&apos;t use. Read the reason, fix the body, resubmit via
                /admin/templates.
              </p>
            </div>
          </Panel>
        </>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  tone = 'ok',
  sub,
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'err';
  sub?: string;
}) {
  const colorMap: Record<string, string> = { ok: '#0a0', warn: '#c80', err: '#c33' };
  return (
    <div style={statCard}>
      <div style={{ fontSize: 13, color: '#666' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: colorMap[tone] || '#222', marginTop: 4 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{sub}</div>}
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
