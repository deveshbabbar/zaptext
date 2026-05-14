'use client';

// Mobile-first menu + cart for restaurant customers reaching the public
// menu via a bot-shared link (no QR scan / no table). Three order modes:
// Delivery (asks for address), Takeaway (asks for pickup name), Dine-in
// (asks for table number). On submit hits /api/menu/submit which writes
// to dine_in_orders and sends a WhatsApp confirmation back to the
// customer's phone.

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

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
  halalCertified?: boolean;
  halalCertNumber?: string;
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
  tagline?: string;
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

export function MenuPublicClient({
  businessName,
  clientId,
  items,
  brandLogoUrl,
  brandColor,
  tagline,
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

  const grouped = useMemo(() => {
    const map = new Map<string, FlatItem[]>();
    for (const it of items) {
      const list = map.get(it.category) || [];
      list.push(it);
      map.set(it.category, list);
    }
    return [...map.entries()];
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

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', paddingBottom: cartLines.length > 0 ? 140 : 32, maxWidth: 540, margin: '0 auto' }}>
      <header style={{ padding: '20px 16px 12px', borderBottom: '1px solid #eee', position: 'sticky', top: 0, background: '#fff', zIndex: 5, display: 'flex', alignItems: 'center', gap: 12 }}>
        {brandLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brandLogoUrl} alt={businessName} style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 44, height: 44, borderRadius: 10, background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, flexShrink: 0 }}>
            {businessName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ fontSize: 19, margin: 0, fontWeight: 700, letterSpacing: '-0.01em' }}>{businessName}</h1>
          <p style={{ fontSize: 12.5, color: '#666', margin: '2px 0 0' }}>
            {tagline || 'Tap items to add / Items tap karke add kariye'}
          </p>
        </div>
      </header>

      <main style={{ padding: '8px 12px' }}>
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

        {grouped.length === 0 ? (
          <p style={{ color: '#888', padding: 16 }}>
            Menu loading… If this stays empty, the restaurant hasn&apos;t configured items yet.
            <br /><br />
            Menu load ho raha hai… Agar khaali rahe, restaurant ne abhi items add nahi kiye.
          </p>
        ) : (
          grouped.map(([cat, list]) => (
            <section key={cat} style={{ margin: '12px 0' }}>
              <h2 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, color: '#999', margin: '12px 0 6px' }}>{cat}</h2>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {list.map((it) => {
                  const hasVariants = it.sizes.length > 0;
                  const singleQty = hasVariants ? 0 : cart[it.id] || 0;
                  const variantQtys = hasVariants
                    ? it.sizes.map((s) => ({ size: s, qty: cart[`${it.id}|${s.label}`] || 0 }))
                    : [];
                  const totalQty = hasVariants ? variantQtys.reduce((n, v) => n + v.qty, 0) : singleQty;
                  return (
                    <li key={it.id} style={{ padding: '10px 0', borderBottom: '1px solid #f3f3f3' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ width: 10, height: 10, border: `2px solid ${it.isVeg ? '#1a9b3a' : '#c0392b'}`, borderRadius: 2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ width: 4, height: 4, borderRadius: 99, background: it.isVeg ? '#1a9b3a' : '#c0392b' }} />
                            </span>
                            <span style={{ fontWeight: 600 }}>{it.name}</span>
                            {it.isBestseller && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 99, background: '#fff4d6', color: '#8a6d00' }}>BESTSELLER</span>}
                            {totalQty > 0 && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 99, background: '#111', color: '#fff' }}>{totalQty} in cart</span>}
                          </div>
                          {it.description && <p style={{ fontSize: 12, color: '#666', margin: '2px 0 0' }}>{it.description}</p>}
                          {it.allergens.length > 0 && (
                            <div
                              style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}
                              aria-label="Contains allergens"
                            >
                              {it.allergens.map((a) => (
                                <span
                                  key={a}
                                  style={{
                                    fontSize: 10,
                                    padding: '1px 6px',
                                    borderRadius: 99,
                                    background: '#fff4e5',
                                    color: '#a05a00',
                                    fontWeight: 500,
                                  }}
                                  title="Contains allergen"
                                >
                                  ⚠ {ALLERGEN_LABEL[a] || a}
                                </span>
                              ))}
                            </div>
                          )}
                          {!hasVariants && <p style={{ fontSize: 13, fontWeight: 500, margin: '4px 0 0' }}>{it.price || '—'}</p>}
                        </div>
                        {!hasVariants && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {singleQty === 0 ? (
                              <button onClick={() => bump(it.id, 1)} style={{ padding: '6px 14px', borderRadius: 99, border: '1px solid #111', background: '#fff', fontWeight: 600 }}>Add</button>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 99, background: '#111', color: '#fff' }}>
                                <button onClick={() => bump(it.id, -1)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 18, lineHeight: 1, cursor: 'pointer' }}>−</button>
                                <span style={{ minWidth: 16, textAlign: 'center', fontWeight: 600 }}>{singleQty}</span>
                                <button onClick={() => bump(it.id, 1)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 18, lineHeight: 1, cursor: 'pointer' }}>+</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {hasVariants && (
                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {variantQtys.map(({ size, qty }) => {
                            const key = `${it.id}|${size.label}`;
                            return (
                              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '4px 8px', borderRadius: 8, background: '#f7f7f7' }}>
                                <div style={{ fontSize: 13 }}>
                                  <span style={{ fontWeight: 500 }}>{size.label}</span>
                                  <span style={{ marginLeft: 8, color: '#444' }}>₹{size.price}</span>
                                </div>
                                {qty === 0 ? (
                                  <button onClick={() => bump(key, 1)} style={{ padding: '4px 12px', borderRadius: 99, border: '1px solid #111', background: '#fff', fontWeight: 600, fontSize: 12 }}>Add</button>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 6px', borderRadius: 99, background: '#111', color: '#fff' }}>
                                    <button onClick={() => bump(key, -1)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 16, lineHeight: 1, cursor: 'pointer' }}>−</button>
                                    <span style={{ minWidth: 14, textAlign: 'center', fontWeight: 600, fontSize: 13 }}>{qty}</span>
                                    <button onClick={() => bump(key, 1)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 16, lineHeight: 1, cursor: 'pointer' }}>+</button>
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

            {(compliance.halalCertified || compliance.jainCertified) && (
              <div style={{ marginBottom: 8 }}>
                {compliance.halalCertified && (
                  <span style={{ display: 'inline-block', marginRight: 10, padding: '2px 8px', background: '#e8f5e9', color: '#1b5e20', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
                    HALAL CERTIFIED{compliance.halalCertNumber ? ` · ${compliance.halalCertNumber}` : ''}
                  </span>
                )}
                {compliance.jainCertified && (
                  <span style={{ display: 'inline-block', marginRight: 10, padding: '2px 8px', background: '#fff3e0', color: '#7a4f00', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
                    JAIN-CERTIFIED MENU
                  </span>
                )}
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
        <footer style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: 12, background: '#fff', borderTop: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 12, maxWidth: 540, margin: '0 auto' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#666' }}>{cartLines.reduce((s, l) => s + l.qty, 0)} item{cartLines.reduce((s, l) => s + l.qty, 0) === 1 ? '' : 's'}</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>₹{total.toFixed(0)}</div>
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ padding: '12px 22px', borderRadius: 99, background: submitting ? '#888' : accent, color: '#fff', border: 'none', fontWeight: 700, fontSize: 15 }}
          >
            {submitting ? 'Sending…' : 'Place order / Order place'}
          </button>
        </footer>
      )}
    </div>
  );
}
