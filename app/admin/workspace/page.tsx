'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageTopbar, PageHead, Panel, Pill, StatusPill, MonoLabel } from '@/components/app/primitives';

const PLAN_OPTIONS = ['starter', 'growth', 'pro', 'enterprise'] as const;

interface InitReport {
  spreadsheetId: string;
  tabsCreated: string[];
  tabsAlreadyExisted: string[];
  headersWritten: string[];
  headersAlreadyExisted: string[];
  errors: { tab: string; message: string }[];
}

export default function WorkspacePage() {
  const [workspaceName, setWorkspaceName] = useState('ZapText HQ');
  const [language, setLanguage] = useState('English + Hinglish');
  const [timezone, setTimezone] = useState('Asia/Kolkata (IST)');
  const [notificationEmail, setNotificationEmail] = useState('admin@zaptext.shop');
  const [initing, setIniting] = useState(false);
  const [initReport, setInitReport] = useState<InitReport | null>(null);

  // Grant plan state
  const [grantEmail, setGrantEmail] = useState('');
  const [grantPlan, setGrantPlan] = useState<typeof PLAN_OPTIONS[number]>('enterprise');
  const [grantMonths, setGrantMonths] = useState('12');
  const [granting, setGranting] = useState(false);
  const [grantResult, setGrantResult] = useState<{ name: string; plan: string; validUntil: string } | null>(null);

  const runGrant = async () => {
    if (!grantEmail.trim()) { toast.error('Email required'); return; }
    setGranting(true);
    setGrantResult(null);
    try {
      const res = await fetch('/api/admin/grant-plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: grantEmail.trim(), plan: grantPlan, months: parseInt(grantMonths, 10) || 12 }),
      });
      const data = await res.json();
      if (data.ok) {
        setGrantResult({ name: data.name || data.email, plan: data.plan, validUntil: data.validUntil });
        toast.success(`✅ ${grantPlan} plan granted to ${data.name || grantEmail}!`);
      } else {
        toast.error(data.error || 'Grant failed');
      }
    } catch (e) {
      toast.error(`Error: ${String(e).slice(0, 200)}`);
    } finally {
      setGranting(false);
    }
  };

  const runInit = async () => {
    setIniting(true);
    setInitReport(null);
    try {
      const res = await fetch('/api/admin/init-sheets', { method: 'POST' });
      const data = await res.json();
      if (data.ok && data.report) {
        setInitReport(data.report as InitReport);
        const { tabsCreated, headersWritten, errors } = data.report as InitReport;
        if (errors.length > 0) {
          toast.error(`Completed with ${errors.length} error${errors.length > 1 ? 's' : ''}`);
        } else if (tabsCreated.length === 0 && headersWritten.length === 0) {
          toast.success('Already initialized — nothing to do ✓');
        } else {
          toast.success(`Done! ${tabsCreated.length} tab${tabsCreated.length !== 1 ? 's' : ''} created, ${headersWritten.length} header row${headersWritten.length !== 1 ? 's' : ''} written`);
        }
      } else {
        toast.error(data.error || 'Init failed');
      }
    } catch (e) {
      toast.error(`Init failed: ${String(e).slice(0, 200)}`);
    } finally {
      setIniting(false);
    }
  };

  return (
    <>
      <PageTopbar
        crumbs={<><b className="text-foreground">Workspace</b> · settings & branding</>}
        actions={<Pill variant="ink">Save changes</Pill>}
      />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead
          title={<>Workspace <span className="zt-serif">settings.</span></>}
          sub="Your admin defaults, branding, and billing."
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="General">
            <div className="flex flex-col gap-3.5">
              <LabeledInput label="Workspace name" value={workspaceName} onChange={setWorkspaceName} />
              <LabeledInput label="Default language" value={language} onChange={setLanguage} />
              <LabeledInput label="Timezone" value={timezone} onChange={setTimezone} />
              <LabeledInput label="Notification email" value={notificationEmail} onChange={setNotificationEmail} type="email" />
            </div>
          </Panel>

          <Panel title="Branding">
            <div className="flex flex-col gap-3.5">
              <div>
                <div className="text-[12.5px] font-semibold mb-1.5">Logo</div>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-[12px] bg-[var(--bg-2)] border border-[var(--line)] flex items-center justify-center text-[24px]">
                    🤖
                  </div>
                  <Pill>Upload new logo</Pill>
                </div>
                <p className="text-[11.5px] text-[var(--mute)] mt-1.5 m-0">PNG or SVG, 512×512 recommended.</p>
              </div>
              <div>
                <div className="text-[12.5px] font-semibold mb-1.5">Primary color</div>
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-[8px] border border-[var(--line)]" style={{ backgroundColor: '#DCFE5A' }} />
                  <input
                    readOnly
                    value="#DCFE5A"
                    className="max-w-[140px] rounded-[10px] border border-[var(--line)] bg-[var(--card)] zt-mono text-[13px]"
                    style={{ padding: '8px 10px' }}
                  />
                  <span
                    className="zt-mono text-[10.5px] border border-[var(--line)] rounded-full"
                    style={{ padding: '2px 8px' }}
                  >
                    ZapText Lime
                  </span>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Billing" className="lg:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <div className="text-[12.5px] text-[var(--mute)]">Current plan</div>
                <div className="text-[17px] font-semibold mt-1">Business</div>
                <span
                  className="zt-mono text-[11px] bg-[var(--accent)] text-[var(--accent-2)] rounded-full font-bold mt-2 inline-block"
                  style={{ padding: '3px 10px' }}
                >
                  ₹4,999 / month
                </span>
              </div>
              <div>
                <div className="text-[12.5px] text-[var(--mute)]">Payment method</div>
                <div className="text-[17px] font-semibold mt-1 zt-mono">Visa •••• 4242</div>
                <Pill>Update payment method</Pill>
              </div>
            </div>
          </Panel>

          <Panel
            title="Grant plan to user"
            sub="Assign any plan directly by email — for testing, partnerships, or manual overrides. No payment required."
            className="lg:col-span-2"
            action={<Pill variant="ink" onClick={runGrant}>{granting ? 'Granting…' : '🎁 Grant plan'}</Pill>}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-1">
                <MonoLabel className="mb-1.5">Email</MonoLabel>
                <input type="email" value={grantEmail} onChange={(e) => setGrantEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--card)] focus:border-[var(--ink)] focus:outline-none text-[13.5px]"
                  style={{ padding: '10px 12px' }} />
              </div>
              <div>
                <MonoLabel className="mb-1.5">Plan</MonoLabel>
                <div className="flex gap-1.5 flex-wrap">
                  {PLAN_OPTIONS.map((p) => (
                    <button key={p} onClick={() => setGrantPlan(p)}
                      className={`rounded-full text-[12.5px] font-semibold border capitalize transition ${
                        grantPlan === p ? 'bg-[var(--ink)] text-[var(--background)] border-[var(--ink)]' : 'border-[var(--line)] hover:border-[var(--ink)]'
                      }`}
                      style={{ padding: '6px 12px' }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <MonoLabel className="mb-1.5">Duration (months)</MonoLabel>
                <input type="number" min={1} max={120} value={grantMonths} onChange={(e) => setGrantMonths(e.target.value)}
                  className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--card)] focus:border-[var(--ink)] focus:outline-none text-[13.5px]"
                  style={{ padding: '10px 12px' }} />
              </div>
            </div>
            {grantResult && (
              <div className="mt-3 flex items-center gap-3 rounded-[10px] border border-[var(--accent)]"
                style={{ padding: '12px 14px', background: 'color-mix(in oklab, var(--accent) 15%, transparent)' }}>
                <StatusPill variant="active">{grantResult.plan}</StatusPill>
                <span className="text-[13px]">
                  <b>{grantResult.name}</b> — valid until <b>{grantResult.validUntil}</b>
                </span>
              </div>
            )}
          </Panel>

          <Panel
            title="Google Sheets setup"
            sub="Create any missing tabs (clients, conversations, analytics, bookings, weekly_schedule, date_overrides, subscriptions) and write the correct header rows. Safe to run multiple times — existing data is untouched."
            className="lg:col-span-2"
            action={
              <Pill variant="ink" onClick={runInit}>
                {initing ? 'Running…' : '🧩 Initialize sheets'}
              </Pill>
            }
          >
            {initReport ? (
              <div className="flex flex-col gap-3">
                <ReportRow label="Tabs created" items={initReport.tabsCreated} variant="active" />
                <ReportRow label="Tabs already existed" items={initReport.tabsAlreadyExisted} variant="ok" />
                <ReportRow label="Headers written" items={initReport.headersWritten} variant="active" />
                <ReportRow label="Headers already existed" items={initReport.headersAlreadyExisted} variant="ok" />
                {initReport.errors.length > 0 && (
                  <div>
                    <div className="zt-mono text-[11px] text-[var(--mute)] uppercase tracking-[.08em] mb-1.5">
                      Errors ({initReport.errors.length})
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {initReport.errors.map((e, i) => (
                        <div
                          key={i}
                          className="text-[12.5px] border border-red-500/30 bg-red-500/10 rounded-[8px]"
                          style={{ padding: '8px 12px' }}
                        >
                          <b>{e.tab}</b>: {e.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="zt-mono text-[11px] text-[var(--mute)] mt-2">
                  Sheet ID: {initReport.spreadsheetId}
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-[var(--mute)] m-0">
                Click <b>Initialize sheets</b> to auto-setup or verify your Google Sheet structure.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

function ReportRow({
  label,
  items,
  variant,
}: {
  label: string;
  items: string[];
  variant: 'active' | 'ok';
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="zt-mono text-[11px] text-[var(--mute)] uppercase tracking-[.08em] mb-1.5">
        {label} ({items.length})
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((t) => (
          <StatusPill key={t} variant={variant}>
            {t}
          </StatusPill>
        ))}
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <div className="text-[12.5px] font-semibold mb-1.5">{label}</div>
      <input
        type={type || 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--card)] focus:border-[var(--ink)] focus:outline-none text-[13.5px]"
        style={{ padding: '11px 13px' }}
      />
    </div>
  );
}
