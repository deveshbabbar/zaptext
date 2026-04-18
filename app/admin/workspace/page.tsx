'use client';

import { useState } from 'react';
import { PageTopbar, PageHead, Panel, Pill } from '@/components/app/primitives';

export default function WorkspacePage() {
  const [workspaceName, setWorkspaceName] = useState('ZapText HQ');
  const [language, setLanguage] = useState('English + Hinglish');
  const [timezone, setTimezone] = useState('Asia/Kolkata (IST)');
  const [notificationEmail, setNotificationEmail] = useState('admin@zaptext.shop');

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
        </div>
      </div>
    </>
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
