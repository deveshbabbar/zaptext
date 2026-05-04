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
  const [botName, setBotName] = useState('');
  const [botType, setBotType] = useState('');
  // Business-details fields (live inside knowledge_base_json under
  // CommonFields). Editing here updates KB → system_prompt regenerates →
  // bot's "Location: …", "Working Hours: …", and welcome line all
  // change in one save. Previously the only way to change the address
  // was to edit the raw KB JSON or the system_prompt by hand, which
  // didn't keep both in sync.
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [workingHours, setWorkingHours] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [bizDirty, setBizDirty] = useState(false);
  // Per-bot inventory categories. Loaded from /api/client/inventory/categories
  // and managed via the "Inventory categories" panel below — owners can add
  // custom labels (e.g. "Diet Plans" for a gym) or delete defaults they
  // don't use. Items already tagged with a deleted category fall to
  // "Uncategorised" on the inventory page rather than disappearing.
  interface CategoryRow { id: string; name: string; tracks_stock: boolean; display_order: number }
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [newCatTracksStock, setNewCatTracksStock] = useState(true);
  const [catBusy, setCatBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Track whether the user has edited the prompt manually after last load/save.
  // If they did, we preserve their edit on save. Otherwise, saving languages
  // regenerates the prompt server-side and we accept that result.
  const [promptDirty, setPromptDirty] = useState(false);
  const [kbDirty, setKbDirty] = useState(false);
  const [kbError, setKbError] = useState('');
  const [syncingInv, setSyncingInv] = useState(false);

  useEffect(() => {
    fetch('/api/client/settings', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        setPrompt(data.systemPrompt || '');
        // Pretty-print on load so the textarea is readable. If the stored value
        // is invalid JSON (corrupted), show it raw so the user can fix it.
        const rawKb = data.knowledgeBase || '';
        let prettyKb = rawKb;
        try {
          prettyKb = rawKb ? JSON.stringify(JSON.parse(rawKb), null, 2) : '';
        } catch {
          prettyKb = rawKb;
        }
        setConfig(prettyKb);
        setExistingSystem(data.existingSystem || '');
        setExportFormat((data.exportFormat as Format) || 'csv');
        setUpiId(data.upiId || '');
        setUpiName(data.upiName || '');
        setBotName(data.botName || '');
        setBotType(data.botType || '');
        if (Array.isArray(data.languages) && data.languages.length > 0) {
          setLanguages(data.languages);
        }
        // Pull business-detail fields out of the parsed KB so the inputs
        // below are pre-filled. Empty strings are fine — we won't overwrite
        // the saved KB with an empty value unless the user explicitly clears.
        try {
          const parsed = data.knowledgeBase ? JSON.parse(data.knowledgeBase) : {};
          if (parsed && typeof parsed === 'object') {
            setAddress(typeof parsed.address === 'string' ? parsed.address : '');
            setCity(typeof parsed.city === 'string' ? parsed.city : '');
            setWorkingHours(typeof parsed.workingHours === 'string' ? parsed.workingHours : '');
            setWelcomeMessage(typeof parsed.welcomeMessage === 'string' ? parsed.welcomeMessage : '');
          }
        } catch {
          // Corrupt KB — leave fields blank, the JSON editor below will
          // surface the parse error.
        }
        setBizDirty(false);
        setPromptDirty(false);
        setKbDirty(false);
        setKbError('');
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Fire-and-forget categories fetch — independent of the main settings
    // load, so the panel populates as soon as the route responds and
    // doesn't block the rest of the page if the categories endpoint is
    // slow or 404s.
    fetch('/api/client/inventory/categories', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('cat fetch failed'))))
      .then((data) => {
        if (Array.isArray(data.categories)) setCategories(data.categories);
      })
      .catch(() => {
        // Non-fatal — leave the list empty; owner can still type a new
        // category name to seed the table on first save.
      });
  }, []);

  const reloadCategories = async () => {
    try {
      const res = await fetch('/api/client/inventory/categories', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.categories)) setCategories(data.categories);
    } catch {
      // ignore — toast on the calling action surfaces the failure
    }
  };

  const addCategory = async () => {
    const name = newCatName.trim();
    if (!name) {
      toast.error('Category name required');
      return;
    }
    setCatBusy('__new__');
    try {
      const res = await fetch('/api/client/inventory/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, tracks_stock: newCatTracksStock }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Failed to add category');
        return;
      }
      toast.success(`Added "${name}"`);
      setNewCatName('');
      setNewCatTracksStock(true);
      await reloadCategories();
    } finally {
      setCatBusy(null);
    }
  };

  const toggleCategoryStock = async (cat: CategoryRow) => {
    setCatBusy(cat.id);
    try {
      const res = await fetch('/api/client/inventory/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cat.name, tracks_stock: !cat.tracks_stock }),
      });
      if (!res.ok) {
        toast.error('Failed to update category');
        return;
      }
      // Optimistic local update — server has already accepted the change
      // by the time we reach this line; no need to wait for a re-fetch.
      setCategories((prev) =>
        prev.map((c) => (c.id === cat.id ? { ...c, tracks_stock: !c.tracks_stock } : c))
      );
    } finally {
      setCatBusy(null);
    }
  };

  const deleteCategoryRow = async (cat: CategoryRow) => {
    if (!window.confirm(`Delete "${cat.name}"? Items already tagged with it will fall under "Uncategorised" until you re-tag them.`)) {
      return;
    }
    setCatBusy(cat.id);
    try {
      const res = await fetch('/api/client/inventory/categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cat.name }),
      });
      if (!res.ok) {
        toast.error('Failed to delete');
        return;
      }
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
    } finally {
      setCatBusy(null);
    }
  };

  const validateKb = (raw: string): string => {
    if (!raw.trim()) return 'Business knowledge cannot be empty.';
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return 'Must be a JSON object — start with { and end with }.';
      }
      return '';
    } catch (e) {
      return `Invalid JSON: ${String(e).replace('SyntaxError: ', '').slice(0, 120)}`;
    }
  };

  const onKbChange = (next: string) => {
    setConfig(next);
    setKbDirty(true);
    setKbError(validateKb(next));
  };

  const formatKb = () => {
    try {
      const pretty = JSON.stringify(JSON.parse(config), null, 2);
      setConfig(pretty);
      setKbDirty(true);
      setKbError('');
    } catch {
      setKbError('Cannot format — fix the JSON syntax first.');
    }
  };

  const syncInventoryFromForm = async () => {
    setSyncingInv(true);
    try {
      const res = await fetch('/api/client/inventory/sync-from-form', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Products synced to inventory.');
      } else {
        toast.error(data.error || data.message || 'Sync failed');
      }
    } catch {
      toast.error('Sync failed');
    } finally {
      setSyncingInv(false);
    }
  };

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

  const handleSaveAll = async () => {
    // Block save if KB is dirty and invalid — prevents writing broken JSON
    // that would corrupt the bot config (422 error on next language change).
    if (kbDirty) {
      const err = validateKb(config);
      if (err) {
        setKbError(err);
        toast.error('Fix business knowledge JSON before saving.');
        return;
      }
    }

    setSaving(true);
    try {
      const bulk: Record<string, unknown> = {
        languages,
        upi_id: upiId.trim(),
        upi_name: upiName.trim(),
        existing_system: existingSystem.trim(),
        export_format: exportFormat,
      };
      // Only send system_prompt if the user actually edited it — otherwise let
      // the server regenerate from the (possibly new) languages array / KB.
      if (promptDirty) bulk.system_prompt = prompt;

      // If the business-detail fields (address / city / working hours /
      // welcome) were touched, merge them into the KB JSON we send. We
      // start from whatever the user has typed in the raw KB editor (or
      // the originally-loaded value) so this never clobbers their other
      // edits, then overlay the four fields.
      if (bizDirty || kbDirty) {
        let baseKb: Record<string, unknown> = {};
        try { baseKb = JSON.parse(config || '{}'); } catch { baseKb = {}; }
        if (!baseKb || typeof baseKb !== 'object' || Array.isArray(baseKb)) baseKb = {};
        if (bizDirty) {
          baseKb.address = address.trim();
          baseKb.city = city.trim();
          baseKb.workingHours = workingHours.trim();
          baseKb.welcomeMessage = welcomeMessage.trim();
        }
        bulk.knowledge_base_json = JSON.stringify(baseKb);
      }

      const res = await fetch('/api/client/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulk }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.systemPrompt) setPrompt(data.systemPrompt);
        setPromptDirty(false);
        setKbDirty(false);
        setBizDirty(false);
        setKbError('');
        if (kbDirty) {
          toast.success('Saved — knowledge updated. Click "Sync to inventory" if menu items changed.');
        } else {
          toast.success('Saved — all changes applied');
        }
      } else {
        toast.error(data.error || 'Failed to save');
      }
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageTopbar
        crumbs={
          <>
            <b className="text-foreground">Bot settings</b>
            {botName && <> · editing <b className="text-foreground">{botName}</b>{botType ? <> <span className="text-[var(--mute)]">({botType})</span></> : null}</>}
          </>
        }
        actions={
          <Pill variant="ink" onClick={handleSaveAll}>
            {saving ? 'Saving…' : '💾 Save all changes'}
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
              title="Business details"
              sub="Address, city, working hours, and welcome message. Editing any of these here updates business knowledge AND the bot's system prompt — both stay in sync, so the bot starts using the new info on the next customer message."
            >
              <div className="grid gap-3">
                <div className="grid gap-1">
                  <label className="text-[12px] uppercase tracking-[.06em] text-[var(--mute)] font-semibold">Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => { setAddress(e.target.value); setBizDirty(true); }}
                    placeholder="e.g., A-12 Lajpat Nagar, near Metro Station"
                    className="rounded-[10px] border border-[var(--line)] bg-[var(--card)] text-foreground px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-[12px] uppercase tracking-[.06em] text-[var(--mute)] font-semibold">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => { setCity(e.target.value); setBizDirty(true); }}
                    placeholder="e.g., Delhi"
                    className="rounded-[10px] border border-[var(--line)] bg-[var(--card)] text-foreground px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-[12px] uppercase tracking-[.06em] text-[var(--mute)] font-semibold">Working hours</label>
                  <input
                    type="text"
                    value={workingHours}
                    onChange={(e) => { setWorkingHours(e.target.value); setBizDirty(true); }}
                    placeholder="e.g., Mon-Sat 5 AM - 11 PM"
                    className="rounded-[10px] border border-[var(--line)] bg-[var(--card)] text-foreground px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-[12px] uppercase tracking-[.06em] text-[var(--mute)] font-semibold">Welcome message</label>
                  <textarea
                    rows={2}
                    value={welcomeMessage}
                    onChange={(e) => { setWelcomeMessage(e.target.value); setBizDirty(true); }}
                    placeholder="e.g., Namaste! Sharma Ji Ka Dhaba mein aapka swagat hai 🙏 Aaj kya khayenge?"
                    className="rounded-[10px] border border-[var(--line)] bg-[var(--card)] text-foreground px-3 py-2 text-sm resize-none"
                  />
                </div>
              </div>
              {bizDirty && (
                <p className="text-[11px] text-[var(--mute)] mt-2">
                  Unsaved business details — click <b>Save all changes</b> at the top.
                </p>
              )}
            </Panel>

            <Panel
              title="Inventory categories"
              sub="Group your bot's items (membership plans, services, products, etc.). Toggle stock-tracking off for service categories so the inventory page hides stock fields. Custom categories let you add anything specific to your business."
            >
              {categories.length === 0 ? (
                <p className="text-[13px] text-[var(--mute)] m-0 mb-3">
                  No categories yet. Add one below — bot approval auto-seeds the default list, but you can always add custom ones.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5 mb-4">
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center gap-3 rounded-[10px] border border-[var(--line)] bg-[var(--card)]"
                      style={{ padding: '8px 12px' }}
                    >
                      <span className="font-semibold text-[13.5px] flex-1">{cat.name}</span>
                      <button
                        type="button"
                        onClick={() => toggleCategoryStock(cat)}
                        disabled={catBusy === cat.id}
                        className={`text-[11.5px] font-semibold px-2.5 py-1 rounded-full border transition disabled:opacity-50 ${
                          cat.tracks_stock
                            ? 'border-emerald-500/40 text-emerald-600'
                            : 'border-[var(--line)] text-[var(--mute)]'
                        }`}
                        title="Toggle whether items in this category track stock counts"
                      >
                        {cat.tracks_stock ? '✓ Tracks stock' : '— No stock'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCategoryRow(cat)}
                        disabled={catBusy === cat.id}
                        className="text-[11.5px] text-[var(--mute)] hover:text-red-500 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-[2fr_auto_auto] gap-2.5">
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="New category name (e.g., Apparel, Locker Rental)"
                  disabled={catBusy === '__new__'}
                  className="rounded-[10px] border border-[var(--line)] bg-[var(--card)] text-foreground px-3 py-2 text-sm disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setNewCatTracksStock((v) => !v)}
                  disabled={catBusy === '__new__'}
                  className={`rounded-[10px] border px-3 py-2 text-[12.5px] font-semibold transition disabled:opacity-50 ${
                    newCatTracksStock
                      ? 'border-emerald-500/40 text-emerald-600'
                      : 'border-[var(--line)] text-[var(--mute)]'
                  }`}
                  title="Click to toggle stock-tracking for this category"
                >
                  {newCatTracksStock ? '✓ Tracks stock' : '— No stock'}
                </button>
                <Pill variant="ink" onClick={addCategory} disabled={catBusy === '__new__' || !newCatName.trim()}>
                  {catBusy === '__new__' ? 'Adding…' : '+ Add'}
                </Pill>
              </div>
              <p className="text-[11px] text-[var(--mute)] mt-2 m-0">
                Stock-tracking off → items don&apos;t show stock counts (good for memberships, services, courses, listings). Toggle on for physical products with finite quantity.
              </p>
            </Panel>

            <Panel
              title="Bot languages"
              sub="Pick every language your bot should understand and reply in. The first one is the default fallback when the customer's language isn't clear. Hit Save at the top when done."
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
              <p className="text-[11.5px] text-[var(--mute)] m-0">
                Saving regenerates the system prompt automatically — unless you&apos;ve manually edited it below.
              </p>
            </Panel>

            <Panel title="System prompt" sub="The instructions your bot follows. Edit carefully.">
              <textarea
                value={prompt}
                onChange={(e) => { setPrompt(e.target.value); setPromptDirty(true); }}
                rows={18}
                className="w-full rounded-[12px] border border-[var(--line)] bg-[var(--card)] focus:border-[var(--ink)] focus:outline-none zt-mono text-[12.5px]"
                style={{ padding: '12px 14px', resize: 'vertical' }}
              />
            </Panel>

            <Panel
              title="Payments (UPI)"
              sub="Bot will send UPI payment links to customers using these details."
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

            <Panel
              title="WhatsApp number / phone_number_id"
              sub="Need to switch the WhatsApp Business number this bot is wired to? That's an admin-only change — for security, owners can't edit phone_number_id directly (an attacker who got dashboard access could otherwise hijack the bot)."
            >
              <p className="text-[12.5px] text-[var(--mute)] m-0">
                Email <a href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'zaptextofficial@gmail.com'}?subject=Change+phone_number_id+for+${encodeURIComponent(botName)}`} className="text-[var(--ink)] underline">support</a> with your new <span className="zt-mono">phone_number_id</span> from Meta Business Manager and we&apos;ll update it within 24 hours. The bot will be paused during the switch so customers see &quot;temporarily offline&quot; instead of going to the wrong number.
              </p>
            </Panel>

            <Panel
              title="Business knowledge"
              sub="Edit your bot's menu, delivery info, offers, etc. Must be valid JSON. Changes here re-generate the system prompt when you hit Save at the top (unless you've manually edited it)."
            >
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <button
                  type="button"
                  onClick={formatKb}
                  disabled={saving}
                  className="text-[12px] font-semibold rounded-[8px] border border-[var(--line)] hover:border-[var(--ink)] disabled:opacity-50"
                  style={{ padding: '5px 10px' }}
                >
                  ⚙ Format JSON
                </button>
                <button
                  type="button"
                  onClick={syncInventoryFromForm}
                  disabled={syncingInv || saving || kbDirty}
                  title={kbDirty ? 'Save knowledge first, then sync' : 'Copy menu / products into the inventory sheet'}
                  className="text-[12px] font-semibold rounded-[8px] border border-[var(--line)] hover:border-[var(--ink)] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ padding: '5px 10px' }}
                >
                  {syncingInv ? 'Syncing…' : '📥 Sync to inventory'}
                </button>
                {kbDirty && !kbError && (
                  <span className="text-[11.5px] text-[#E89A1C] font-semibold">● Unsaved changes</span>
                )}
                {kbError && (
                  <span className="text-[11.5px] text-red-500 font-semibold">⚠ {kbError}</span>
                )}
              </div>
              <textarea
                value={config}
                onChange={(e) => onKbChange(e.target.value)}
                rows={22}
                spellCheck={false}
                className={`w-full rounded-[10px] border bg-[var(--bg-2)] focus:outline-none zt-mono text-[12.5px] ${
                  kbError
                    ? 'border-red-500/60 focus:border-red-500'
                    : 'border-[var(--line)] focus:border-[var(--ink)]'
                }`}
                style={{ padding: 14, resize: 'vertical' }}
              />
              <p className="text-[11.5px] text-[var(--mute)] mt-2 m-0">
                Tip: if you add / remove menu items here, click <b>Sync to inventory</b> after saving to push them into the Products &amp; Inventory sheet. Existing stock is preserved.
              </p>
            </Panel>
          </div>
        )}
      </div>
    </>
  );
}
