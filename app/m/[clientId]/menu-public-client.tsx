'use client';

// Mobile-first menu + cart for restaurant customers reaching the public
// menu via a bot-shared link (no QR scan / no table). Three order modes:
// Delivery (asks for address), Takeaway (asks for pickup name), Dine-in
// (asks for table number). On submit hits /api/menu/submit which writes
// to dine_in_orders and sends a WhatsApp confirmation back to the
// customer's phone.

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { themeCssVars, heroGradient, resolveAccent, LAYOUT } from '@/lib/storefront-theme';
import { DesktopView } from '@/lib/storefront-ui/desktop-view';
import { MobileView } from '@/lib/storefront-ui/mobile-view';

// MapLibre lives inside MapPicker — touches `window`, so we lazy-load
// client-side only. SSR returns nothing for this slot; the loading
// state is the "📍 Your delivery location" panel below.
const MapPicker = dynamic(() => import('./map-picker').then((m) => m.MapPicker), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 240,
        borderRadius: 10,
        border: '1px solid #ddd',
        background: '#f7f7f7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        color: '#888',
      }}
    >
      Loading map…
    </div>
  ),
});

interface OutletMarker {
  id: string;
  slug: string;
  name: string;
  latitude: number;
  longitude: number;
  deliveryRadiusKm?: number;
}

interface FlatItem {
  id: string;
  category: string;
  name: string;
  price: string;
  description: string;
  isVeg: boolean;
  isBestseller: boolean;
  sizes: Array<{ label: string; price: number }>;
  allergens: string[];
}

// Customer-facing labels keyed by the same 8 FSSAI keys the editor
// stores. Anything not in this map renders verbatim — safe fallback for
// future custom allergens an owner might type in via bulk import.
const ALLERGEN_LABEL: Record<string, string> = {
  'milk': 'Milk',
  'eggs': 'Egg',
  'gluten': 'Gluten',
  'peanuts': 'Peanut',
  'tree-nuts': 'Tree nut',
  'soy': 'Soy',
  'fish': 'Fish',
  'crustacean': 'Crustacean',
};

interface ComplianceInfo {
  fssaiLicenseNumber?: string;
  fssaiExpiryDate?: string;          // ISO date string
  gstin?: string;
  jainCertified?: boolean;
  pureVeg?: boolean;
  sharedKitchenWithNonVeg?: boolean;
  calorieDisclosureRequired?: boolean;
}

interface PricingInfo {
  rainSurchargePercent?: number;
  peakHourSurchargePercent?: number;
  festivalSurchargePercent?: number;
  deliveryCharges?: string;
  packagingChargesPerOrder?: string;
  packagingChargesPerItem?: string;
  minimumOrder?: string;
  deliveryRadius?: string;
}

interface Props {
  businessName: string;
  clientId: string;
  items: FlatItem[];
  brandLogoUrl?: string;
  brandColor?: string;
  /** Wide hero image rendered at the top of the storefront. When set,
   *  it replaces the minimal sticky header with a DotPe-style banner.
   *  When empty, falls back to the compact header so dashboards
   *  without branding still look fine. */
  coverImageUrl?: string;
  tagline?: string;
  /** Hero meta pills — surfaced under the restaurant name in the hero.
   *  All optional; missing values just drop their pill. */
  city?: string;
  cuisineType?: string;
  workingHours?: string;
  /** Used by the new desktop-view footer + sidebar quick-facts. */
  phone?: string;
  address?: string;
  prefillPhone?: string;
  deliveryAvailable?: boolean;
  dineInEnabled?: boolean;
  takeawayEnabled?: boolean;
  compliance?: ComplianceInfo;
  pricing?: PricingInfo;
  /** Raw inbound text (voice transcript or typed order) from the bot
   *  link. When present, the page tries to pre-select matching items
   *  into the cart so a voice-order customer just confirms + pays
   *  instead of re-tapping each dish. */
  prefillQuery?: string;
  /** Customer's lat/lng forwarded from the WhatsApp location share
   *  (Phase 3K). Used to set delivery_lat/lng on the order + let the
   *  server compute the assigned outlet. Map UI to drag-pin comes
   *  in Phase 3L. */
  prefillLat?: number | null;
  prefillLng?: number | null;
  /** Outlets with valid lat/lng — rendered as markers + zone circles
   *  on the embedded map. Empty for single-outlet kitchens without
   *  coords; the map still works as a generic pin picker. */
  outletMarkers?: OutletMarker[];
  /** Set when the customer arrived via the "Place a different order"
   *  bypass on the recent-order intercept (?new=1). Forwards to the
   *  submit endpoint as bypassRecent so the 2-min duplicate guard
   *  is skipped for this submission only. */
  bypassRecentOrderGuard?: boolean;
}

type OrderMode = 'delivery' | 'takeaway' | 'dine_in';

function parsePrice(raw: string): number {
  const m = raw.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

// Build a Set of normalised tokens from a free-text query — the bot
// forwards either the customer's typed message or the Whisper voice
// transcript verbatim, so we strip punctuation + diacritics, drop very
// short tokens (less than 3 chars — too generic to match), and lower-
// case everything. Devanagari is preserved as-is (Whisper transcribes
// Hindi to Devanagari for Hindi-script speakers).
function tokenise(raw: string): Set<string> {
  if (!raw) return new Set();
  const cleaned = raw
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')   // strip combining accents
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')  // punctuation -> space
    .toLowerCase();
  const out = new Set<string>();
  for (const tok of cleaned.split(/\s+/)) {
    if (tok.length >= 3) out.add(tok);
  }
  return out;
}

// Try to extract a quantity from the substring of `raw` immediately
// before a matched item-name occurrence. Returns 1 when no number is
// nearby — keeps the pre-fill conservative so we never add 10x by
// accident from a stray "10pm" mention.
function inferQty(raw: string, itemNameLower: string): number {
  const lower = raw.toLowerCase();
  const idx = lower.indexOf(itemNameLower);
  if (idx === -1) return 1;
  const before = lower.slice(Math.max(0, idx - 16), idx);
  const m = before.match(/(\d{1,2})\s*(?:x|×|nos|piece|pcs|plate)?\s*$/);
  if (!m) {
    // Common Hindi qty words
    if (/\b(do|दो)\s*$/.test(before)) return 2;
    if (/\b(teen|तीन)\s*$/.test(before)) return 3;
    if (/\b(char|चार)\s*$/.test(before)) return 4;
    if (/\b(paanch|paach|पांच)\s*$/.test(before)) return 5;
    return 1;
  }
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n < 1 || n > 10) return 1;
  return n;
}

