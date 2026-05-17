'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PageTopbar, PageHead, Panel, Pill } from '@/components/app/primitives';

// Compact "Xm ago" label for the topbar's last-saved indicator.
function savedAgo(ts: number | null): string {
  if (!ts) return '';
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

type Format = 'csv' | 'json';

export default function ClientSettingsPage() {
  const [prompt, setPrompt] = useState('');
  const [config, setConfig] = useState('');
  const [existingSystem, setExistingSystem] = useState('');
  const [exportFormat, setExportFormat] = useState<Format>('csv');
  const [upiId, setUpiId] = useState('');
  const [upiName, setUpiName] = useState('');
  // FSSAI allergen-safety guardrail (Work Item 4). Defaults TRUE in the
  // GET response unless the owner has explicitly toggled it off.
  const [allergenStrictMode, setAllergenStrictMode] = useState(true);
  const [initialAllergenStrict, setInitialAllergenStrict] = useState(true);
  // Kitchen capacity gate (Work Item 5). null = "not set, use platform
  // default 8". Stored as string in the input for free editing; parsed
  // back to int on save.
  const [concurrentOrderCap, setConcurrentOrderCap] = useState<string>('');
  const [initialConcurrentOrderCap, setInitialConcurrentOrderCap] = useState<string>('');
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
  const [ptAvailable, setPtAvailable] = useState(false);
  const [ptPrice, setPtPrice] = useState('');
  const [ptTrainerInfo, setPtTrainerInfo] = useState('');
  const [ptDirty, setPtDirty] = useState(false);
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
  // Live prompt preview — fetches the FULL runtime prompt (system_prompt
  // + AVAILABLE STAFF + LIVE STOCK as injected by the webhook). Lets the
  // owner verify what Gemini actually sees, instead of guessing whether
  // their staff/inventory edits made it through.
  const [previewPrompt, setPreviewPrompt] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewAt, setPreviewAt] = useState('');
  // Unix-ms timestamp of the most recent successful save in this session.
  // Used by the topbar "Saved Xm ago" badge so the user gets concrete
  // feedback instead of a silent toast that disappeared 3 seconds ago.
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  // Tick once a minute so the "Saved Xm ago" relative label refreshes
  // without a full re-render cascade.
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((n) => n + 1), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  // Derived list of sections with unsaved changes — drives the sticky
  // bottom save bar and the count badge on the topbar save button. Order
  // matches the on-page panel order so the labels read top-to-bottom.
  const allergenDirty = allergenStrictMode !== initialAllergenStrict;
  const capDirty = concurrentOrderCap.trim() !== initialConcurrentOrderCap.trim();
  const dirtySections = useMemo<string[]>(() => {
    const out: string[] = [];
    if (bizDirty) out.push('Business details');
    if (ptDirty) out.push('Personal training');
    if (promptDirty) out.push('System prompt');
    if (kbDirty) out.push('Business knowledge');
    if (allergenDirty) out.push('Allergen safety');
    if (capDirty) out.push('Kitchen capacity');
    return out;
  }, [bizDirty, ptDirty, promptDirty, kbDirty, allergenDirty, capDirty]);
  const anyDirty = dirtySections.length > 0;

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
        // Default TRUE if the server doesn't yet send the field (legacy
        // env without migration 0006 applied) — safer than defaulting off.
        const nextAllergenStrict =
          typeof data.allergenStrictMode === 'boolean' ? data.allergenStrictMode : true;
        setAllergenStrictMode(nextAllergenStrict);
        setInitialAllergenStrict(nextAllergenStrict);
        // Empty string represents "use platform default" — the UI shows
        // a placeholder "8 (default)" so the owner sees what the bot
        // will actually use.
        const nextCap =
          typeof data.concurrentOrderCap === 'number' ? String(data.concurrentOrderCap) : '';
        setConcurrentOrderCap(nextCap);
        setInitialConcurrentOrderCap(nextCap);
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
            const pt = (parsed as { personalTraining?: { available?: unknown; pricePerSession?: unknown; trainerInfo?: unknown } }).personalTraining;
            if (pt && typeof pt === 'object') {
              setPtAvailable(pt.available === true);
              setPtPrice(typeof pt.pricePerSession === 'string' ? pt.pricePerSession : '');
              setPtTrainerInfo(typeof pt.trainerInfo === 'string' ? pt.trainerInfo : '');
            } else {
              setPtAvailable(false);
              setPtPrice('');
              setPtTrainerInfo('');
            }
          }
        } catch {
          // Corrupt KB — leave fields blank, the JSON editor below will
          // surface the parse error.
        }
        setBizDirty(false);
        setPtDirty(false);
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

  const loadPreview = async () => {
    setPreviewLoading(true);
    try {
      const res = await fetch('/api/client/settings/preview-prompt', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && typeof data.fullPrompt === 'string') {
        setPreviewPrompt(data.fullPrompt);
        setPreviewAt(data.generatedAt || new Date().toISOString());
      } else {
        toast.error(data.error || 'Preview failed');
      }
    } catch {
      toast.error('Preview failed');
    } finally {
      setPreviewLoading(false);
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
        upi_id: upiId.trim(),
        upi_name: upiName.trim(),
        existing_system: existingSystem.trim(),
        export_format: exportFormat,
      };
      // Only send system_prompt if the user actually edited it — otherwise let
      // the server regenerate from the (possibly new) languages array / KB.
      if (promptDirty) bulk.system_prompt = prompt;
      // Allergen-safety toggle (Work Item 4) — only send if changed, so
      // we don't fire a needless boolean write on every save.
      if (allergenStrictMode !== initialAllergenStrict) {
        bulk.allergen_strict_mode = allergenStrictMode;
      }
      // Kitchen capacity cap (Work Item 5) — same diff-only pattern. Empty
      // string means "clear the override and use the platform default";
      // we send `null` to the server in that case (different from "didn't
      // change" which sends nothing).
      if (capDirty) {
        const trimmed = concurrentOrderCap.trim();
        if (trimmed === '') {
          bulk.concurrent_order_cap = null;
        } else {
          const n = parseInt(trimmed, 10);
          if (Number.isFinite(n) && n > 0) {
            bulk.concurrent_order_cap = Math.min(200, n);
          }
        }
      }

      // If the business-detail fields (address / city / working hours /
      // welcome) were touched, merge them into the KB JSON we send. We
      // start from whatever the user has typed in the raw KB editor (or
      // the originally-loaded value) so this never clobbers their other
      // edits, then overlay the four fields.
      if (bizDirty || kbDirty || ptDirty) {
        let baseKb: Record<string, unknown> = {};
        try { baseKb = JSON.parse(config || '{}'); } catch { baseKb = {}; }
        if (!baseKb || typeof baseKb !== 'object' || Array.isArray(baseKb)) baseKb = {};
        if (bizDirty) {
          baseKb.address = address.trim();
          baseKb.city = city.trim();
          baseKb.workingHours = workingHours.trim();
          baseKb.welcomeMessage = welcomeMessage.trim();
        }
        if (ptDirty) {
          baseKb.personalTraining = {
            available: ptAvailable,
            pricePerSession: ptAvailable ? ptPrice.trim() : '',
            trainerInfo: ptAvailable ? ptTrainerInfo.trim() : '',
          };
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
        setPtDirty(false);
        setKbError('');
        setLastSavedAt(Date.now());
        // Resync the allergen baseline so the diff-check fires fresh on
        // the next save.
        setInitialAllergenStrict(allergenStrictMode);
        // Same for the capacity cap. If the owner cleared the input we
        // store '' in the baseline so the empty-state diff is right.
        setInitialConcurrentOrderCap(concurrentOrderCap.trim());
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
          <>
            {lastSavedAt && !anyDirty && (
              <span
                className="hidden sm:inline-flex items-center gap-1.5 text-[11.5px] text-[var(--mute)]"
                title={`Saved at ${new Date(lastSavedAt).toLocaleString('en-IN')}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Saved {savedAgo(lastSavedAt)}
              </span>
            )}
            <Pill
              variant="ink"
              onClick={handleSaveAll}
              disabled={saving || (!anyDirty && lastSavedAt !== null)}
            >
              {saving
                ? 'Saving…'
                : anyDirty
                  ? `💾 Save ${dirtySections.length} change${dirtySections.length === 1 ? '' : 's'}`
                  : '💾 Save all changes'}
            </Pill>
          </>
        }
      />
      <div style={{ padding: '28px 32px 60px' }} className="max-w-4xl">
        <PageHead
          title={<>Your bot&apos;s <span className="zt-serif">voice.</span></>}
          sub="Tune tone, rules, knowledge, payments, and how daily exports land in your inbox."
        />

        {loading ? (
          <SettingsSkeleton />
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

            {botType === 'gym' && (
              <Panel
                title="Personal training"
                sub="The default rate and trainer description shown when no specific trainer is added in the Staff section. Add specific trainers (with their own prices) under Client → Staff to override this."
              >
                <div className="grid gap-3">
                  <label className="flex items-center gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      checked={ptAvailable}
                      onChange={(e) => { setPtAvailable(e.target.checked); setPtDirty(true); }}
                    />
                    <span>Personal training is available at this gym</span>
                  </label>
                  {ptAvailable && (
                    <>
                      <div className="grid gap-1">
                        <label className="text-[12px] uppercase tracking-[.06em] text-[var(--mute)] font-semibold">Default price per session</label>
                        <input
                          type="text"
                          value={ptPrice}
                          onChange={(e) => { setPtPrice(e.target.value); setPtDirty(true); }}
                          placeholder="e.g., Rs. 2000"
                          className="rounded-[10px] border border-[var(--line)] bg-[var(--card)] text-foreground px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="grid gap-1">
                        <label className="text-[12px] uppercase tracking-[.06em] text-[var(--mute)] font-semibold">Trainer description (optional)</label>
                        <textarea
                          rows={2}
                          value={ptTrainerInfo}
                          onChange={(e) => { setPtTrainerInfo(e.target.value); setPtDirty(true); }}
                          placeholder="e.g., Certified, 5+ years experience"
                          className="rounded-[10px] border border-[var(--line)] bg-[var(--card)] text-foreground px-3 py-2 text-sm resize-none"
                        />
                      </div>
                    </>
                  )}
                </div>
                {ptDirty && (
                  <p className="text-[11px] text-[var(--mute)] mt-2">
                    Unsaved personal-training info — click <b>Save all changes</b> at the top.
                  </p>
                )}
              </Panel>
            )}

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
              title="Language behavior"
              sub="Your bot auto-detects every customer's language and replies in the same one. Default is English when the customer's language isn't clear. No setup needed — just works."
            >
              <p className="text-[12.5px] text-[var(--mute)] m-0">
                Pure English in → pure English out. Hinglish in → Hinglish out. Devanagari Hindi in → Hindi out. Tamil/Telugu/Bengali/etc. in → reply in that language if confidently identified, otherwise English.
              </p>
            </Panel>

            <Panel
              title="Preview live prompt"
              sub="See exactly what the bot's AI is told right now — your saved system prompt PLUS the live trainers/staff and current inventory the webhook injects on every customer message. Use this to confirm your latest edits actually reached the bot."
            >
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Pill variant="ink" onClick={loadPreview} disabled={previewLoading}>
                  {previewLoading ? 'Loading…' : '🔍 Preview live prompt'}
                </Pill>
                {previewAt && (
                  <span className="text-[11.5px] text-[var(--mute)]">
                    Snapshot at {new Date(previewAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })} IST
                  </span>
                )}
              </div>
              {previewPrompt && (
                <textarea
                  value={previewPrompt}
                  readOnly
                  rows={22}
                  spellCheck={false}
                  className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--bg-2)] focus:outline-none zt-mono text-[12px]"
                  style={{ padding: 14, resize: 'vertical' }}
                />
              )}
              <p className="text-[11.5px] text-[var(--mute)] mt-2 m-0">
                Read-only snapshot. To change the static part, edit the System prompt or Business knowledge below. Staff/inventory parts come live from <b>/client/staff</b> and <b>/client/inventory</b>.
              </p>
            </Panel>

            {/* ── Allergen safety (Work Item 4) ────────────────────────────
                FSSAI 2020 Menu Labelling Regulations compliance toggle.
                Default-on. Owners with fully-populated allergens[] on
                every item can turn it off; everyone else benefits from
                the guardrail. */}
            {botType === 'restaurant' && (
              <Panel title="Allergen safety" sub="FSSAI guardrail — bot refuses to confirm allergen safety when item data is missing.">
                <div className="flex items-start gap-3.5">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={allergenStrictMode}
                    aria-label="Toggle allergen strict mode"
                    onClick={() => setAllergenStrictMode((v) => !v)}
                    className="relative rounded-full cursor-pointer flex-shrink-0"
                    style={{
                      width: 38,
                      height: 22,
                      background: allergenStrictMode ? 'var(--ink)' : 'var(--bg-2)',
                      transition: 'background .2s',
                      marginTop: 2,
                    }}
                  >
                    <span
                      className="absolute top-[3px] rounded-full transition-all"
                      style={{
                        width: 16,
                        height: 16,
                        left: allergenStrictMode ? 19 : 3,
                        background: allergenStrictMode ? 'var(--accent)' : 'var(--card)',
                        boxShadow: '0 1px 3px #00000022',
                      }}
                    />
                  </button>
                  <div className="flex-1 text-[13px] leading-snug">
                    <div className="font-semibold mb-1">
                      Strict mode {allergenStrictMode ? 'ON' : 'OFF'}
                      {allergenDirty && (
                        <span className="text-[10.5px] zt-mono uppercase tracking-[.08em] text-[#E89A1C] ml-2">
                          unsaved
                        </span>
                      )}
                    </div>
                    <div className="text-[var(--mute)] text-[12px]">
                      {allergenStrictMode
                        ? 'When a customer asks about an allergen (peanut, dairy, gluten, etc.) and the matching menu item has no declared allergen list, the bot refuses to confirm safety and routes the customer to call you directly. Required for FSSAI compliance on chains with 10+ outlets — recommended for everyone else too.'
                        : 'The bot will rely on whatever allergen data is in your menu and may answer "please confirm with kitchen" when fields are blank. Only safe if you have populated allergens[] on EVERY menu item — otherwise customers may interpret a soft defer as "probably safe".'}
                    </div>
                  </div>
                </div>
              </Panel>
            )}

            {/* ── Kitchen capacity gate (Work Item 5) ──────────────────────
                Restaurant-only. Number input + "use default" reset link.
                Empty string in state = use platform default 8. Owner
                bumps this up for busy days, down for weak kitchen days. */}
            {botType === 'restaurant' && (
              <Panel title="Kitchen capacity" sub="Cap on concurrent in-flight orders. Bot stops accepting new orders when this many are already cooking — quotes a 20-min wait instead.">
                <div className="flex items-end flex-wrap gap-3.5">
                  <div>
                    <div className="text-[11.5px] font-semibold mb-1">Concurrent order cap</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={concurrentOrderCap}
                        onChange={(e) => setConcurrentOrderCap(e.target.value)}
                        placeholder="8 (default)"
                        className="w-[120px] rounded-[10px] border border-[var(--line)] bg-[var(--card)] focus:border-[var(--ink)] focus:outline-none text-[13.5px] font-semibold"
                        style={{ padding: '9px 12px' }}
                      />
                      {concurrentOrderCap.trim() !== '' && (
                        <button
                          type="button"
                          onClick={() => setConcurrentOrderCap('')}
                          className="text-[11.5px] text-[var(--mute)] hover:text-[var(--ink)] underline"
                        >
                          Reset to default
                        </button>
                      )}
                      {capDirty && (
                        <span className="text-[10.5px] zt-mono uppercase tracking-[.08em] text-[#E89A1C]">
                          unsaved
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-[260px] text-[12px] text-[var(--mute)] leading-snug">
                    Counted across orders in the last 15 minutes that aren&apos;t yet served / delivered / picked up. <b>Default 8</b> covers a typical single-kitchen dhaba; large QSRs can raise to 20–30, cloud kitchens with packing crews to 40+. Stay realistic — accepting more than the kitchen can ship on time triggers cancellations and bad reviews.
                  </div>
                </div>
              </Panel>
            )}

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

      {/* Sticky bottom save bar — appears whenever any section is dirty so
          the user never has to scroll back to the topbar to save. */}
      {anyDirty && !loading && (
        <div
          className="sticky bottom-0 z-20 border-t border-[var(--line)] bg-[var(--card)]/95 backdrop-blur flex items-center gap-3 flex-wrap"
          style={{ padding: '12px 24px' }}
        >
          <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold">
            <span className="w-2 h-2 rounded-full bg-[#E89A1C] animate-pulse" />
            <span>You have unsaved changes</span>
            <span className="text-[var(--mute)] font-normal">in {dirtySections.join(', ')}</span>
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              disabled={saving}
              className="text-[12px] font-semibold text-[var(--mute)] hover:text-foreground transition disabled:opacity-50"
            >
              Discard
            </button>
            <Pill variant="ink" onClick={handleSaveAll} disabled={saving}>
              {saving
                ? 'Saving…'
                : `💾 Save ${dirtySections.length} change${dirtySections.length === 1 ? '' : 's'}`}
            </Pill>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Loading skeleton — mirrors the real panel layout so nothing jumps
// when settings load. Eight bars of varying widths is enough to convey
// "structured form" without modeling each panel exactly.
function SettingsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-[18px] border border-[var(--line)] bg-[var(--card)] animate-pulse"
          style={{ padding: '20px 22px' }}
        >
          <div className="h-4 w-40 rounded bg-[var(--line)] mb-2" />
          <div className="h-3 w-2/3 rounded bg-[var(--line)] mb-4 opacity-60" />
          <div className="flex flex-col gap-2">
            <div className="h-9 rounded-[10px] bg-[var(--bg-2)]" />
            <div className="h-9 w-3/4 rounded-[10px] bg-[var(--bg-2)]" />
          </div>
        </div>
      ))}
    </div>
  );
}
