'use client';

// Storefront settings form. Loads + saves three fields:
//   1. slug                 → <slug>.zaptext.shop
//   2. service_pincodes     → JSON array of 6-digit pincodes (chips UI)
//   3. storefront_enabled   → master on/off
//
// The API endpoint (/api/client/restaurant/storefront) does all validation
// — this form just surfaces error codes back to the owner with friendly
// messages. Slug uniqueness check happens server-side on PATCH; we don't
// debounce a separate "is this slug available" request to keep traffic low.

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Panel, Pill } from '@/components/app/primitives';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface StorefrontState {
  businessName: string;
  slug: string;
  suggestedSlug: string;
  servicePincodes: string[];
  storefrontEnabled: boolean;
  publicUrl: string;
  appDomain: string;
}

interface SaveError {
  error?: string;
  message?: string;
}

const PINCODE_REGEX = /^[1-8]\d{5}$/;

export function StorefrontForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<StorefrontState | null>(null);

  // Local edit state — only persisted on Save. Keeps the dirty/clean
  // bookkeeping simple: we diff these against `state` on every render.
  const [slugDraft, setSlugDraft] = useState('');
  const [pincodeInput, setPincodeInput] = useState('');
  const [pincodes, setPincodes] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/client/restaurant/storefront');
        if (!res.ok) throw new Error(`load failed (${res.status})`);
        const data = (await res.json()) as StorefrontState;
        setState(data);
        setSlugDraft(data.slug);
        setPincodes(data.servicePincodes);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not load storefront settings');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function patch(body: { slug?: string; service_pincodes?: string[]; storefront_enabled?: boolean }) {
    setSaving(true);
    try {
      const res = await fetch('/api/client/restaurant/storefront', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as StorefrontState & SaveError;
      if (!res.ok) {
        throw new Error(data.message || data.error || `save failed (${res.status})`);
      }
      setState(data);
      setSlugDraft(data.slug);
      setPincodes(data.servicePincodes);
      return data;
    } finally {
      setSaving(false);
    }
  }

  // --- Slug actions -------------------------------------------------------

  async function handleSaveSlug() {
    const target = slugDraft.trim().toLowerCase();
    if (!target) {
      toast.error('Pick a subdomain first');
      return;
    }
    try {
      await patch({ slug: target });
      toast.success('Subdomain saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    }
  }

  function handleUseSuggested() {
    if (state) setSlugDraft(state.suggestedSlug);
  }

  // --- Pincode actions ----------------------------------------------------

  function handleAddPincode() {
    // Parse one OR many pincodes pasted/typed at once (space, comma,
    // newline separated). Validates each, dedupes against the current list.
    const tokens = pincodeInput
      .split(/[\s,;]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (tokens.length === 0) return;
    const valid = tokens.filter((t) => PINCODE_REGEX.test(t));
    const invalid = tokens.filter((t) => !PINCODE_REGEX.test(t));
    if (invalid.length > 0) {
      toast.error(`Ignored ${invalid.length} invalid pincode(s) — must be 6 digits starting 1-8`);
    }
    if (valid.length === 0) {
      setPincodeInput('');
      return;
    }
    const next = [...pincodes];
    for (const p of valid) if (!next.includes(p)) next.push(p);
    setPincodes(next);
    setPincodeInput('');
  }

  function handleRemovePincode(p: string) {
    setPincodes(pincodes.filter((x) => x !== p));
  }

  async function handleSavePincodes() {
    try {
      await patch({ service_pincodes: pincodes });
      toast.success(
        pincodes.length === 0
          ? 'Pincode gating disabled — storefront accepts orders from any location'
          : `${pincodes.length} pincode${pincodes.length === 1 ? '' : 's'} saved`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    }
  }

  // --- Enable toggle ------------------------------------------------------

  async function handleToggle(next: boolean) {
    try {
      await patch({ storefront_enabled: next });
      toast.success(next ? 'Storefront is LIVE' : 'Storefront is paused');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    }
  }

  async function handleCopyLink() {
    if (!state?.publicUrl) return;
    try {
      await navigator.clipboard.writeText(state.publicUrl);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy — long-press to copy manually');
    }
  }

  if (loading || !state) {
    return <p className="text-sm text-muted-foreground">Loading storefront settings…</p>;
  }

  const slugDirty = slugDraft.trim().toLowerCase() !== state.slug;
  const pincodesDirty = JSON.stringify(pincodes) !== JSON.stringify(state.servicePincodes);
  const canEnable = !!state.slug;

  return (
    <div className="space-y-5">
      {/* ─── Live status banner ──────────────────────────────────────────── */}
      <Panel
        title={
          <span className="flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                state.storefrontEnabled ? 'bg-emerald-500' : 'bg-zinc-400'
              }`}
            />
            {state.storefrontEnabled ? 'Storefront is LIVE' : 'Storefront is paused'}
          </span>
        }
        sub={
          state.storefrontEnabled
            ? `Customers visiting ${state.publicUrl || '<your-slug>.' + state.appDomain} can browse your menu and place orders right now.`
            : 'Flip the toggle below once your subdomain is set. While paused, the subdomain returns a not-found page so half-configured menus stay private.'
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={state.storefrontEnabled}
              disabled={saving || !canEnable}
              onChange={(e) => handleToggle(e.target.checked)}
            />
            Enable public storefront
          </label>
          {!canEnable && (
            <span className="text-xs text-amber-600">
              Set a subdomain first.
            </span>
          )}
          {state.publicUrl && (
            <>
              <Pill variant="ink" onClick={handleCopyLink}>
                Copy link
              </Pill>
              <a
                href={state.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold underline hover:no-underline"
              >
                Open in new tab ↗
              </a>
            </>
          )}
        </div>
      </Panel>

      {/* ─── Subdomain ──────────────────────────────────────────────────── */}
      <Panel
        title="Subdomain"
        sub="The web address customers visit. Lowercase letters, digits, hyphens only. 1-63 characters. Must be globally unique."
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-md border border-[var(--line)] bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring">
              <span className="pl-3 pr-1.5 text-sm text-muted-foreground select-none">https://</span>
              <Input
                value={slugDraft}
                onChange={(e) => setSlugDraft(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder={state.suggestedSlug || 'my-restaurant'}
                className="h-9 w-[220px] border-0 px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                maxLength={63}
                disabled={saving}
              />
              <span className="pr-3 pl-1 text-sm text-muted-foreground select-none">.{state.appDomain}</span>
            </div>
            <Pill variant="ink" onClick={handleSaveSlug} disabled={saving || !slugDirty}>
              {saving ? 'Saving…' : 'Save subdomain'}
            </Pill>
            {state.suggestedSlug && state.suggestedSlug !== slugDraft && (
              <button
                type="button"
                className="text-xs underline text-muted-foreground hover:text-foreground"
                onClick={handleUseSuggested}
                disabled={saving}
              >
                Use suggested: {state.suggestedSlug}
              </button>
            )}
          </div>
          {slugDirty && slugDraft && (
            <p className="text-xs text-amber-600">
              Unsaved change — preview URL will be <b>https://{slugDraft}.{state.appDomain}</b> after you save.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Heads-up — changing your subdomain breaks any QR codes / flyers / Instagram bio links pointing at the old URL.
            Pick a slug you're happy with up-front.
          </p>
        </div>
      </Panel>

      {/* ─── Service pincodes ───────────────────────────────────────────── */}
      <Panel
        title="Delivery pincodes"
        sub="Customers must enter their pincode before they see the menu. Leave empty to accept orders from any location (takeaway / dine-in customers still see the menu either way)."
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="sr-only" htmlFor="pin-input">
              Add pincode
            </Label>
            <Input
              id="pin-input"
              value={pincodeInput}
              onChange={(e) => setPincodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  handleAddPincode();
                }
              }}
              placeholder="110001 110002 (or paste many — space/comma separated)"
              className="h-9 w-[360px]"
              disabled={saving}
            />
            <Pill variant="ink" onClick={handleAddPincode} disabled={saving || !pincodeInput.trim()}>
              Add
            </Pill>
          </div>
          {pincodes.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {pincodes.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-xs font-mono"
                >
                  {p}
                  <button
                    type="button"
                    aria-label={`Remove ${p}`}
                    onClick={() => handleRemovePincode(p)}
                    className="text-muted-foreground hover:text-foreground"
                    disabled={saving}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No pincode restriction — anyone can browse and order.
            </p>
          )}
          <div className="flex items-center gap-2 pt-1">
            <Pill variant="ink" onClick={handleSavePincodes} disabled={saving || !pincodesDirty}>
              {saving ? 'Saving…' : pincodes.length === 0 ? 'Disable pincode gate' : 'Save pincodes'}
            </Pill>
            {pincodesDirty && (
              <span className="text-xs text-amber-600">Unsaved changes</span>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}
