'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageTopbar, PageHead, Panel, Pill } from '@/components/app/primitives';

type Format = 'csv' | 'json';

const LANGUAGE_OPTIONS = [
  'English', 'Hindi', 'Hinglish', 'Punjabi', 'Tamil', 'Telugu', 'Bengali', 'Marathi', 'Gujarati', 'Kannada', 'Malayalam',
];

export default function ClientSettingsPage() {
  const [prompt, setPrompt] = useState('');
  const [config, setConfig] = useState('');
  const [existingSystem, setExistingSystem] = useState('');
  const [exportFormat, setExportFormat] = useState<Format>('csv');
  const [upiId, setUpiId] = useState('');
  const [upiName, setUpiName] = useState('');
  const [languages, setLanguages] = useState<string[]>(['English']);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/client/settings', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        setPrompt(data.systemPrompt || '');
        setConfig(data.knowledgeBase || '');
        setExistingSystem(data.existingSystem || '');
        setExportFormat((data.exportFormat as Format) || 'csv');
        setUpiId(data.upiId || '');
        setUpiName(data.upiName || '');
        if (Array.isArray(data.languages) && data.languages.length > 0) {
          setLanguages(data.languages);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const toggleLanguage = (lang: string) => {
    setLanguages((prev) => {
      if (prev.includes(lang)) {
        const next = prev.filter((l) => l !== lang);
        return next.length === 0 ? ['English'] : next;
      }
      return [...prev, lang];
    });
  };

  const setPrimaryLanguage = (lang: string) => {
    setLanguages((prev) => {
      const rest = prev.filter((l) => l !== lang);
      return [lang, ...rest];
    });
  };

  const handleSaveLanguages = async () => {
    setSaving('languages');
    try {
      const res = await fetch('/api/client/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: 'languages', value: languages }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.systemPrompt) setPrompt(data.systemPrompt);
        toast.success('Bot languages updated — system prompt regenerated');
      } else {
        toast.error(data.error || 'Failed to save languages');
      }
    } catch {
      toast.error('Failed to save languages');
    } finally {
      setSaving(null);
    }
  };

  const saveField = async (field: string, value: string, label: string) => {
    setSaving(field);
    try {
      const res = await fetch('/api/client/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value }),
      });
      if (res.ok) toast.success(`${label} saved!`);
      else toast.error(`Failed to save ${label}`);
    } catch {
      toast.error(`Failed to save ${label}`);
    } finally {
      setSaving(null);
    }
  };

  const handleSavePrompt = () => saveField('system_prompt', prompt, 'System prompt');
  const handleSaveExport = async () => {
    setSaving('export');
    try {
      await Promise.all([
        fetch('/api/client/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field: 'existing_system', value: existingSystem }),
        }),
        fetch('/api/client/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field: 'export_format', value: exportFormat }),
        }),
      ]);
      toast.success('Export preferences saved!');
    } catch {
      toast.error('Failed to save export preferences');
    } finally {
      setSaving(null);
    }
  };
  const handleSaveUpi = async () => {
    setSaving('upi');
    try {
      await Promise.all([
        fetch('/api/client/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field: 'upi_id', value: upiId.trim() }),
        }),
        fetch('/api/client/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field: 'upi_name', value: upiName.trim() }),
        }),
      ]);
      toast.success('UPI settings saved!');
    } catch {
      toast.error('Failed to save UPI settings');
    } finally {
      setSaving(null);
    }
  };

  const prettyConfig = (() => {
    try {
      return JSON.stringify(JSON.parse(config), null, 2);
    } catch {
      return config;
    }
  })();

  return (
    <>
      <PageTopbar
        crumbs={<><b className="text-foreground">Bot settings</b> · voice, payments & export</>}
        actions={
          <Pill variant="ink" onClick={handleSavePrompt}>
            {saving === 'system_prompt' ? 'Saving…' : 'Save prompt'}
          </Pill>
        }
      />
      <div style={{ padding: '28px 32px 60px' }} className="max-w-4xl">
        <PageHead
          title={<>Your bot&apos;s <span className="zt-serif">voice.</span></>}
          sub="Tune tone, rules, knowledge, payments, and how daily exports land in your inbox."
        />

        {loading ? (
          <div className="animate-pulse h-64 bg-[var(--card)] border border-[var(--line)] rounded-[18px]" />
        ) : (
          <div className="flex flex-col gap-4">
            <Panel
              title="Bot languages"
              sub="Pick every language your bot should understand and reply in. The first one is the default fallback when the customer's language isn't clear."
              action={
                <button
                  onClick={handleSaveLanguages}
                  className="text-[var(--ink)] border-b border-[var(--ink)] font-semibold"
                >
                  {saving === 'languages' ? 'Saving…' : 'Save'}
                </button>
              }
            >
              <div className="flex flex-wrap gap-2 mb-3">
                {LANGUAGE_OPTIONS.map((lang) => {
                  const active = languages.includes(lang);
                  const isPrimary = active && languages[0] === lang;
                  return (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => toggleLanguage(lang)}
                      className={`px-3.5 py-1.5 rounded-full text-[13px] font-semibold border transition ${
                        isPrimary
                          ? 'bg-[var(--ink)] text-[var(--background)] border-[var(--ink)]'
                          : active
                            ? 'bg-[var(--accent)] text-[var(--accent-2)] border-[var(--accent)]'
                            : 'bg-[var(--card)] border-[var(--line)] hover:border-[var(--ink)]'
                      }`}
                    >
                      {isPrimary ? `★ ${lang}` : lang}
                    </button>
                  );
                })}
              </div>
              {languages.length > 1 && (
                <div className="text-[11.5px] text-[var(--mute)] mb-2">
                  Default language: <b className="text-[var(--ink)]">{languages[0]}</b>. Click another selected language to make it primary:
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {languages.slice(1).map((lang) => (
                      <button
                        key={`primary-${lang}`}
                        type="button"
                        onClick={() => setPrimaryLanguage(lang)}
                        className="px-2.5 py-0.5 rounded-full text-[11.5px] border border-[var(--line)] hover:border-[var(--ink)]"
                      >
                        Make {lang} primary
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-[11.5px] text-[var(--mute)] m-0">Saving regenerates the system prompt so the bot actually uses these languages.</p>
            </Panel>

            <Panel title="System prompt" sub="The instructions your bot follows. Edit carefully.">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={18}
                className="w-full rounded-[12px] border border-[var(--line)] bg-[var(--card)] focus:border-[var(--ink)] focus:outline-none zt-mono text-[12.5px]"
                style={{ padding: '12px 14px', resize: 'vertical' }}
              />
            </Panel>

            <Panel
              title="Payments (UPI)"
              sub="Bot will send UPI payment links to customers using these details."
              action={
                <button
                  onClick={handleSaveUpi}
                  className="text-[var(--ink)] border-b border-[var(--ink)] font-semibold"
                >
                  {saving === 'upi' ? 'Saving…' : 'Save'}
                </button>
              }
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-[12.5px] font-semibold mb-1.5">UPI ID</div>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="e.g., rohit@ybl"
                    className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--card)] focus:border-[var(--ink)] focus:outline-none text-[13.5px]"
                    style={{ padding: '11px 13px' }}
                  />
                  <p className="text-[11.5px] text-[var(--mute)] mt-1.5 m-0">Format: name@bank</p>
                </div>
                <div>
                  <div className="text-[12.5px] font-semibold mb-1.5">Payee name</div>
                  <input
                    type="text"
                    value={upiName}
                    onChange={(e) => setUpiName(e.target.value)}
                    placeholder="e.g., Rohit's Biryani"
                    className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--card)] focus:border-[var(--ink)] focus:outline-none text-[13.5px]"
                    style={{ padding: '11px 13px' }}
                  />
                  <p className="text-[11.5px] text-[var(--mute)] mt-1.5 m-0">Shown to customer in UPI app</p>
                </div>
              </div>
            </Panel>

            <Panel
              title="Daily order export"
              sub="Every night, we email you today's orders. Import into your existing system."
              action={
                <button
                  onClick={handleSaveExport}
                  className="text-[var(--ink)] border-b border-[var(--ink)] font-semibold"
                >
                  {saving === 'export' ? 'Saving…' : 'Save'}
                </button>
              }
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-[12.5px] font-semibold mb-1.5">Your existing system (optional)</div>
                  <input
                    type="text"
                    value={existingSystem}
                    onChange={(e) => setExistingSystem(e.target.value)}
                    placeholder="e.g., Petpooja, Practo, Fresha"
                    className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--card)] focus:border-[var(--ink)] focus:outline-none text-[13.5px]"
                    style={{ padding: '11px 13px' }}
                  />
                  <p className="text-[11.5px] text-[var(--mute)] mt-1.5 m-0">Just a name — we mention it in the email so you know where to paste.</p>
                </div>
                <div>
                  <div className="text-[12.5px] font-semibold mb-1.5">Format</div>
                  <div className="flex gap-2">
                    {(['csv', 'json'] as const).map((fmt) => {
                      const active = exportFormat === fmt;
                      return (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => setExportFormat(fmt)}
                          className={`px-4 py-2 rounded-full text-[13px] font-semibold border transition ${
                            active
                              ? 'bg-[var(--ink)] text-[var(--background)] border-[var(--ink)]'
                              : 'bg-[var(--card)] border-[var(--line)] hover:border-[var(--ink)]'
                          }`}
                        >
                          {fmt.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11.5px] text-[var(--mute)] mt-1.5 m-0">CSV (default) works everywhere. JSON for Zapier / scripts.</p>
                </div>
              </div>
            </Panel>

            <Panel title="Business knowledge" sub="Parsed from onboarding. Read-only for now.">
              <pre
                className="zt-mono whitespace-pre-wrap text-[12.5px] bg-[var(--bg-2)] rounded-[10px] overflow-y-auto m-0"
                style={{ padding: 14, maxHeight: 400 }}
              >
                {prettyConfig}
              </pre>
            </Panel>
          </div>
        )}
      </div>
    </>
  );
}
