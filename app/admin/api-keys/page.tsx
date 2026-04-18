'use client';

import { useState } from 'react';
import { PageTopbar, PageHead, Panel, Pill, StatusPill } from '@/components/app/primitives';

const INTEGRATIONS = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: '✨',
    description: 'LLM powering your bot replies',
    maskedKey: 'AIza•••••b8I',
    meta: null as string | null,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Cloud API',
    icon: '💬',
    description: 'Meta Business access token',
    maskedKey: 'EAA•••••AVu',
    meta: null,
  },
  {
    id: 'sheets',
    name: 'Google Sheets',
    icon: '📊',
    description: 'Service account for analytics & bookings',
    maskedKey: 'bot-factory@wa-bot.iam.gserviceaccount.com',
    meta: null,
  },
  {
    id: 'razorpay',
    name: 'Razorpay',
    icon: '💳',
    description: 'Payment gateway',
    maskedKey: 'rzp_test_•••••Xy9',
    meta: 'Test mode',
  },
];

const WEBHOOK_URL = 'https://zaptext.shop/api/webhook';
const VERIFY_TOKEN = 'zaptext-verify-token';

export default function ApiKeysPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <>
      <PageTopbar crumbs={<><b className="text-foreground">API keys</b> · integrations & webhooks</>} />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead
          title={<>Keys & <span className="zt-serif">webhooks.</span></>}
          sub="Integration credentials — rotate regularly."
        />

        <h2 className="text-[17px] font-bold tracking-[-0.015em] mb-3.5">Integrations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-8">
          {INTEGRATIONS.map((it) => (
            <Panel key={it.id}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="text-[24px]">{it.icon}</div>
                  <div className="font-bold text-[15.5px]">{it.name}</div>
                </div>
                {it.meta && <StatusPill variant="pending">{it.meta}</StatusPill>}
              </div>
              <p className="text-[12.5px] text-[var(--mute)] m-0 mb-3">{it.description}</p>
              <div className="flex items-center gap-2">
                <code
                  className="flex-1 zt-mono text-[12.5px] bg-[var(--bg-2)] rounded-[8px] truncate overflow-hidden"
                  style={{ padding: '8px 12px' }}
                >
                  {it.maskedKey}
                </code>
                <Pill onClick={() => copy(it.id, it.maskedKey)}>
                  {copied === it.id ? 'Copied' : 'Copy'}
                </Pill>
                <Pill>Rotate</Pill>
              </div>
            </Panel>
          ))}
        </div>

        <h2 className="text-[17px] font-bold tracking-[-0.015em] mb-3.5">Webhooks</h2>
        <Panel title="WhatsApp webhook configuration">
          <div className="flex flex-col gap-3.5">
            <div>
              <div className="text-[12.5px] font-semibold mb-1.5">Webhook URL</div>
              <div className="flex items-center gap-2">
                <input
                  value={WEBHOOK_URL}
                  readOnly
                  className="flex-1 rounded-[10px] border border-[var(--line)] bg-[var(--card)] zt-mono text-[13px]"
                  style={{ padding: '9px 12px' }}
                />
                <Pill onClick={() => copy('webhook-url', WEBHOOK_URL)}>
                  {copied === 'webhook-url' ? 'Copied' : 'Copy'}
                </Pill>
              </div>
              <p className="text-[11.5px] text-[var(--mute)] mt-1.5 m-0">
                Paste this into Meta Business webhook config.
              </p>
            </div>
            <div>
              <div className="text-[12.5px] font-semibold mb-1.5">Verify token</div>
              <div className="flex items-center gap-2">
                <input
                  value={VERIFY_TOKEN}
                  readOnly
                  className="flex-1 rounded-[10px] border border-[var(--line)] bg-[var(--card)] zt-mono text-[13px]"
                  style={{ padding: '9px 12px' }}
                />
                <Pill onClick={() => copy('verify-token', VERIFY_TOKEN)}>
                  {copied === 'verify-token' ? 'Copied' : 'Copy'}
                </Pill>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
