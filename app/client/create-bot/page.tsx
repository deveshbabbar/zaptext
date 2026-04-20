'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CommonFieldsForm } from '@/components/forms/common-fields';
import { TypeFieldsForm } from '@/components/forms/type-fields';
import { BUSINESS_TYPES } from '@/lib/constants';
import { BusinessType } from '@/lib/types';
import { toast } from 'sonner';
import { PageTopbar, PageHead, Panel, Pill, MonoLabel } from '@/components/app/primitives';

export default function CreateBotPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<BusinessType | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({
    languages: ['English'],
  });
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hasActivePlan, setHasActivePlan] = useState<boolean | null>(null);
  const [optInAccepted, setOptInAccepted] = useState(false);

  useEffect(() => {
    fetch('/api/client/subscription')
      .then((r) => r.json())
      .then((d) => setHasActivePlan(!!d.current))
      .catch(() => setHasActivePlan(false));
  }, []);

  const onChange = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const selectType = (t: BusinessType) => {
    setSelectedType(t);
    setFormData((prev) => ({ ...prev, type: t }));
  };

  const goToStep2 = () => {
    if (!selectedType) {
      toast.error('Please select a business type');
      return;
    }
    setStep(2);
  };

  const handleAutoFill = async () => {
    if (!websiteUrl.trim()) {
      toast.error('Enter a URL');
      return;
    }
    // Capture selectedType NOW before any await — prevents stale closure if
    // user changes type selector while the scrape request is in-flight.
    const typeForScrape = selectedType;
    setScraping(true);
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: websiteUrl, businessType: typeForScrape }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setFormData((prev) => {
          const merged: Record<string, unknown> = { ...prev };
          for (const [key, value] of Object.entries(data.data)) {
            if (value && (!(key in prev) || prev[key] === '' || prev[key] === undefined)) merged[key] = value;
          }
          merged.type = typeForScrape;
          return merged;
        });
        if (data.partial && data.message) {
          toast.warning(data.message);
        } else {
          toast.success('Data extracted! Review and complete any missing fields.');
        }
      } else {
        toast.error(data.error || 'Could not extract');
      }
    } catch {
      toast.error('Failed to fetch');
    } finally {
      setScraping(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.businessName || !formData.ownerName || !formData.whatsappNumber) {
      toast.error('Fill Business Name, Owner Name, and WhatsApp Number');
      return;
    }
    if (!optInAccepted) {
      toast.error('Please confirm you have opt-in consent from your customers before creating a bot.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: formData, phoneNumberId: '', optInAccepted }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('🎉 Bot request submitted! Our team will review within 48 hours.');
        router.push('/client/dashboard?activated=pending');
      } else if (data.error === 'NO_PLAN') {
        toast.error('Please purchase a plan first!');
        router.push('/client/subscription');
      } else if (data.error === 'BOT_LIMIT') {
        toast.error(data.message || 'Bot limit reached. Please upgrade.');
        router.push('/client/subscription');
      } else {
        toast.error(data.error || 'Failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const activeMeta = selectedType ? BUSINESS_TYPES.find((bt) => bt.type === selectedType) : null;

  if (hasActivePlan === false) {
    return (
      <>
        <PageTopbar crumbs={<><b className="text-foreground">Create bot</b></>} />
        <div style={{ padding: '28px 32px 60px' }} className="max-w-lg mx-auto text-center">
          <div className="bg-[var(--card)] border border-[var(--line)] rounded-[22px]" style={{ padding: 40 }}>
            <div className="text-[44px] mb-3">🔒</div>
            <h1 className="text-[26px] font-bold tracking-[-0.02em] mb-2">Plan required</h1>
            <p className="text-[var(--ink-2)] mb-6">You need an active subscription to create a bot.</p>
            <Pill variant="ink" href="/client/subscription">
              Choose a plan →
            </Pill>
          </div>
        </div>
      </>
    );
  }

  if (hasActivePlan === null) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-[var(--ink)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <PageTopbar crumbs={<><b className="text-foreground">Create bot</b> · step {step} of 2</>} />
      <div style={{ padding: '28px 32px 60px' }} className="max-w-4xl mx-auto">
        <Stepper step={step} />

        {step === 1 && (
          <>
            <PageHead
              title={<>What kind of <span className="zt-serif">business?</span></>}
              sub="We'll tailor the bot's personality and FAQ presets to match."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              {BUSINESS_TYPES.map((bt) => {
                const active = selectedType === bt.type;
                return (
                  <button
                    key={bt.type}
                    type="button"
                    onClick={() => selectType(bt.type)}
                    className={`text-left border rounded-[14px] cursor-pointer transition-all ${
                      active
                        ? 'bg-[var(--ink)] text-[var(--background)] border-[var(--ink)]'
                        : 'bg-[var(--card)] border-[var(--line)] hover:border-[var(--ink)]'
                    }`}
                    style={{ padding: 20, boxShadow: active ? 'inset 0 0 0 2px var(--accent)' : 'none' }}
                  >
                    <div className="text-[30px] leading-none">{bt.icon}</div>
                    <h4 className="text-[15px] font-bold mt-2 mb-0.5">{bt.label}</h4>
                    <p className={`text-[12px] m-0 ${active ? 'text-white/60' : 'text-[var(--mute)]'}`}>
                      {bt.description}
                    </p>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end">
              <Pill variant="ink" onClick={goToStep2}>
                Continue →
              </Pill>
            </div>
          </>
        )}

        {step === 2 && selectedType && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <PageHead
              title={
                <>
                  Tell us about <span className="zt-serif">{activeMeta?.label.toLowerCase()}</span> {activeMeta?.icon}
                </>
              }
              sub="The AI learns from this to answer customers."
            />

            <div
              className="relative overflow-hidden rounded-[14px] border border-dashed"
              style={{
                padding: 20,
                borderColor: 'color-mix(in oklab, var(--accent) 50%, transparent)',
                background: 'color-mix(in oklab, var(--accent) 12%, transparent)',
              }}
            >
              <div className="text-[14px] font-bold flex items-center gap-1.5 mb-1">✨ Auto-fill with AI</div>
              <p className="text-[12.5px] text-[var(--mute)] mb-3 m-0">
                Paste your Zomato / Swiggy / Instagram link — we&apos;ll extract everything
              </p>
              <div className="flex gap-2">
                <input
                  placeholder="https://zomato.com/your-restaurant"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="flex-1 rounded-[10px] border border-[var(--line)] bg-[var(--card)] focus:border-[var(--ink)] focus:outline-none text-[13.5px]"
                  style={{ padding: '11px 13px' }}
                />
                <Pill variant="ink" type="button" onClick={handleAutoFill} disabled={scraping}>
                  {scraping ? 'Extracting…' : '🔍 Extract'}
                </Pill>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[var(--line)]" />
              <MonoLabel>Or fill manually</MonoLabel>
              <div className="flex-1 h-px bg-[var(--line)]" />
            </div>

            <Panel>
              <CommonFieldsForm data={formData} onChange={onChange} />
            </Panel>

            <Panel>
              <TypeFieldsForm type={selectedType} data={formData} onChange={onChange} />
            </Panel>

            <div className="rounded-[12px] border border-[var(--line)] bg-[var(--card)] p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={optInAccepted}
                  onChange={(e) => setOptInAccepted(e.target.checked)}
                  className="mt-1 accent-[var(--ink)] w-4 h-4"
                  required
                />
                <span className="text-[13px] leading-[1.5]">
                  <b>I confirm I have valid opt-in consent</b> from every customer whose number my bot
                  will message, per WhatsApp Business Messaging Policy. I will not send unsolicited
                  messages, will honor opt-outs, and will not use this bot for prohibited categories
                  (healthcare, firearms, cryptocurrency, adult, gambling, etc.).
                  <br />
                  <a href="/terms" target="_blank" className="text-[var(--ink)] underline">View terms</a>
                </span>
              </label>
            </div>

            <div className="flex justify-between">
              <Pill onClick={() => setStep(1)}>← Back</Pill>
              <Pill variant="ink" type="submit" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create my bot 🚀'}
              </Pill>
            </div>
          </form>
        )}
      </div>
    </>
  );
}

function Stepper({ step }: { step: 1 | 2 }) {
  const steps: { n: number; label: string; state: 'active' | 'done' | 'pending' }[] = [
    { n: 1, label: 'Type', state: step > 1 ? 'done' : 'active' },
    { n: 2, label: 'Details', state: step === 2 ? 'active' : step > 2 ? 'done' : 'pending' },
    { n: 3, label: 'Go live', state: 'pending' },
  ];
  return (
    <div className="flex items-center gap-3 mb-8">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center gap-3 flex-1 last:flex-none">
          <div
            className={`flex items-center gap-2.5 rounded-full border text-[13px] font-medium ${
              s.state === 'active'
                ? 'bg-[var(--ink)] text-[var(--background)] border-[var(--ink)]'
                : s.state === 'done'
                ? 'bg-[var(--accent)] text-[var(--accent-2)] border-[var(--accent)]'
                : 'bg-[var(--card)] text-[var(--mute)] border-[var(--line)]'
            }`}
            style={{ padding: '10px 16px' }}
          >
            <span
              className={`zt-mono text-[11.5px] font-bold grid place-items-center rounded-full ${
                s.state === 'active'
                  ? 'bg-[var(--accent)] text-[var(--accent-2)]'
                  : s.state === 'done'
                  ? 'bg-[var(--ink)] text-[var(--accent)]'
                  : 'bg-[var(--bg-2)] text-[var(--ink)]'
              }`}
              style={{ width: 22, height: 22 }}
            >
              {s.state === 'done' ? '✓' : s.n}
            </span>
            {s.label}
          </div>
          {i < steps.length - 1 && <div className="flex-1 h-px bg-[var(--line)]" />}
        </div>
      ))}
    </div>
  );
}
