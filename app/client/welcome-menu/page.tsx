'use client';

import { useEffect, useState } from 'react';
import { PageTopbar, PageHead, Panel } from '@/components/app/primitives';

interface MenuItem {
  id: string;
  label: string;
  description?: string;
}

interface Config {
  is_enabled: boolean;
  use_auto_generated: boolean;
  header_text: string;
  body_text: string;
  footer_text: string;
  items: MenuItem[];
  auto_preview: MenuItem[];
  business_name: string;
  vertical: string;
  max_items: number;
}

export default function WelcomeMenuPage() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/client/welcome-menu')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setErr(d.error);
        else setCfg(d);
        setLoading(false);
      })
      .catch((e) => {
        setErr(String(e));
        setLoading(false);
      });
  }, []);

  async function save(patch: Partial<Config> & { items?: MenuItem[] }) {
    if (!cfg) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch('/api/client/welcome-menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data?.error || 'Save failed');
      } else {
        setSavedAt(Date.now());
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '28px 32px' }}>
        <div className="animate-pulse h-32 bg-[var(--card)] border border-[var(--line)] rounded-[18px]" />
      </div>
    );
  }
  if (err && !cfg) {
    return (
      <div style={{ padding: '28px 32px' }}>
        <Panel title="Error">
          <p className="text-[13px] text-red-500 m-0">{err}</p>
        </Panel>
      </div>
    );
  }
  if (!cfg) return null;

  const previewItems: MenuItem[] = cfg.use_auto_generated
    ? cfg.auto_preview
    : (cfg.items.length > 0 ? cfg.items : cfg.auto_preview);
  const headerPreview = cfg.header_text || `Welcome to ${cfg.business_name}!`;
  const bodyPreview = cfg.body_text || 'What can I help you with today?';

  return (
    <>
      <PageTopbar
        crumbs={
          <>
            <b className="text-foreground">Welcome menu</b> · {cfg.business_name}
            {cfg.is_enabled ? (
              <span className="ml-2 inline-block text-emerald-500 zt-mono text-[11px]">ON</span>
            ) : (
              <span className="ml-2 inline-block text-[var(--mute)] zt-mono text-[11px]">OFF</span>
            )}
          </>
        }
      />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead
          title={<>Customer <span className="zt-serif">welcome menu.</span></>}
          sub="The first message a new customer sees. Tappable list of options so they don't have to guess what to say."
        />

        {err ? (
          <div className="mb-4 text-[12.5px] text-red-500" style={{ wordBreak: 'break-word' }}>{err}</div>
        ) : null}

        <Panel title="Status">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={cfg.is_enabled}
              onChange={(e) => {
                setCfg({ ...cfg, is_enabled: e.target.checked });
                void save({ is_enabled: e.target.checked });
              }}
              className="w-4 h-4"
            />
            <span className="text-[13.5px] font-medium">Show welcome menu to first-time customers</span>
          </label>
          <p className="text-[12px] text-[var(--mute)] mt-2 mb-0">
            Customers who message your bot for the first time in 7 days will see this menu before chatting with the AI.
          </p>
        </Panel>

        <div className="mt-4">
          <Panel title="How options are generated">
            <div className="flex flex-col gap-2.5">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  checked={cfg.use_auto_generated}
                  onChange={() => {
                    setCfg({ ...cfg, use_auto_generated: true });
                    void save({ use_auto_generated: true });
                  }}
                />
                <div>
                  <div className="text-[13.5px] font-semibold">Auto (recommended)</div>
                  <div className="text-[12px] text-[var(--mute)]">
                    Built live from your staff, services, and {cfg.vertical || 'business'} defaults. Updates automatically as your team grows.
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  checked={!cfg.use_auto_generated}
                  onChange={() => {
                    setCfg({ ...cfg, use_auto_generated: false });
                    void save({ use_auto_generated: false });
                  }}
                />
                <div>
                  <div className="text-[13.5px] font-semibold">Custom</div>
                  <div className="text-[12px] text-[var(--mute)]">
                    Hand-pick the wording yourself. Up to {cfg.max_items} options.
                  </div>
                </div>
              </label>
            </div>
          </Panel>
        </div>

        <div className="mt-4">
          <Panel title="Greeting">
            <div className="flex flex-col gap-3">
              <Field
                label="Header (max 60 chars)"
                value={cfg.header_text}
                placeholder={`Welcome to ${cfg.business_name}!`}
                maxLength={60}
                onChange={(v) => setCfg({ ...cfg, header_text: v })}
                onBlur={() => void save({ header_text: cfg.header_text })}
              />
              <Field
                label="Body / question (max 1024 chars)"
                value={cfg.body_text}
                placeholder="What can I help you with today?"
                maxLength={1024}
                multiline
                onChange={(v) => setCfg({ ...cfg, body_text: v })}
                onBlur={() => void save({ body_text: cfg.body_text })}
              />
              <Field
                label="Footer (max 60 chars, optional)"
                value={cfg.footer_text}
                placeholder=""
                maxLength={60}
                onChange={(v) => setCfg({ ...cfg, footer_text: v })}
                onBlur={() => void save({ footer_text: cfg.footer_text })}
              />
            </div>
          </Panel>
        </div>

        {!cfg.use_auto_generated ? (
          <div className="mt-4">
            <Panel title={`Menu options (${cfg.items.length}/${cfg.max_items})`}>
              <ItemsEditor
                items={cfg.items}
                maxItems={cfg.max_items}
                onChange={(items) => {
                  setCfg({ ...cfg, items });
                  void save({ items });
                }}
              />
              <button
                type="button"
                className="mt-3 rounded-full border border-[var(--line)] bg-[var(--card)] hover:bg-[var(--bg-mute)] zt-mono text-[11.5px] uppercase tracking-[.06em]"
                style={{ padding: '8px 16px' }}
                onClick={() => {
                  const items = cfg.auto_preview.slice(0, cfg.max_items);
                  setCfg({ ...cfg, items });
                  void save({ items });
                }}
              >
                Copy from Auto preview
              </button>
            </Panel>
          </div>
        ) : null}

        <div className="mt-4">
          <Panel title="Live preview (what customers see)">
            <div
              className="rounded-[14px] border border-[var(--line)] bg-[var(--bg-mute)]"
              style={{ padding: '14px 16px', maxWidth: 380 }}
            >
              <div className="text-[14px] font-bold tracking-[-0.01em]">{headerPreview}</div>
              <div className="text-[13px] mt-1 whitespace-pre-wrap">{bodyPreview}</div>
              {cfg.footer_text ? (
                <div className="text-[11.5px] text-[var(--mute)] mt-2">{cfg.footer_text}</div>
              ) : null}
              <div className="mt-3 flex flex-col gap-px rounded-[10px] border border-[var(--line)] overflow-hidden">
                {previewItems.length === 0 ? (
                  <div className="text-[12px] text-[var(--mute)] zt-mono p-3">No options - menu will be skipped</div>
                ) : previewItems.map((it, i) => (
                  <div
                    key={`${it.id}-${i}`}
                    className="bg-[var(--card)] border-b border-[var(--line)] last:border-b-0"
                    style={{ padding: '10px 12px' }}
                  >
                    <div className="text-[13px] font-semibold">{it.label}</div>
                    {it.description ? (
                      <div className="text-[11.5px] text-[var(--mute)] mt-0.5">{it.description}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>

        <div className="mt-4 zt-mono text-[11px] text-[var(--mute)]">
          {saving ? 'Saving...' : savedAt ? `Saved at ${new Date(savedAt).toLocaleTimeString()}` : ''}
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  value,
  placeholder,
  maxLength,
  multiline,
  onChange,
  onBlur,
}: {
  label: string;
  value: string;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="zt-mono text-[10.5px] uppercase tracking-[.08em] text-[var(--mute)]">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          rows={3}
          className="rounded-[10px] border border-[var(--line)] bg-[var(--card)] text-[13px]"
          style={{ padding: '10px 12px', fontFamily: 'inherit' }}
        />
      ) : (
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="rounded-[10px] border border-[var(--line)] bg-[var(--card)] text-[13px]"
          style={{ padding: '10px 12px' }}
        />
      )}
    </label>
  );
}

function ItemsEditor({
  items,
  maxItems,
  onChange,
}: {
  items: MenuItem[];
  maxItems: number;
  onChange: (items: MenuItem[]) => void;
}) {
  const updateAt = (idx: number, patch: Partial<MenuItem>) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };
  const removeAt = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    onChange(next);
  };
  const add = () => {
    if (items.length >= maxItems) return;
    onChange([...items, { id: `option_${Date.now()}`, label: '', description: '' }]);
  };

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, idx) => (
        <div
          key={idx}
          className="rounded-[12px] border border-[var(--line)] bg-[var(--card)]"
          style={{ padding: '12px 14px' }}
        >
          <div className="flex gap-2 items-start">
            <span className="zt-mono text-[11px] text-[var(--mute)] mt-1">{idx + 1}.</span>
            <div className="flex-1 flex flex-col gap-2">
              <input
                type="text"
                value={item.label}
                placeholder="Option label (e.g. Talk to a trainer)"
                maxLength={24}
                onChange={(e) => updateAt(idx, { label: e.target.value })}
                className="rounded-[8px] border border-[var(--line)] bg-[var(--bg-mute)] text-[13px] font-semibold"
                style={{ padding: '8px 10px' }}
              />
              <input
                type="text"
                value={item.description || ''}
                placeholder="Description (optional, max 72 chars)"
                maxLength={72}
                onChange={(e) => updateAt(idx, { description: e.target.value })}
                className="rounded-[8px] border border-[var(--line)] bg-[var(--bg-mute)] text-[12px]"
                style={{ padding: '8px 10px' }}
              />
              <input
                type="text"
                value={item.id}
                placeholder="Internal id (e.g. talk_to_trainer)"
                maxLength={200}
                onChange={(e) => updateAt(idx, { id: e.target.value })}
                className="rounded-[8px] border border-[var(--line)] bg-[var(--bg-mute)] text-[11.5px] zt-mono text-[var(--mute)]"
                style={{ padding: '8px 10px' }}
              />
            </div>
            <button
              type="button"
              onClick={() => removeAt(idx)}
              className="text-red-500 text-[12px] hover:underline"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      {items.length < maxItems ? (
        <button
          type="button"
          onClick={add}
          className="rounded-[10px] border border-dashed border-[var(--line)] text-[13px] text-[var(--mute)] hover:bg-[var(--card)]"
          style={{ padding: '12px 14px' }}
        >
          + Add option ({maxItems - items.length} slots left)
        </button>
      ) : (
        <div className="text-[11.5px] text-[var(--mute)] text-center">Reached the {maxItems}-option limit (Meta cap)</div>
      )}
    </div>
  );
}
