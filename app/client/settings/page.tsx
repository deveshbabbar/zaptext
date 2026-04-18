'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageTopbar, PageHead, Panel, Pill } from '@/components/app/primitives';

export default function ClientSettingsPage() {
  const [prompt, setPrompt] = useState('');
  const [config, setConfig] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/client/settings')
      .then((res) => res.json())
      .then((data) => {
        setPrompt(data.systemPrompt || '');
        setConfig(data.knowledgeBase || '');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSavePrompt = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/client/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: 'system_prompt', value: prompt }),
      });
      if (res.ok) toast.success('System prompt updated!');
      else toast.error('Failed to save');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
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
        crumbs={<><b className="text-foreground">Bot settings</b> · voice & knowledge</>}
        actions={<Pill variant="ink" onClick={handleSavePrompt}>{saving ? 'Saving…' : 'Save prompt'}</Pill>}
      />
      <div style={{ padding: '28px 32px 60px' }} className="max-w-4xl">
        <PageHead
          title={<>Your bot&apos;s <span className="zt-serif">voice.</span></>}
          sub="Tune tone, rules, and knowledge. Changes go live instantly."
        />

        {loading ? (
          <div className="animate-pulse h-64 bg-[var(--card)] border border-[var(--line)] rounded-[18px]" />
        ) : (
          <div className="flex flex-col gap-4">
            <Panel title="System prompt" sub="The instructions your bot follows. Edit carefully.">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={18}
                className="w-full rounded-[12px] border border-[var(--line)] bg-[var(--card)] focus:border-[var(--ink)] focus:outline-none zt-mono text-[12.5px]"
                style={{ padding: '12px 14px', resize: 'vertical' }}
              />
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