// Tiny pill-style toggle for the search/filter bar. Active state uses
// the accent color sparingly so the bar doesn't compete with the menu
// content below. Defined as a local helper so it doesn't leak out of
// the storefront page module — Phase 2 component extraction will
// hoist it to its own file alongside the other storefront components.
function FilterChip({
  active,
  onClick,
  accent,
  children,
}: {
  active: boolean;
  onClick: () => void;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: '6px 14px',
        borderRadius: 999,
        background: active ? accent + '22' : 'var(--zt-surface)',
        border: `1px solid ${active ? accent : 'var(--zt-border)'}`,
        color: active ? accent : 'var(--zt-text)',
        fontSize: 12.5,
        fontWeight: active ? 700 : 500,
        cursor: 'pointer',
        letterSpacing: '.01em',
        transition: 'border-color .15s, color .15s, background .15s',
      }}
    >
      {children}
    </button>
  );
}

export function MenuPublicClient({
  businessName,
  clientId,
  items,
  brandLogoUrl,
  brandColor,
  coverImageUrl,
  tagline,
  city,
  cuisineType,
  workingHours,
  phone,
  address,
  prefillPhone = '',
  deliveryAvailable = true,
  dineInEnabled = true,
  takeawayEnabled = true,
  compliance,
  pricing,
  prefillQuery = '',
  prefillLat = null,
  prefillLng = null,
  outletMarkers = [],
  bypassRecentOrderGuard = false,
}: Props) {
  const accent = brandColor && /^#[0-9a-fA-F]{3,8}$/.test(brandColor) ? brandColor : '#111';
  const [cart, setCart] = useState<Record<string, number>>({});
  const [prefillCount, setPrefillCount] = useState(0);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState(prefillPhone);
  // Customer location state — initialised from the URL (when the bot
  // forwarded a WhatsApp location share via /m?lat=&lng=). The Use
  // current location button below overrides this with live device GPS.
  const [customerLat, setCustomerLat] = useState<number | null>(prefillLat ?? null);
  const [customerLng, setCustomerLng] = useState<number | null>(prefillLng ?? null);
  const [gpsPending, setGpsPending] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // One-shot voice/text-order pre-fill. When the bot forwarded the
  // customer's words via ?q=, scan the query for item-name matches
  // and pre-add them to the cart. We only run this once per mount
  // (the deps are stable inputs) so subsequent edits stick.
  useEffect(() => {
    if (!prefillQuery || items.length === 0) return;
    const tokens = tokenise(prefillQuery);
    if (tokens.size === 0) return;
    const lowerQuery = prefillQuery.toLowerCase();
    const additions: Record<string, number> = {};
    let matched = 0;
    for (const it of items) {
      const nameLower = it.name.toLowerCase();
      // Full-name substring is the strongest signal — match "paneer
      // butter masala" as a whole rather than each token, so we don't
      // false-match "butter naan" against "paneer butter masala".
      const fullHit = lowerQuery.includes(nameLower);
      // Token fallback: every token of the item name appears in the
      // query. Item names with 1 token (e.g. "Biryani") only require
      // that one token to match.
      const itemTokens = tokenise(it.name);
      let allHit = itemTokens.size > 0;
      for (const t of itemTokens) {
        if (!tokens.has(t)) { allHit = false; break; }
      }
      if (fullHit || allHit) {
        // No variants → add to base id. Variants → ambiguous, skip
        // (let the customer pick the size manually rather than guess).
        if (it.sizes.length === 0) {
          const qty = inferQty(prefillQuery, nameLower);
          additions[it.id] = qty;
          matched += 1;
        }
      }
    }
    if (matched > 0) {
      setCart((prev) => ({ ...prev, ...additions }));
      setPrefillCount(matched);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [notes, setNotes] = useState('');
  // Pick the first enabled mode as the initial value. If the owner has
  // disabled every mode (misconfiguration) we still default to delivery
  // — the submit endpoint will reject it cleanly and the customer sees
  // an error rather than a UI that looks "stuck".
  const initialMode: OrderMode = deliveryAvailable
    ? 'delivery'
    : takeawayEnabled
      ? 'takeaway'
      : dineInEnabled
        ? 'dine_in'
        : 'delivery';
  const [mode, setMode] = useState<OrderMode>(initialMode);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  // Explicit marketing opt-in toggle. Defaults to OFF — DPDPA §6
  // requires consent be "free, specific, informed, unconditional and
  // unambiguous"; a pre-ticked checkbox is the opposite of "free".
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ orderId: string; total: number; mode: OrderMode } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filter + search state. All three combine — `vegOnly` AND `bestsellersOnly`
  // AND `searchQuery` are applied together. Filters reset to empty defaults
  // on mount so the customer always sees the full menu first.
  const [searchQuery, setSearchQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [bestsellersOnly, setBestsellersOnly] = useState(false);

  // Group menu items by category. Recomputed when filters change so the
  // category list itself shrinks if a filter eliminates everything in a
  // section (e.g. veg-only on an all-non-veg starters category drops
  // the entire "Starters" header from the page).
  const grouped = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const map = new Map<string, FlatItem[]>();
    for (const it of items) {
      if (vegOnly && !it.isVeg) continue;
      if (bestsellersOnly && !it.isBestseller) continue;
      if (q) {
        const haystack = `${it.name} ${it.description} ${it.category}`.toLowerCase();
        if (!haystack.includes(q)) continue;
      }
      const list = map.get(it.category) || [];
      list.push(it);
      map.set(it.category, list);
    }
    return [...map.entries()];
  }, [items, searchQuery, vegOnly, bestsellersOnly]);

  // Stable slug per category for in-page anchors. The category nav bar
  // uses `#cat-<slug>` to scroll to each section.
  function catSlug(cat: string): string {
    return cat.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'cat';
  }

  // Original (un-filtered) grouped list — used by the category nav so
  // empty categories still appear (greyed out) instead of vanishing
  // when filters strip them, which would shift the nav layout.
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) set.add(it.category);
    return [...set];
  }, [items]);

  function splitKey(key: string): { itemId: string; variant: string | null } {
    const idx = key.indexOf('|');
    return idx === -1 ? { itemId: key, variant: null } : { itemId: key.slice(0, idx), variant: key.slice(idx + 1) };
  }

  const cartLines = useMemo(() => {
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([key, qty]) => {
        const { itemId, variant } = splitKey(key);
        const it = items.find((x) => x.id === itemId);
        if (!it) return null;
        let unit: number;
        let displayName: string;
        if (variant && it.sizes.length > 0) {
          const sz = it.sizes.find((s) => s.label === variant);
          if (!sz) return null;
          unit = sz.price;
          displayName = `${it.name} (${sz.label})`;
        } else {
          unit = parsePrice(it.price);
          displayName = it.name;
        }
        return { key, name: displayName, qty, unit, line: unit * qty };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [cart, items]);

  const total = cartLines.reduce((s, l) => s + l.line, 0);

  function bump(key: string, delta: number) {
    setCart((prev) => {
      const next = { ...prev, [key]: Math.max(0, (prev[key] || 0) + delta) };
      if (next[key] === 0) delete next[key];
      return next;
    });
  }

  async function handleSubmit() {
    setError(null);
    if (cartLines.length === 0) {
      setError('Please add at least one item. / Kam se kam ek item add kariye.');
      return;
    }
    const phoneDigits = (customerPhone || '').replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      setError('Enter a valid WhatsApp number (10+ digits). / Sahi WhatsApp number daaliye.');
      return;
    }
    if (mode === 'delivery' && !deliveryAddress.trim()) {
      setError('Delivery address is required. / Delivery address chahiye.');
      return;
    }
    if (mode === 'dine_in' && !tableNumber.trim()) {
      setError('Table number is required for dine-in. / Table number daaliye.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/menu/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          mode,
          customerName: customerName.trim(),
          customerPhone: phoneDigits,
          deliveryAddress: deliveryAddress.trim(),
          tableNumber: tableNumber.trim(),
          notes: notes.trim(),
          items: cartLines.map((l) => ({ name: l.name, qty: l.qty, price: l.unit })),
          marketingOptIn,
          // Phase 3K/3L — customer location for outlet routing.
          // Pre-filled from the URL (when reached via WhatsApp
          // location share) AND overridable by the in-page "Use my
          // current location" button (browser GPS) or "Pick on
          // Google Maps" flow. The server uses these to assign the
          // right outlet + saves them on the order for analytics.
          deliveryLat: typeof customerLat === 'number' ? customerLat : undefined,
          deliveryLng: typeof customerLng === 'number' ? customerLng : undefined,
          // Customer arrived via "Place a different order" bypass —
          // skip the 2-min duplicate guard for this submission.
          bypassRecent: bypassRecentOrderGuard,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; orderId?: string; total?: number; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || `Submit failed (${res.status})`);
        return;
      }
      setSubmitted({ orderId: data.orderId || '', total: data.total ?? total, mode });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    const modeLabel =
      submitted.mode === 'delivery' ? 'Delivery — coming to you'
      : submitted.mode === 'dine_in' ? `Dine-in — Table ${tableNumber}`
      : 'Takeaway — ready for pickup soon';
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', textAlign: 'center', maxWidth: 460, margin: '0 auto' }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Order placed!</h1>
        <p style={{ color: '#444', marginBottom: 4 }}>{modeLabel} · ₹{submitted.total.toFixed(0)}</p>
        <p style={{ color: '#666', fontSize: 13, marginBottom: 4 }}>
          The kitchen has been notified. You&apos;ll get a WhatsApp confirmation shortly.
        </p>
        <p style={{ color: '#666', fontSize: 13, marginBottom: 24 }}>
          Order place ho gaya! Kitchen ko inform kar diya. WhatsApp pe confirmation jaldi milega.
        </p>
        <button
          onClick={() => { setSubmitted(null); setCart({}); setNotes(''); setDeliveryAddress(''); setTableNumber(''); }}
          style={{ marginTop: 8, padding: '10px 20px', borderRadius: 999, background: '#111', color: '#fff', border: 'none', fontWeight: 600 }}
        >
          Order more / Aur order karein
        </button>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #ddd',
    marginBottom: 8,
    fontSize: 14,
    boxSizing: 'border-box',
  };

  // Viewport-aware split. On desktop (≥1024px) we render the new
  // storefront-ui design verbatim from the owner-installed design
  // system. SSR defaults to false (mobile) so the initial paint is
  // the mobile shell; the effect upgrades to desktop client-side.
  // Mobile keeps the existing render below until D2 swaps it for the
  // matching mobile-view layout.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Both views consume the same prop set — desktop renders the
  // 3-column layout, mobile renders the single-column sage shell.
  // We always render one of the two new design-system views now;
  // the legacy code path below this block is dead and gets deleted
  // in D4 cleanup.
  const sharedProps = {
    clientId,
    businessName,
    tagline,
    brandColor,
    brandLogoUrl,
    city,
    cuisineType,
    workingHours,
    phone,
    address,
    deliveryRadius: pricing?.deliveryRadius,
    minimumOrder: pricing?.minimumOrder,
    fssaiLicenseNumber: compliance?.fssaiLicenseNumber,
    gstin: compliance?.gstin,
    deliveryAvailable,
    takeawayEnabled,
    dineInEnabled,
    items,
    prefillPhone,
  };

  if (isDesktop) {
    return <DesktopView {...sharedProps} />;
  }
  return <MobileView {...sharedProps} />;

  // Theme-provider wrapper: paints the page dark, exposes CSS vars to
  // every child, and removes the legacy 540px mobile-only cap so the
  // storefront actually works on desktop. Children sit inside a centred
  // content shell (max 960px until Phase 2 introduces the 2-column
  // menu+cart grid).
  const themeWrap = themeCssVars(brandColor);

  return (
    <div style={{ ...themeWrap, paddingBottom: cartLines.length > 0 ? 140 : 32 }}>
      <div
        style={{
          maxWidth: LAYOUT.contentMaxWidth,
          margin: '0 auto',
          padding: 0,
        }}
      >
      {/*
        Hero — Phase 1 dark-theme overhaul. Three modes:
          (a) cover image set → full-bleed photo banner with dark
              gradient overlay so meta pills + name read cleanly
              regardless of how busy the photo is
          (b) brand color set + no cover → solid gradient hero in
              the owner's accent so the page still has a strong
              visual identity even without a photo
          (c) nothing set → subtle dark hero with the letter avatar
              so the page never looks broken / empty
        All three render the SAME meta-pill row below the name
        (cuisine · city · open status · tagline) so the layout is
        consistent across owners with different branding depth.
      */}
      {(() => {
        const heroAccent = resolveAccent(brandColor);
        const heroBackground = coverImageUrl
          ? `${heroGradient(brandColor)}, url(${coverImageUrl}) center/cover`
          : `linear-gradient(135deg, ${heroAccent} 0%, ${heroAccent}88 50%, rgba(0,0,0,0.6) 100%)`;
        const pillStyle: React.CSSProperties = {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '4px 10px',
          background: 'rgba(255,255,255,0.16)',
          borderRadius: 999,
          fontSize: 12,
          color: '#fff',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          fontWeight: 500,
        };
        return (
          <header
            style={{
              position: 'relative',
              width: '100%',
              // Fluid height that stops growing on big screens. Mobile
              // gets ~220px, tablet ~260px, desktop caps at 340px so
              // the hero never eats half the viewport on a 1080p+
              // monitor. Removed the aspect-ratio that was causing
              // the 640px hero on widescreen displays.
              height: 'clamp(200px, 22vw, 340px)',
              backgroundImage: heroBackground,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              color: '#fff',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                padding: 'clamp(20px, 4vw, 36px) clamp(16px, 4vw, 36px)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                gap: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
                {brandLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={brandLogoUrl}
                    alt={businessName}
                    style={{
                      width: 'clamp(56px, 9vw, 78px)',
                      height: 'clamp(56px, 9vw, 78px)',
                      borderRadius: 14,
                      objectFit: 'cover',
                      background: '#fff',
                      border: '3px solid rgba(255,255,255,0.95)',
                      boxShadow: '0 8px 24px rgba(0,0,0,.35)',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 'clamp(56px, 9vw, 78px)',
                      height: 'clamp(56px, 9vw, 78px)',
                      borderRadius: 14,
                      background: '#fff',
                      color: heroAccent,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 'clamp(26px, 5vw, 36px)',
                      flexShrink: 0,
                      boxShadow: '0 8px 24px rgba(0,0,0,.35)',
                    }}
                  >
                    {businessName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div style={{ minWidth: 0, flex: 1, textShadow: '0 2px 8px rgba(0,0,0,.5)' }}>
                  <h1
                    style={{
                      // Mix sans for compactness on mobile + a touch of
                      // serif personality on desktop via fluid sizing.
                      fontFamily:
                        "'Playfair Display', Georgia, 'Times New Roman', serif",
                      fontSize: 'clamp(26px, 4vw, 40px)',
                      margin: 0,
                      fontWeight: 700,
                      letterSpacing: '-0.015em',
                      lineHeight: 1.1,
                    }}
                  >
                    {businessName}
                  </h1>
                  {tagline && (
                    <p
                      style={{
                        fontSize: 'clamp(13px, 1.4vw, 15px)',
                        margin: '6px 0 0',
                        opacity: 0.95,
                        fontWeight: 400,
                        maxWidth: 540,
                      }}
                    >
                      {tagline}
                    </p>
                  )}
                </div>
              </div>
              {/* Meta pill row — cuisine, city, status, hours. Each
                  pill renders only if its source value is present. */}
              {(cuisineType || city || workingHours || deliveryAvailable) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {cuisineType && <span style={pillStyle}>🍽️ {cuisineType}</span>}
                  {city && <span style={pillStyle}>📍 {city}</span>}
                  {workingHours && (
                    <span style={pillStyle}>
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 999,
                          background: '#22C55E',
                          boxShadow: '0 0 0 3px rgba(34,197,94,.25)',
                        }}
                      />
                      Open · {workingHours}
                    </span>
                  )}
                  {deliveryAvailable && <span style={pillStyle}>🛵 Delivery available</span>}
                </div>
              )}
            </div>
          </header>
        );
      })()}

      <main
        style={{
          // Phase 2: full dark migration. Removed the text-colour
          // override from Phase 1 — items, cards, inputs all now sit
          // on the dark page surface with cream text inherited from
          // the theme wrapper. Cards use --zt-surface (slightly lifted
          // from the page bg) so they read as separated panels rather
          // than blending into the background.
          padding: 'clamp(16px, 3vw, 28px) clamp(14px, 3vw, 28px)',
          maxWidth: 720,
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {prefillCount > 0 && (
          <div
            style={{
              margin: '8px 0 6px',
              padding: '8px 12px',
              background: '#e8f5ff',
              border: '1px solid #b6dffd',
              borderRadius: 10,
              fontSize: 12.5,
              color: '#0a4a78',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
            role="status"
          >
            <span>🎯</span>
            <div style={{ flex: 1, lineHeight: 1.4 }}>
              We added <b>{prefillCount}</b> item{prefillCount === 1 ? '' : 's'} from your message — review the cart, adjust quantities, then tap <b>Place order</b>.
              <br />
              <span style={{ fontSize: 11, color: '#3c7eb1' }}>
                Aapke message se {prefillCount} item{prefillCount === 1 ? '' : 's'} add kar diye — check karke order place karein.
              </span>
            </div>
            <button
              type="button"
              onClick={() => { setCart({}); setPrefillCount(0); }}
              style={{ fontSize: 11, padding: '4px 8px', borderRadius: 99, border: '1px solid #b6dffd', background: '#fff', color: '#0a4a78', cursor: 'pointer' }}
            >
              Clear
            </button>
          </div>
        )}

        {/*
          Pricing transparency banner. Required by CCPA Dark Patterns
          Guidelines 2023 — "drip pricing" (revealing charges only at
          checkout) is one of the 13 banned dark patterns. Everything
          the owner has configured that COULD affect the final total is
          surfaced here, before the customer adds their first item.

          We render the banner only when at least one surcharge / fee /
          minimum is configured. A restaurant with zero surcharges shows
          no banner — pure menu prices == final.
        */}
        {pricing && (() => {
          const surgeBits: string[] = [];
          if (pricing.rainSurchargePercent && pricing.rainSurchargePercent > 0)
            surgeBits.push(`🌧️ Rain +${pricing.rainSurchargePercent}%`);
          if (pricing.peakHourSurchargePercent && pricing.peakHourSurchargePercent > 0)
            surgeBits.push(`⏰ Peak hour +${pricing.peakHourSurchargePercent}%`);
          if (pricing.festivalSurchargePercent && pricing.festivalSurchargePercent > 0)
            surgeBits.push(`🎉 Festival +${pricing.festivalSurchargePercent}%`);

          const feeBits: string[] = [];
          if (pricing.deliveryCharges) feeBits.push(`Delivery ${pricing.deliveryCharges}`);
          if (pricing.packagingChargesPerOrder) feeBits.push(`Packaging ${pricing.packagingChargesPerOrder}/order`);
          if (pricing.packagingChargesPerItem) feeBits.push(`Packaging ${pricing.packagingChargesPerItem}/item`);
          if (pricing.minimumOrder) feeBits.push(`Min order ${pricing.minimumOrder}`);
          if (pricing.deliveryRadius) feeBits.push(`Delivery radius ${pricing.deliveryRadius}`);

          if (surgeBits.length === 0 && feeBits.length === 0) return null;

          return (
            <section
              style={{
                margin: '8px 0 6px',
                padding: '10px 12px',
                background: '#fffaf2',
                border: '1px solid #ffe4bf',
                borderRadius: 10,
                fontSize: 12.5,
                lineHeight: 1.5,
                color: '#5a3a00',
              }}
              aria-label="Pricing transparency"
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                Pricing transparency / Price ki saari details
              </div>
              {feeBits.length > 0 && (
                <div style={{ marginBottom: surgeBits.length > 0 ? 4 : 0 }}>
                  {feeBits.join(' · ')}
                </div>
              )}
              {surgeBits.length > 0 && (
                <div>
                  Possible surcharges (only when conditions apply, itemised before you confirm):
                  <br />
                  {surgeBits.join(' · ')}
                </div>
              )}
              <div style={{ marginTop: 6, fontSize: 11, color: '#8a6a2a' }}>
                Final breakdown shown on the order summary screen — no hidden charges.
              </div>
            </section>
          );
        })()}

        {/* Search + filter bar. Sticky beneath the hero so it stays
            within thumb reach while scrolling a long menu. */}
        {items.length > 0 && (
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 4,
              margin: '0 -16px 14px',
              padding: '12px 16px 10px',
              background: 'var(--zt-bg)',
              borderBottom: '1px solid var(--zt-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: 14,
                  pointerEvents: 'none',
                  color: 'var(--zt-text-muted)',
                  fontSize: 14,
                }}
                aria-hidden
              >
                🔍
              </span>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dishes…"
                aria-label="Search the menu"
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 38px',
                  background: 'var(--zt-surface)',
                  border: '1px solid var(--zt-border)',
                  borderRadius: 12,
                  color: 'var(--zt-text)',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  style={{
                    position: 'absolute',
                    right: 10,
                    background: 'var(--zt-surface-alt)',
                    border: 'none',
                    color: 'var(--zt-text-muted)',
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    cursor: 'pointer',
                    fontSize: 13,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <FilterChip
                active={vegOnly}
                onClick={() => setVegOnly(!vegOnly)}
                accent="#22C55E"
              >
                🟢 Veg only
              </FilterChip>
              <FilterChip
                active={bestsellersOnly}
                onClick={() => setBestsellersOnly(!bestsellersOnly)}
                accent={accent}
              >
                ⭐ Bestsellers
              </FilterChip>
              {(vegOnly || bestsellersOnly || searchQuery) && (
                <button
                  type="button"
                  onClick={() => { setVegOnly(false); setBestsellersOnly(false); setSearchQuery(''); }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 999,
                    background: 'transparent',
                    border: '1px solid var(--zt-border)',
                    color: 'var(--zt-text-muted)',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* Category jump-nav — horizontal scroll on every viewport.
            Categories from the un-filtered list so the nav layout doesn't
            jump around when filters narrow the menu. Tapping a chip jumps
            to that section via in-page anchor. */}
        {allCategories.length > 1 && (
          <nav
            aria-label="Jump to category"
            style={{
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              padding: '4px 0 10px',
              margin: '0 -16px 6px',
              paddingLeft: 16,
              paddingRight: 16,
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
            }}
          >
            {allCategories.map((cat) => {
              const slug = catSlug(cat);
              const stillShown = grouped.some(([c]) => c === cat);
              return (
                <a
                  key={cat}
                  href={`#cat-${slug}`}
                  aria-disabled={!stillShown}
                  style={{
                    flexShrink: 0,
                    padding: '7px 14px',
                    borderRadius: 999,
                    background: 'var(--zt-surface)',
                    border: '1px solid var(--zt-border)',
                    color: stillShown ? 'var(--zt-text)' : 'var(--zt-text-dim)',
                    fontSize: 13,
                    fontWeight: 500,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    opacity: stillShown ? 1 : 0.45,
                    pointerEvents: stillShown ? 'auto' : 'none',
                    scrollSnapAlign: 'start',
                  }}
                >
                  {cat}
                </a>
              );
            })}
          </nav>
        )}

        {grouped.length === 0 ? (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              background: 'var(--zt-surface)',
              border: '1px dashed var(--zt-border)',
              borderRadius: 14,
              color: 'var(--zt-text-muted)',
            }}
          >
            {items.length === 0 ? (
              <>
                <p style={{ margin: 0, fontSize: 14 }}>
                  Menu loading… If this stays empty, the restaurant hasn&apos;t configured items yet.
                </p>
                <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--zt-text-dim)' }}>
                  Menu load ho raha hai… Agar khaali rahe, restaurant ne abhi items add nahi kiye.
                </p>
              </>
            ) : (
              <>
                <p style={{ margin: 0, fontSize: 15, color: 'var(--zt-text)' }}>No matching dishes</p>
                <p style={{ margin: '6px 0 12px', fontSize: 13 }}>
                  Try a different search term or remove filters.
                </p>
                <button
                  type="button"
                  onClick={() => { setVegOnly(false); setBestsellersOnly(false); setSearchQuery(''); }}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 999,
                    background: accent,
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        ) : (
          grouped.map(([cat, list]) => (
            <section
              key={cat}
              id={`cat-${catSlug(cat)}`}
              style={{ margin: '18px 0', scrollMarginTop: 80 }}
            >
              <h2
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                  color: 'var(--zt-text)',
                  margin: '8px 0 12px',
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 10,
                }}
              >
                {cat}
                <span
                  style={{
                    fontFamily: 'inherit',
                    fontSize: 12,
                    fontWeight: 400,
                    color: 'var(--zt-text-dim)',
                    letterSpacing: 0,
                  }}
                >
                  {list.length} item{list.length === 1 ? '' : 's'}
                </span>
              </h2>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {list.map((it) => {
                  const hasVariants = it.sizes.length > 0;
                  const singleQty = hasVariants ? 0 : cart[it.id] || 0;
                  const variantQtys = hasVariants
                    ? it.sizes.map((s) => ({ size: s, qty: cart[`${it.id}|${s.label}`] || 0 }))
                    : [];
                  const totalQty = hasVariants ? variantQtys.reduce((n, v) => n + v.qty, 0) : singleQty;
                  const inCart = totalQty > 0;
                  return (
                    <li
                      key={it.id}
                      style={{
                        padding: 14,
                        borderRadius: 14,
                        background: 'var(--zt-surface)',
                        border: `1px solid ${inCart ? accent + '55' : 'var(--zt-border)'}`,
                        boxShadow: inCart ? `0 0 0 1px ${accent}55` : 'none',
                        transition: 'border-color .15s, box-shadow .15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                            <span
                              style={{
                                width: 12,
                                height: 12,
                                border: `2px solid ${it.isVeg ? '#22C55E' : '#F87171'}`,
                                borderRadius: 3,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                              title={it.isVeg ? 'Veg' : 'Non-veg'}
                            >
                              <span
                                style={{
                                  width: 5,
                                  height: 5,
                                  borderRadius: 99,
                                  background: it.isVeg ? '#22C55E' : '#F87171',
                                }}
                              />
                            </span>
                            <span style={{ fontWeight: 600, color: 'var(--zt-text)', fontSize: 15 }}>{it.name}</span>
                            {it.isBestseller && (
                              <span
                                style={{
                                  fontSize: 10,
                                  padding: '2px 8px',
                                  borderRadius: 99,
                                  background: accent + '22',
                                  color: accent,
                                  fontWeight: 700,
                                  letterSpacing: '.05em',
                                  border: `1px solid ${accent}44`,
                                }}
                              >
                                ⭐ BESTSELLER
                              </span>
                            )}
                            {inCart && (
                              <span
                                style={{
                                  fontSize: 10,
                                  padding: '2px 8px',
                                  borderRadius: 99,
                                  background: accent,
                                  color: '#fff',
                                  fontWeight: 700,
                                }}
                              >
                                {totalQty} in cart
                              </span>
                            )}
                          </div>
                          {it.description && (
                            <p style={{ fontSize: 13, color: 'var(--zt-text-muted)', margin: '0 0 6px', lineHeight: 1.45 }}>
                              {it.description}
                            </p>
                          )}
                          {it.allergens.length > 0 && (
                            <div
                              style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}
                              aria-label="Contains allergens"
                            >
                              {it.allergens.map((a) => (
                                <span
                                  key={a}
                                  style={{
                                    fontSize: 10,
                                    padding: '2px 7px',
                                    borderRadius: 99,
                                    background: 'rgba(251,191,36,.12)',
                                    color: '#FBBF24',
                                    border: '1px solid rgba(251,191,36,.25)',
                                    fontWeight: 500,
                                  }}
                                  title="Contains allergen"
                                >
                                  ⚠ {ALLERGEN_LABEL[a] || a}
                                </span>
                              ))}
                            </div>
                          )}
                          {!hasVariants && (
                            <p
                              style={{
                                fontSize: 15,
                                fontWeight: 700,
                                margin: '8px 0 0',
                                color: 'var(--zt-text)',
                              }}
                            >
                              {it.price || '—'}
                            </p>
                          )}
                        </div>
                        {!hasVariants && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            {singleQty === 0 ? (
                              <button
                                onClick={() => bump(it.id, 1)}
                                style={{
                                  padding: '8px 18px',
                                  borderRadius: 999,
                                  border: `1.5px solid ${accent}`,
                                  background: 'transparent',
                                  color: accent,
                                  fontWeight: 700,
                                  fontSize: 13,
                                  cursor: 'pointer',
                                  letterSpacing: '.02em',
                                }}
                              >
                                ADD
                              </button>
                            ) : (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '4px',
                                  borderRadius: 999,
                                  background: accent,
                                  color: '#fff',
                                }}
                              >
                                <button
                                  onClick={() => bump(it.id, -1)}
                                  aria-label="Decrease"
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#fff',
                                    fontSize: 18,
                                    lineHeight: 1,
                                    cursor: 'pointer',
                                    width: 26,
                                    height: 26,
                                    borderRadius: 999,
                                  }}
                                >
                                  −
                                </button>
                                <span style={{ minWidth: 18, textAlign: 'center', fontWeight: 700, fontSize: 14 }}>
                                  {singleQty}
                                </span>
                                <button
                                  onClick={() => bump(it.id, 1)}
                                  aria-label="Increase"
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#fff',
                                    fontSize: 18,
                                    lineHeight: 1,
                                    cursor: 'pointer',
                                    width: 26,
                                    height: 26,
                                    borderRadius: 999,
                                  }}
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {hasVariants && (
                        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {variantQtys.map(({ size, qty }) => {
                            const key = `${it.id}|${size.label}`;
                            return (
                              <div
                                key={key}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 8,
                                  padding: '8px 12px',
                                  borderRadius: 10,
                                  background: 'var(--zt-surface-alt)',
                                  border: '1px solid var(--zt-border)',
                                }}
                              >
                                <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <span style={{ fontWeight: 600, color: 'var(--zt-text)' }}>{size.label}</span>
                                  <span style={{ color: 'var(--zt-text-muted)', fontWeight: 500 }}>₹{size.price}</span>
                                </div>
                                {qty === 0 ? (
                                  <button
                                    onClick={() => bump(key, 1)}
                                    style={{
                                      padding: '5px 14px',
                                      borderRadius: 999,
                                      border: `1.5px solid ${accent}`,
                                      background: 'transparent',
                                      color: accent,
                                      fontWeight: 700,
                                      fontSize: 12,
                                      cursor: 'pointer',
                                      letterSpacing: '.02em',
                                    }}
                                  >
                                    ADD
                                  </button>
                                ) : (
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      padding: 3,
                                      borderRadius: 999,
                                      background: accent,
                                      color: '#fff',
                                    }}
                                  >
                                    <button
                                      onClick={() => bump(key, -1)}
                                      aria-label="Decrease"
                                      style={{ background: 'none', border: 'none', color: '#fff', fontSize: 16, lineHeight: 1, cursor: 'pointer', width: 22, height: 22, borderRadius: 999 }}
                                    >
                                      −
                                    </button>
                                    <span style={{ minWidth: 14, textAlign: 'center', fontWeight: 700, fontSize: 13 }}>
                                      {qty}
                                    </span>
                                    <button
                                      onClick={() => bump(key, 1)}
                                      aria-label="Increase"
                                      style={{ background: 'none', border: 'none', color: '#fff', fontSize: 16, lineHeight: 1, cursor: 'pointer', width: 22, height: 22, borderRadius: 999 }}
                                    >
                                      +
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}

        {cartLines.length > 0 && (
          <section style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, color: '#999', margin: '12px 0 6px' }}>How would you like it? / Kaise chahiye?</h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {(['delivery', 'takeaway', 'dine_in'] as const).map((m) => {
                if (m === 'delivery' && !deliveryAvailable) return null;
                if (m === 'takeaway' && !takeawayEnabled) return null;
                if (m === 'dine_in' && !dineInEnabled) return null;
                const on = mode === m;
                const label = m === 'delivery' ? '🛵 Delivery' : m === 'takeaway' ? '🧋 Takeaway' : '🍽️ Dine-in';
                return (
                  <button key={m} onClick={() => setMode(m)}
                    style={{
                      flex: 1, minWidth: 100,
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: `2px solid ${on ? accent : '#ddd'}`,
                      background: on ? accent : '#fff',
                      color: on ? '#fff' : '#222',
                      fontWeight: 600,
                      fontSize: 13,
                    }}>{label}</button>
                );
              })}
            </div>

            <div style={{ background: '#fafafa', borderRadius: 12, padding: 12 }}>
              <input
                type="text"
                placeholder="Your name / Aapka naam"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                style={inputStyle}
              />
              <input
                type="tel"
                placeholder="WhatsApp number (with country code) / +91…"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                style={inputStyle}
              />
              {mode === 'delivery' && (
                <>
                  <textarea
                    placeholder="Delivery address with landmark / Address with landmark"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    rows={2}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                  {/*
                    Phase 3L — Location pin UX. Three paths in priority order:
                      1. Bot forwarded WhatsApp location share (URL ?lat=&lng=)
                         → already loaded into customerLat/Lng on mount, shows
                         "Location received from WhatsApp ✓".
                      2. "Use my current location" — navigator.geolocation
                         live GPS prompt. Works on any modern mobile browser.
                      3. "Pick on Google Maps" — fallback for customers who
                         don't want to share GPS or are using a stale link.
                         Opens Google Maps in a new tab; user copies the URL,
                         pastes back into a manual lat/lng field (planned for
                         a follow-up commit when we install mapcn).
                    Empty state shows zero location. Submit endpoint still
                    accepts the order — it just falls back to "manual route"
                    for multi-outlet kitchens (admin can re-route).
                  */}
                  <div
                    style={{
                      background: '#fff',
                      border: '1px solid #ddd',
                      borderRadius: 8,
                      padding: 10,
                      marginBottom: 8,
                      fontSize: 12.5,
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      📍 Your delivery location
                    </div>
                    {/*
                      Phase 3L v2 — embedded MapLibre map. Drag pin or
                      tap-to-set updates customerLat/Lng directly, which
                      flows back into the map via the prop-driven flyTo
                      effect inside MapPicker. Outlet markers + zone
                      circles render in the same canvas so the customer
                      sees who serves their area.
                    */}
                    <div style={{ marginBottom: 8 }}>
                      <MapPicker
                        lat={customerLat}
                        lng={customerLng}
                        onChange={(la, ln) => { setCustomerLat(la); setCustomerLng(ln); }}
                        outlets={outletMarkers}
                        heightPx={220}
                      />
                    </div>
                    {customerLat !== null && customerLng !== null ? (
                      // Never render the raw lat/lng in the customer UI —
                      // a screenshot or shared screen could leak the
                      // exact home coordinates. Coordinates still flow
                      // server-side in the submit body for outlet routing
                      // + delivery_lat/lng order column; that channel is
                      // authenticated, this surface is not.
                      <div style={{ color: '#1a5e1a', marginBottom: 6 }}>
                        ✓ Location set — kitchen will use this for delivery routing
                      </div>
                    ) : (
                      <div style={{ color: '#666', marginBottom: 6 }}>
                        Drag the pin on the map or use the buttons below.
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof navigator === 'undefined' || !navigator.geolocation) {
                            setGpsError('Your browser does not support location sharing.');
                            return;
                          }
                          setGpsPending(true);
                          setGpsError(null);
                          navigator.geolocation.getCurrentPosition(
                            (pos) => {
                              setCustomerLat(pos.coords.latitude);
                              setCustomerLng(pos.coords.longitude);
                              setGpsPending(false);
                            },
                            (err) => {
                              setGpsPending(false);
                              setGpsError(
                                err.code === err.PERMISSION_DENIED
                                  ? 'Permission denied. Enable location in browser settings.'
                                  : 'Could not get your location. Try the map button instead.'
                              );
                            },
                            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                          );
                        }}
                        disabled={gpsPending}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 99,
                          border: '1px solid #111',
                          background: '#fff',
                          fontWeight: 600,
                          fontSize: 12,
                          cursor: gpsPending ? 'wait' : 'pointer',
                        }}
                      >
                        {gpsPending ? 'Getting GPS…' : '📡 Use my current location'}
                      </button>
                      {/*
                        Privacy: the previous Google Maps fallback link
                        exposed lat/lng in its href, which could leak via
                        screenshots / browser-history caches. Removed —
                        the embedded MapPicker + GPS button now cover
                        both paths, and the manual address textarea
                        above handles the no-location case.
                      */}
                      {(customerLat !== null || customerLng !== null) && (
                        <button
                          type="button"
                          onClick={() => { setCustomerLat(null); setCustomerLng(null); setGpsError(null); }}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 99,
                            border: 'none',
                            background: 'transparent',
                            color: '#888',
                            fontSize: 11,
                            cursor: 'pointer',
                          }}
                        >
                          Clear pin
                        </button>
                      )}
                    </div>
                    {gpsError && (
                      <div style={{ color: '#900', fontSize: 11, marginTop: 6 }}>
                        {gpsError}
                      </div>
                    )}
                  </div>
                </>
              )}
              {mode === 'dine_in' && (
                <input
                  type="text"
                  placeholder="Table number / Table number"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  style={inputStyle}
                />
              )}
              <input
                type="text"
                placeholder="Special notes (less spicy, no onion…) / Special notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ ...inputStyle, marginBottom: 8 }}
              />
              {/*
                DPDPA §6 explicit marketing opt-in. Always off by default
                (pre-ticked = invalid consent). Storing the granted
                permission is the kitchen's ticket to ever send a
                Marketing template to this customer later.
              */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  fontSize: 12,
                  color: '#444',
                  cursor: 'pointer',
                  padding: '6px 4px',
                  lineHeight: 1.4,
                }}
              >
                <input
                  type="checkbox"
                  checked={marketingOptIn}
                  onChange={(e) => setMarketingOptIn(e.target.checked)}
                  style={{ marginTop: 2, flexShrink: 0 }}
                />
                <span>
                  I&apos;d like updates from <b>{businessName}</b> about offers, festive menus, and weekly specials on WhatsApp.
                  <br />
                  <span style={{ fontSize: 11, color: '#888' }}>
                    Optional. You can reply STOP anytime to unsubscribe. Order confirmations are sent regardless.
                  </span>
                </span>
              </label>
            </div>
          </section>
        )}

        {error && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: '#fee', color: '#900', fontSize: 13 }}>{error}</div>
        )}

        {/*
          FSSAI / GST / certification disclosure footer.

          Mandatory per FSSAI Reg 2.4.6 (Aug 2020 gazette) — the FBO's
          licence number must appear on every menu surface customers
          see. Allergen disclosure + veg/non-veg symbols are rendered
          per-item above; this footer covers the licence + certifications
          + shared-kitchen safety note.

          Shared-kitchen disclaimer is shown whenever a kitchen advertises
          pure-veg AND has `sharedKitchenWithNonVeg = true` — required by
          FSSAI Adv & Claims Regs 2018 Reg 3 ("claims must be truthful,
          unambiguous, meaningful, not misleading"). Never advertise
          "100% pure" wording — that's the line FSSAI 2025 guidance
          specifically called out.
        */}
        {compliance && (
          <section
            style={{
              marginTop: 32,
              padding: '14px 14px 18px',
              borderTop: '1px solid #eee',
              fontSize: 11.5,
              color: '#666',
              lineHeight: 1.5,
            }}
            aria-label="Regulatory disclosures"
          >
            {(compliance.pureVeg && compliance.sharedKitchenWithNonVeg) && (
              <div
                style={{
                  background: '#fff8e1',
                  border: '1px solid #ffe082',
                  borderRadius: 8,
                  padding: '8px 10px',
                  color: '#7a5b00',
                  marginBottom: 10,
                }}
              >
                <b>Shared kitchen disclosure:</b> our vegetarian dishes are prepared
                in a kitchen that also handles non-vegetarian items. If strict
                veg-only is required, please call before ordering.
              </div>
            )}

            {compliance.jainCertified && (
              <div style={{ marginBottom: 8 }}>
                <span style={{ display: 'inline-block', marginRight: 10, padding: '2px 8px', background: '#fff3e0', color: '#7a4f00', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
                  JAIN-CERTIFIED MENU
                </span>
              </div>
            )}

            <div>
              {compliance.fssaiLicenseNumber ? (
                <>
                  FSSAI Lic. No. <b>{compliance.fssaiLicenseNumber}</b>
                  {compliance.fssaiExpiryDate ? ` · valid till ${compliance.fssaiExpiryDate}` : ''}
                </>
              ) : (
                <>FSSAI licence pending — confirm with kitchen.</>
              )}
              {compliance.gstin ? <> · GSTIN <b>{compliance.gstin}</b></> : null}
            </div>

            <div style={{ marginTop: 6, fontSize: 10.5, color: '#888' }}>
              {compliance.calorieDisclosureRequired
                ? 'Calorie information per serving is available on request — central licence / 10+ outlets.'
                : 'Allergen information available on request. Veg/non-veg indicated per item above.'}
            </div>
          </section>
        )}
      </main>

      {cartLines.length > 0 && (
        <footer
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '14px clamp(16px, 4vw, 24px)',
            background: 'var(--zt-surface)',
            borderTop: '1px solid var(--zt-border)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            color: 'var(--zt-text)',
            boxShadow: '0 -8px 24px rgba(0,0,0,.45)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            zIndex: 10,
          }}
        >
          <div
            style={{
              flex: 1,
              maxWidth: LAYOUT.contentMaxWidth,
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              width: '100%',
            }}
          >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--zt-text-muted)', letterSpacing: '.02em' }}>
              {cartLines.reduce((s, l) => s + l.qty, 0)} item{cartLines.reduce((s, l) => s + l.qty, 0) === 1 ? '' : 's'}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--zt-text)' }}>₹{total.toFixed(0)}</div>
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: '14px 26px',
              borderRadius: 99,
              background: submitting ? 'var(--zt-text-dim)' : accent,
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              fontSize: 15,
              cursor: submitting ? 'not-allowed' : 'pointer',
              boxShadow: submitting ? 'none' : `0 4px 16px ${accent}55`,
              transition: 'transform .12s ease',
            }}
          >
            {submitting ? 'Sending…' : 'Place order'}
          </button>
          </div>
        </footer>
      )}
      </div>
    </div>
  );
}
