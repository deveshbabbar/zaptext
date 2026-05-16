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

interface Branding {
  coverImageUrl: string;
  brandLogoUrl: string;
  brandColor: string;
  tagline: string;
  palette: string;
}

interface StorefrontState {
  businessName: string;
  slug: string;
  suggestedSlug: string;
  servicePincodes: string[];
  storefrontEnabled: boolean;
  publicUrl: string;
  appDomain: string;
  branding: Branding;
}

const EMPTY_BRANDING: Branding = {
  coverImageUrl: '', brandLogoUrl: '', brandColor: '', tagline: '', palette: '',
};

// Five palettes — keys + display labels + the primary swatch shown in the
// picker. Single source of truth on the API side
// (app/api/client/restaurant/storefront/route.ts::ALLOWED_PALETTES) +
// the storefront paint (lib/storefront-ui/atoms.tsx::PALETTES) — both
// must include exactly these five.
const PALETTE_OPTIONS: Array<{ key: string; label: string; primary: string; dark: string; soft: string }> = [
  { key: 'sage',       label: 'Sage',       primary: '#5C7A4F', dark: '#3F5736', soft: '#E7EFE1' },
  { key: 'forest',     label: 'Forest',     primary: '#2F5D3A', dark: '#1F3D26', soft: '#DCE9DA' },
  { key: 'olive',      label: 'Olive',      primary: '#7A8540', dark: '#54592D', soft: '#EFF0DE' },
  { key: 'charcoal',   label: 'Charcoal',   primary: '#3D4744', dark: '#1F2421', soft: '#E5E5E1' },
  { key: 'terracotta', label: 'Terracotta', primary: '#B5664A', dark: '#7A3F2A', soft: '#F3E2D4' },
];

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
  const [branding, setBranding] = useState<Branding>(EMPTY_BRANDING);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/client/restaurant/storefront');
        if (!res.ok) throw new Error(`load failed (${res.status})`);
        const data = (await res.json()) as StorefrontState;
        setState(data);
        setSlugDraft(data.slug);
        setPincodes(data.servicePincodes);
        setBranding(data.branding || EMPTY_BRANDING);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not load storefront settings');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function patch(body: {
    slug?: string;
    service_pincodes?: string[];
    storefront_enabled?: boolean;
    branding?: Partial<Branding>;
  }) {
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
      setBranding(data.branding || EMPTY_BRANDING);
      return data;
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveBranding() {
    try {
      await patch({ branding });
      toast.success('Branding saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    }
  }

  function updateBranding<K extends keyof Branding>(key: K, value: Branding[K]) {
    setBranding((prev) => ({ ...prev, [key]: value }));
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
  const brandingDirty = JSON.stringify(branding) !== JSON.stringify(state.branding);
  const canEnable = !!state.slug;
  // Preview accent drives the palette colour shown in the live preview
  // tile (and the place-order button mock-up). Resolves the owner's
  // selected palette to its primary hex; sage by default. brandColor
  // is no longer used by the storefront paint but the field is still in
  // the UI for owners who haven't switched workflows yet — its value
  // doesn't affect the preview.
  const selectedPalette = PALETTE_OPTIONS.find((p) => p.key === branding.palette);
  const previewAccent = (selectedPalette ?? PALETTE_OPTIONS[0]).primary;
  const previewDark = (selectedPalette ?? PALETTE_OPTIONS[0]).dark;

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

      {/* ─── Brand & appearance ────────────────────────────────────────── */}
      <Panel
        title="Brand & appearance"
        sub="How your storefront looks to customers — cover photo, logo, tagline, and brand color. Same values are also used by your WhatsApp bot when it sends menu links."
      >
        <div className="grid lg:grid-cols-[1fr_minmax(0,360px)] gap-5">
          {/* Form fields */}
          <div className="space-y-3.5">
            <div>
              <Label htmlFor="brand-cover">Cover image URL</Label>
              <Input
                id="brand-cover"
                value={branding.coverImageUrl}
                onChange={(e) => updateBranding('coverImageUrl', e.target.value)}
                placeholder="https://… (a wide photo of your dishes / interior)"
                disabled={saving}
                maxLength={500}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Recommended: 1600×600 (or wider). Upload to imgur / cloudinary and paste the direct image link.
              </p>
            </div>
            <div>
              <Label htmlFor="brand-logo">Logo URL</Label>
              <Input
                id="brand-logo"
                value={branding.brandLogoUrl}
                onChange={(e) => updateBranding('brandLogoUrl', e.target.value)}
                placeholder="https://… (square logo, 256×256 or larger)"
                disabled={saving}
                maxLength={500}
              />
            </div>
            <div>
              <Label htmlFor="brand-tagline">Tagline</Label>
              <Input
                id="brand-tagline"
                value={branding.tagline}
                onChange={(e) => updateBranding('tagline', e.target.value)}
                placeholder="One line — e.g. North Indian comfort food, since 2014"
                disabled={saving}
                maxLength={120}
              />
              <p className="text-[11px] text-muted-foreground mt-1">{branding.tagline.length}/120</p>
            </div>
            <div>
              <Label>Palette</Label>
              <p className="text-[11px] text-muted-foreground mt-1 mb-2">
                Choose the colour scheme for your storefront. Applies to the hero, cart bar, place-order button, and accents.
              </p>
              <div
                role="radiogroup"
                aria-label="Storefront palette"
                className="flex flex-wrap gap-2"
              >
                {PALETTE_OPTIONS.map((p) => {
                  const isActive = (branding.palette || 'sage') === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      onClick={() => updateBranding('palette', p.key)}
                      disabled={saving}
                      title={p.label}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 12px 6px 6px',
                        borderRadius: 999,
                        border: `1.5px solid ${isActive ? p.primary : 'var(--line)'}`,
                        background: isActive ? p.soft : 'var(--card)',
                        color: 'var(--ink)',
                        cursor: saving ? 'not-allowed' : 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                        transition: 'border-color .15s, background .15s',
                      }}
                    >
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 999,
                          background: `linear-gradient(135deg, ${p.primary}, ${p.dark})`,
                          border: `1.5px solid ${isActive ? '#fff' : 'transparent'}`,
                          boxShadow: isActive ? `0 0 0 1.5px ${p.primary}` : 'none',
                        }}
                        aria-hidden
                      />
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label htmlFor="brand-color">Brand color</Label>
              <div className="flex items-center gap-2">
                <input
                  id="brand-color"
                  type="color"
                  value={
                    branding.brandColor && /^#[0-9a-fA-F]{6,8}$/.test(branding.brandColor)
                      ? branding.brandColor.slice(0, 7)
                      : '#111111'
                  }
                  onChange={(e) => updateBranding('brandColor', e.target.value.toLowerCase())}
                  disabled={saving}
                  className="h-9 w-12 cursor-pointer rounded border border-[var(--line)] bg-background"
                  aria-label="Pick brand color"
                />
                <Input
                  value={branding.brandColor}
                  onChange={(e) => updateBranding('brandColor', e.target.value.toLowerCase())}
                  placeholder="#b8336a"
                  className="h-9 w-[140px] font-mono"
                  disabled={saving}
                  maxLength={9}
                />
                {branding.brandColor && (
                  <button
                    type="button"
                    className="text-xs underline text-muted-foreground hover:text-foreground"
                    onClick={() => updateBranding('brandColor', '')}
                    disabled={saving}
                  >
                    Clear
                  </button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Used for the place-order button, accents, and the cover gradient.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Pill variant="ink" onClick={handleSaveBranding} disabled={saving || !brandingDirty}>
                {saving ? 'Saving…' : 'Save branding'}
              </Pill>
              {brandingDirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
            </div>
          </div>

          {/* Live preview */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <div
              style={{
                width: '100%',
                borderRadius: 14,
                overflow: 'hidden',
                border: '1px solid var(--line)',
                background: '#fff',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  height: 140,
                  backgroundImage: branding.coverImageUrl
                    ? `linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.55)), url(${branding.coverImageUrl})`
                    : `linear-gradient(180deg, ${previewAccent} 0%, ${previewDark} 100%)`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: 14,
                    bottom: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  {branding.brandLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={branding.brandLogoUrl}
                      alt=""
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 10,
                        objectFit: 'cover',
                        border: '2px solid #fff',
                        background: '#fff',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 10,
                        background: '#fff',
                        color: previewAccent,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: 22,
                        border: '2px solid #fff',
                      }}
                    >
                      {state.businessName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div style={{ color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,.5)' }}>
                    <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.15 }}>
                      {state.businessName}
                    </div>
                    <div style={{ fontSize: 11.5, opacity: 0.92 }}>
                      {branding.tagline || 'Tap items to add'}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 12, color: '#666' }}>1 item · ₹240</div>
                <div
                  style={{
                    padding: '7px 14px',
                    borderRadius: 999,
                    background: previewAccent,
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Place order
                </div>
              </div>
            </div>
          </div>
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
