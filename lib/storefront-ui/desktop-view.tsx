'use client';

// Desktop-only storefront view — ports `desktop-app.jsx` from the
// design-system files the owner installed at the repo root. Wired to
// real props instead of `window.RESTAURANT` / `window.MENU`. Submit
// flow hits the existing `/api/menu/submit` endpoint.

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  AddButton,
  BestsellerChip,
  Hairline,
  I,
  PhotoSlot,
  VegDot,
  storefrontThemeStyle,
} from './atoms';

// ─── Types ──────────────────────────────────────────────────────────

export interface FlatItem {
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

type OrderMode = 'delivery' | 'takeaway' | 'dine_in';

export interface DesktopViewProps {
  clientId: string;
  businessName: string;
  tagline?: string;
  brandColor?: string;
  brandLogoUrl?: string;
  city?: string;
  cuisineType?: string;
  workingHours?: string;
  phone?: string;
  address?: string;
  deliveryRadius?: string;
  minimumOrder?: string;
  fssaiLicenseNumber?: string;
  gstin?: string;
  deliveryAvailable: boolean;
  takeawayEnabled: boolean;
  dineInEnabled: boolean;
  items: FlatItem[];
  prefillPhone?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────

function parsePriceNumber(raw: string): number {
  const m = (raw || '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

function catSlug(cat: string): string {
  return cat.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'cat';
}

function splitKey(key: string): { itemId: string; variant: string | null } {
  const idx = key.indexOf('|');
  return idx === -1
    ? { itemId: key, variant: null }
    : { itemId: key.slice(0, idx), variant: key.slice(idx + 1) };
}

// ─── Main view ──────────────────────────────────────────────────────

export function DesktopView(props: DesktopViewProps) {
  const {
    clientId, businessName, tagline, brandColor, brandLogoUrl,
    city, cuisineType, workingHours, phone, address, deliveryRadius, minimumOrder,
    fssaiLicenseNumber, gstin,
    deliveryAvailable, takeawayEnabled, dineInEnabled,
    items, prefillPhone,
  } = props;

  const initialMode: OrderMode = deliveryAvailable ? 'delivery'
    : takeawayEnabled ? 'takeaway'
    : dineInEnabled ? 'dine_in'
    : 'delivery';

  const [query, setQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [nonvegOnly, setNonvegOnly] = useState(false);
  const [bestOnly, setBestOnly] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [orderType, setOrderType] = useState<OrderMode>(initialMode);
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const [showCheckout, setShowCheckout] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState(prefillPhone || '');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ orderId: string; total: number; mode: OrderMode } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allCategories = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const it of items) if (!seen.has(it.category)) { seen.add(it.category); out.push(it.category); }
    return out;
  }, [items]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allCategories
      .map((cat) => ({
        cat,
        items: items.filter((d) => {
          if (d.category !== cat) return false;
          if (vegOnly && !d.isVeg) return false;
          if (nonvegOnly && d.isVeg) return false;
          if (bestOnly && !d.isBestseller) return false;
          if (q) {
            const haystack = `${d.name} ${d.description}`.toLowerCase();
            if (!haystack.includes(q)) return false;
          }
          return true;
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [items, allCategories, query, vegOnly, nonvegOnly, bestOnly]);

  useEffect(() => {
    if (!activeCat && grouped[0]) setActiveCat(grouped[0].cat);
  }, [grouped, activeCat]);

  useEffect(() => {
    const onScroll = () => {
      const top = window.scrollY + 200;
      let active = grouped[0]?.cat || null;
      for (const { cat } of grouped) {
        const el = document.getElementById(`zt-cat-${catSlug(cat)}`);
        if (el && el.offsetTop <= top) active = cat;
      }
      if (active && active !== activeCat) setActiveCat(active);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [grouped, activeCat]);

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
          unit = parsePriceNumber(it.price);
          displayName = it.name;
        }
        return { key, name: displayName, qty, unit, lineTotal: unit * qty, isVeg: it.isVeg };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [cart, items]);

  const subtotal = cartLines.reduce((s, l) => s + l.lineTotal, 0);
  const itemCount = cartLines.reduce((s, l) => s + l.qty, 0);

  function bump(key: string, delta: number) {
    setCart((prev) => {
      const next = { ...prev };
      const curr = next[key] || 0;
      const target = Math.max(0, curr + delta);
      if (target === 0) delete next[key];
      else next[key] = target;
      return next;
    });
  }

  useEffect(() => {
    const isEnabled =
      (orderType === 'delivery' && deliveryAvailable) ||
      (orderType === 'takeaway' && takeawayEnabled) ||
      (orderType === 'dine_in' && dineInEnabled);
    if (!isEnabled) setOrderType(initialMode);
  }, [orderType, deliveryAvailable, takeawayEnabled, dineInEnabled, initialMode]);

  async function handleSubmit() {
    setError(null);
    if (cartLines.length === 0) {
      setError('Please add at least one item.');
      return;
    }
    const phoneDigits = customerPhone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      setError('Enter a valid WhatsApp number (10+ digits).');
      return;
    }
    if (orderType === 'delivery' && !deliveryAddress.trim()) {
      setError('Delivery address is required.');
      return;
    }
    if (orderType === 'dine_in' && !tableNumber.trim()) {
      setError('Table number is required for dine-in.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/menu/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          mode: orderType,
          customerName: customerName.trim(),
          customerPhone: phoneDigits,
          deliveryAddress: deliveryAddress.trim(),
          tableNumber: tableNumber.trim(),
          notes: notes.trim(),
          items: cartLines.map((l) => ({ name: l.name, qty: l.qty, price: l.unit })),
          marketingOptIn,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean; orderId?: string; total?: number; error?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error || `Submit failed (${res.status})`);
        return;
      }
      setSubmitted({ orderId: data.orderId || '', total: data.total ?? subtotal, mode: orderType });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div style={{ ...storefrontThemeStyle(brandColor), padding: '80px 32px' }}>
        <div style={{
          maxWidth: 480, margin: '0 auto', textAlign: 'center',
          background: 'var(--zt-surface)', border: '0.5px solid var(--zt-border)',
          borderRadius: 18, padding: '40px 32px',
          boxShadow: '0 12px 40px rgba(40,55,30,.08)',
        }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <h1 style={{ fontFamily: 'var(--zt-font-display)', fontSize: 32, margin: 0, color: 'var(--zt-ink)', letterSpacing: -0.5 }}>
            Order placed!
          </h1>
          <p style={{ color: 'var(--zt-ink-muted)', margin: '12px 0 6px', fontSize: 15 }}>
            {submitted.mode === 'delivery' ? 'Delivery — coming to you'
              : submitted.mode === 'dine_in' ? `Dine-in — Table ${tableNumber}`
              : 'Takeaway — ready for pickup'} · <b style={{ color: 'var(--zt-ink)' }}>₹{submitted.total.toFixed(0)}</b>
          </p>
          <p style={{ color: 'var(--zt-ink-muted)', fontSize: 13.5, lineHeight: 1.5, margin: '12px 0 24px' }}>
            The kitchen has been notified. You&apos;ll get a WhatsApp confirmation shortly with payment instructions.
          </p>
          <button type="button" onClick={() => {
            setSubmitted(null); setCart({}); setShowCheckout(false);
            setNotes(''); setDeliveryAddress(''); setTableNumber('');
          }} style={{
            padding: '12px 24px', borderRadius: 999,
            background: 'var(--zt-primary)', color: '#fff',
            border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            fontFamily: 'inherit',
          }}>
            Order more
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={storefrontThemeStyle(brandColor)}>
      <TopBar
        businessName={businessName} city={city} brandLogoUrl={brandLogoUrl}
        cartCount={itemCount} query={query} setQuery={setQuery}
        onJumpToCart={() => document.getElementById('zt-cart-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      />
      <Hero
        businessName={businessName} tagline={tagline} city={city}
        cuisineType={cuisineType} workingHours={workingHours}
        deliveryAvailable={deliveryAvailable} takeawayEnabled={takeawayEnabled} dineInEnabled={dineInEnabled}
        deliveryRadius={deliveryRadius}
        orderType={orderType} setOrderType={setOrderType}
      />

      <div style={{
        maxWidth: 1320, margin: '0 auto', padding: '32px',
        display: 'grid', gridTemplateColumns: '220px 1fr 380px', gap: 32,
        alignItems: 'flex-start',
      }}>
        <CategorySidebar
          categories={allCategories} activeCat={activeCat} grouped={grouped}
          minOrder={minimumOrder} city={city} workingHours={workingHours}
        />
        <MenuColumn
          grouped={grouped} cart={cart} bump={bump}
          vegOnly={vegOnly} nonvegOnly={nonvegOnly} bestOnly={bestOnly}
          setVegOnly={setVegOnly} setNonvegOnly={setNonvegOnly} setBestOnly={setBestOnly}
        />
        <CartPanel
          cartLines={cartLines} subtotal={subtotal} itemCount={itemCount}
          bump={bump}
          onCheckout={() => {
            setShowCheckout(true);
            setTimeout(() => document.getElementById('zt-checkout-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
          }}
        />
      </div>

      {showCheckout && (
        <CheckoutSection
          anchorId="zt-checkout-anchor"
          mode={orderType} setMode={setOrderType}
          deliveryAvailable={deliveryAvailable} takeawayEnabled={takeawayEnabled} dineInEnabled={dineInEnabled}
          customerName={customerName} setCustomerName={setCustomerName}
          customerPhone={customerPhone} setCustomerPhone={setCustomerPhone}
          deliveryAddress={deliveryAddress} setDeliveryAddress={setDeliveryAddress}
          tableNumber={tableNumber} setTableNumber={setTableNumber}
          notes={notes} setNotes={setNotes}
          marketingOptIn={marketingOptIn} setMarketingOptIn={setMarketingOptIn}
          businessName={businessName}
          subtotal={subtotal}
          submitting={submitting} error={error}
          onSubmit={handleSubmit} onCancel={() => setShowCheckout(false)}
        />
      )}

      <Footer
        businessName={businessName} address={address} phone={phone}
        workingHours={workingHours} fssaiLicenseNumber={fssaiLicenseNumber} gstin={gstin}
        categories={allCategories}
      />
    </div>
  );
}

// ═══════════════════════════════════════ TOP BAR
function TopBar({
  businessName, city, brandLogoUrl, cartCount, query, setQuery, onJumpToCart,
}: {
  businessName: string; city?: string; brandLogoUrl?: string; cartCount: number;
  query: string; setQuery: (v: string) => void; onJumpToCart: () => void;
}) {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 30,
      background: 'rgba(250,250,246,.85)',
      backdropFilter: 'blur(12px) saturate(160%)', WebkitBackdropFilter: 'blur(12px) saturate(160%)',
      borderBottom: '0.5px solid var(--zt-border)',
    }}>
      <div style={{
        maxWidth: 1320, margin: '0 auto', padding: '14px 32px',
        display: 'flex', alignItems: 'center', gap: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {brandLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brandLogoUrl} alt={businessName}
              style={{ width: 34, height: 34, borderRadius: 9, objectFit: 'cover', background: '#fff', border: '0.5px solid var(--zt-border)' }} />
          ) : (
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: 'linear-gradient(135deg, var(--zt-primary-dark), var(--zt-primary))',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--zt-font-display)', fontSize: 20,
            }}>{businessName.slice(0, 1).toUpperCase()}</div>
          )}
          <div>
            <div style={{ fontFamily: 'var(--zt-font-display)', fontSize: 18, lineHeight: 1, color: 'var(--zt-ink)' }}>
              {businessName}
            </div>
            {city && <div style={{ fontSize: 10.5, color: 'var(--zt-ink-muted)', marginTop: 2 }}>{city}</div>}
          </div>
        </div>

        <div style={{ flex: 1, maxWidth: 480, marginLeft: 24 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--zt-surface)', border: '0.5px solid var(--zt-border)',
            borderRadius: 10, padding: '9px 14px', color: 'var(--zt-ink-muted)',
          }}>
            <I.search />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the menu — biryani, paneer, dal…"
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 13, color: 'var(--zt-ink)', fontFamily: 'inherit',
              }} />
            {query && (
              <button type="button" onClick={() => setQuery('')}
                style={{ background: 'none', border: 'none', color: 'var(--zt-ink-muted)', cursor: 'pointer', padding: 0 }}>
                <I.close />
              </button>
            )}
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button type="button" onClick={onJumpToCart} style={{ ...navBtn, position: 'relative' }}>
            <I.bag /> Cart
            {cartCount > 0 && (
              <span style={{
                position: 'absolute', top: 2, right: 2,
                minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999,
                background: 'var(--zt-primary)', color: '#fff', fontSize: 10, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>{cartCount}</span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

const navBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 12px', borderRadius: 10, border: '0.5px solid var(--zt-border)',
  background: 'var(--zt-surface)', color: 'var(--zt-ink)',
  fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};

// ═══════════════════════════════════════ HERO
function Hero({
  businessName, tagline, city, cuisineType, workingHours,
  deliveryAvailable, takeawayEnabled, dineInEnabled, deliveryRadius,
  orderType, setOrderType,
}: {
  businessName: string; tagline?: string; city?: string; cuisineType?: string;
  workingHours?: string; deliveryAvailable: boolean; takeawayEnabled: boolean;
  dineInEnabled: boolean; deliveryRadius?: string;
  orderType: OrderMode; setOrderType: (m: OrderMode) => void;
}) {
  return (
    <div style={{
      background: 'linear-gradient(180deg, var(--zt-primary) 0%, var(--zt-primary-dark) 100%)',
      color: '#fff', paddingTop: 56, paddingBottom: 56,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0, opacity: .08,
        backgroundImage: `radial-gradient(circle at 20% 30%, #fff 1px, transparent 1px),
                          radial-gradient(circle at 80% 70%, #fff 1px, transparent 1px)`,
        backgroundSize: '60px 60px, 80px 80px',
      }} />
      <div style={{
        maxWidth: 1320, margin: '0 auto', padding: '0 32px',
        display: 'grid', gridTemplateColumns: '1fr 320px', gap: 60,
        alignItems: 'center', position: 'relative',
      }}>
        <div>
          {workingHours && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,.16)', border: '0.5px solid rgba(255,255,255,.2)',
              padding: '4px 11px', borderRadius: 999, fontSize: 11, fontWeight: 600,
              letterSpacing: .4, marginBottom: 16,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#9DD17C' }} />
              Open now · {workingHours}
            </div>
          )}
          <h1 style={{
            fontFamily: 'var(--zt-font-display)', fontSize: 76, lineHeight: .98,
            fontWeight: 400, margin: 0, letterSpacing: -1.8,
          }}>{businessName}</h1>
          {tagline && (
            <div style={{ fontSize: 16, opacity: .85, marginTop: 8, fontStyle: 'italic',
              fontFamily: 'var(--zt-font-display)' }}>
              {tagline}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 22 }}>
            {city && <HeroChip><I.pin /> {city}</HeroChip>}
            {cuisineType && <HeroChip><I.tag /> {cuisineType}</HeroChip>}
            {deliveryAvailable && deliveryRadius && <HeroChip><I.scooter /> {deliveryRadius}</HeroChip>}
          </div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,.1)', border: '0.5px solid rgba(255,255,255,.18)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          borderRadius: 16, padding: 18,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, opacity: .8,
            letterSpacing: .8, textTransform: 'uppercase', marginBottom: 12 }}>
            How would you like it?
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {deliveryAvailable && (
              <OrderMethodChoice icon={<I.scooter />} title="Delivery"
                sub={deliveryRadius ? `Within ${deliveryRadius}` : 'Coming to you'}
                active={orderType === 'delivery'} onClick={() => setOrderType('delivery')} />
            )}
            {takeawayEnabled && (
              <OrderMethodChoice icon={<I.bag />} title="Takeaway" sub="Ready in ~15 min"
                active={orderType === 'takeaway'} onClick={() => setOrderType('takeaway')} />
            )}
            {dineInEnabled && (
              <OrderMethodChoice icon={<I.table />} title="Dine-in" sub="Eat at the restaurant"
                active={orderType === 'dine_in'} onClick={() => setOrderType('dine_in')} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroChip({ children }: { children: ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: 'rgba(255,255,255,.14)', border: '0.5px solid rgba(255,255,255,.2)',
      padding: '6px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 500,
    }}>{children}</span>
  );
}

function OrderMethodChoice({
  icon, title, sub, active, onClick,
}: { icon: ReactNode; title: string; sub: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
      borderRadius: 10, cursor: 'pointer', textAlign: 'left',
      border: `1px solid ${active ? '#fff' : 'rgba(255,255,255,.2)'}`,
      background: active ? 'rgba(255,255,255,.15)' : 'transparent',
      color: '#fff', fontFamily: 'inherit',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 9,
        background: active ? '#fff' : 'rgba(255,255,255,.16)',
        color: active ? '#3F5736' : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 11, opacity: .8, marginTop: 1 }}>{sub}</div>
      </div>
      <div style={{
        width: 18, height: 18, borderRadius: '50%',
        border: `1.5px solid ${active ? '#fff' : 'rgba(255,255,255,.4)'}`,
        background: active ? '#fff' : 'transparent',
      }}>
        {active && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3F5736', margin: '3px' }} />}
      </div>
    </button>
  );
}

// ═══════════════════════════════════════ CATEGORY SIDEBAR
function CategorySidebar({
  categories, activeCat, grouped, minOrder, city, workingHours,
}: {
  categories: string[]; activeCat: string | null;
  grouped: Array<{ cat: string; items: FlatItem[] }>;
  minOrder?: string; city?: string; workingHours?: string;
}) {
  const countByCat = new Map(grouped.map((g) => [g.cat, g.items.length]));
  return (
    <aside style={{ position: 'sticky', top: 90 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: 'var(--zt-ink-muted)',
        letterSpacing: .8, textTransform: 'uppercase', marginBottom: 12, padding: '0 12px',
      }}>
        Menu
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {categories.map((cat) => {
          const count = countByCat.get(cat) || 0;
          const isActive = activeCat === cat;
          return (
            <a key={cat} href={`#zt-cat-${catSlug(cat)}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(`zt-cat-${catSlug(cat)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                fontSize: 13, fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--zt-primary-dark)' : count > 0 ? 'var(--zt-ink)' : 'var(--zt-ink-muted)',
                background: isActive ? 'var(--zt-primary-soft)' : 'transparent',
                textDecoration: 'none', transition: 'all .15s',
                opacity: count > 0 ? 1 : 0.4,
                pointerEvents: count > 0 ? 'auto' : 'none',
              }}>
              <span>{cat}</span>
              <span style={{ fontSize: 11, opacity: .55 }}>{count}</span>
            </a>
          );
        })}
      </div>

      <div style={{
        marginTop: 24, padding: 14, borderRadius: 12,
        background: 'var(--zt-surface)', border: '0.5px solid var(--zt-border)',
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--zt-ink-muted)',
          letterSpacing: .8, textTransform: 'uppercase', marginBottom: 10 }}>
          Quick facts
        </div>
        {workingHours && <FactRow icon={<I.clock />} label="Hours" value={workingHours} />}
        {city && <FactRow icon={<I.pin />} label="From" value={city} />}
        {minOrder && <FactRow icon={<I.scooter />} label="Min order" value={minOrder} />}
      </div>
    </aside>
  );
}

function FactRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 12 }}>
      <span style={{ color: 'var(--zt-primary-dark)' }}>{icon}</span>
      <span style={{ color: 'var(--zt-ink-muted)', flex: 1 }}>{label}</span>
      <span style={{ color: 'var(--zt-ink)', fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

// ═══════════════════════════════════════ MENU COLUMN
function MenuColumn({
  grouped, cart, bump,
  vegOnly, nonvegOnly, bestOnly,
  setVegOnly, setNonvegOnly, setBestOnly,
}: {
  grouped: Array<{ cat: string; items: FlatItem[] }>;
  cart: Record<string, number>;
  bump: (key: string, delta: number) => void;
  vegOnly: boolean; nonvegOnly: boolean; bestOnly: boolean;
  setVegOnly: (v: boolean) => void;
  setNonvegOnly: (v: boolean) => void;
  setBestOnly: (v: boolean) => void;
}) {
  const totalItems = grouped.reduce((s, g) => s + g.items.length, 0);
  return (
    <main>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24,
        padding: '12px 14px', background: 'var(--zt-surface)', borderRadius: 12,
        border: '0.5px solid var(--zt-border)',
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 11, fontWeight: 600, color: 'var(--zt-ink-muted)',
          letterSpacing: .8, textTransform: 'uppercase', marginRight: 4 }}>
          <I.filter /> Filter
        </span>
        <FilterChipD active={vegOnly} onClick={() => setVegOnly(!vegOnly)}>
          <VegDot veg size={11} /> Veg only
        </FilterChipD>
        <FilterChipD active={nonvegOnly} onClick={() => setNonvegOnly(!nonvegOnly)}>
          <VegDot veg={false} size={11} /> Non-veg
        </FilterChipD>
        <FilterChipD active={bestOnly} onClick={() => setBestOnly(!bestOnly)}>
          <I.star s={{ color: '#C5803F', width: 11, height: 11 }} /> Bestsellers
        </FilterChipD>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--zt-ink-muted)' }}>{totalItems} items</span>
      </div>

      {grouped.length === 0 ? (
        <div style={{
          padding: '80px 24px', textAlign: 'center', color: 'var(--zt-ink-muted)',
          fontSize: 14, background: 'var(--zt-surface)', borderRadius: 14,
          border: '0.5px solid var(--zt-border)',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🍽️</div>
          No dishes match your filters.
        </div>
      ) : (
        grouped.map(({ cat, items }) => (
          <section key={cat} id={`zt-cat-${catSlug(cat)}`}
            style={{ marginBottom: 36, scrollMarginTop: 100 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
              <h2 style={{
                fontFamily: 'var(--zt-font-display)', fontSize: 32, margin: 0,
                fontWeight: 400, letterSpacing: -.5, color: 'var(--zt-ink)',
              }}>{cat}</h2>
              <span style={{ fontSize: 12, color: 'var(--zt-ink-muted)' }}>
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              {items.map((item) => (
                <DishCardD key={item.id} item={item} cart={cart} bump={bump} />
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  );
}

function FilterChipD({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 12px', borderRadius: 999,
      background: active ? 'var(--zt-primary-soft)' : 'transparent',
      color: active ? 'var(--zt-primary-dark)' : 'var(--zt-ink)',
      border: `0.5px solid ${active ? 'var(--zt-primary)' : 'var(--zt-border)'}`,
      fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    }}>
      {children}
      {active && <I.check s={{ width: 11, height: 11, color: '#3F5736' }} />}
    </button>
  );
}

function DishCardD({
  item, cart, bump,
}: { item: FlatItem; cart: Record<string, number>; bump: (k: string, d: number) => void }) {
  const hasVariants = item.sizes.length > 0;
  const singleQty = hasVariants ? 0 : cart[item.id] || 0;
  return (
    <div style={{
      background: 'var(--zt-surface)', border: '0.5px solid var(--zt-border)',
      borderRadius: 14, padding: 16, display: 'flex', gap: 14,
    }}>
      <PhotoSlot size={110} label={item.name.split(' ')[0].toLowerCase()} rounded={12} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <VegDot veg={item.isVeg} />
          {item.isBestseller && <BestsellerChip />}
        </div>
        <div style={{
          fontSize: 15, fontWeight: 700, color: 'var(--zt-ink)', lineHeight: 1.2,
          marginBottom: 4, letterSpacing: -.1,
        }}>{item.name}</div>
        {!hasVariants && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--zt-ink)' }}>{item.price}</span>
          </div>
        )}
        {item.description && (
          <div style={{
            fontSize: 12, color: 'var(--zt-ink-muted)', lineHeight: 1.45,
            flex: 1, marginBottom: 10,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
          }}>{item.description}</div>
        )}
        {hasVariants ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {item.sizes.map((sz) => {
              const key = `${item.id}|${sz.label}`;
              const qty = cart[key] || 0;
              return (
                <div key={sz.label} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 8, padding: '6px 10px', borderRadius: 8,
                  background: 'var(--zt-surface-2)',
                }}>
                  <div style={{ fontSize: 12.5 }}>
                    <span style={{ fontWeight: 600, color: 'var(--zt-ink)' }}>{sz.label}</span>
                    <span style={{ marginLeft: 8, color: 'var(--zt-ink-muted)' }}>₹{sz.price}</span>
                  </div>
                  <AddButton qty={qty} primary="#5C7A4F"
                    onAdd={() => bump(key, 1)} onInc={() => bump(key, 1)} onDec={() => bump(key, -1)} />
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <AddButton qty={singleQty} primary="#5C7A4F"
              onAdd={() => bump(item.id, 1)} onInc={() => bump(item.id, 1)} onDec={() => bump(item.id, -1)} />
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════ CART PANEL
function CartPanel({
  cartLines, subtotal, itemCount, bump, onCheckout,
}: {
  cartLines: Array<{ key: string; name: string; qty: number; unit: number; lineTotal: number; isVeg: boolean }>;
  subtotal: number; itemCount: number;
  bump: (k: string, d: number) => void; onCheckout: () => void;
}) {
  return (
    <aside id="zt-cart-anchor" style={{ position: 'sticky', top: 90 }}>
      <div style={{
        background: 'var(--zt-surface)', border: '0.5px solid var(--zt-border)',
        borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(40,55,30,.05)',
      }}>
        <div style={{
          padding: '14px 16px',
          background: 'linear-gradient(180deg, var(--zt-primary) 0%, var(--zt-primary-dark) 100%)',
          color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <I.bag s={{ color: '#fff' }} />
            <span style={{ fontWeight: 700, fontSize: 13.5 }}>Your cart</span>
          </div>
          <span style={{ fontSize: 11, opacity: .85 }}>
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </span>
        </div>

        {cartLines.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🛒</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--zt-ink)' }}>Your cart is empty</div>
            <div style={{ fontSize: 11, color: 'var(--zt-ink-muted)', marginTop: 4 }}>
              Add items from the menu to get started
            </div>
          </div>
        ) : (
          <>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {cartLines.map((it, i) => (
                <div key={it.key}>
                  <div style={{ padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <VegDot veg={it.isVeg} size={10} />
                        <div style={{
                          fontSize: 12.5, fontWeight: 600, color: 'var(--zt-ink)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                        }}>{it.name}</div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--zt-ink-muted)', marginTop: 2 }}>
                        ₹{it.unit} × {it.qty} = <b style={{ color: 'var(--zt-ink)' }}>₹{it.lineTotal}</b>
                      </div>
                    </div>
                    <AddButton qty={it.qty} primary="#5C7A4F"
                      onInc={() => bump(it.key, 1)} onDec={() => bump(it.key, -1)} />
                  </div>
                  {i < cartLines.length - 1 && <Hairline style={{ margin: '0 16px' }} />}
                </div>
              ))}
            </div>

            <div style={{ padding: 16, borderTop: '0.5px solid var(--zt-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontSize: 12.5, color: 'var(--zt-ink-muted)' }}>Subtotal</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--zt-ink)' }}>₹{subtotal}</span>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--zt-ink-muted)', marginBottom: 12 }}>
                Final total + delivery / packaging shown at checkout
              </div>
              <button type="button" onClick={onCheckout} style={{
                width: '100%',
                background: 'linear-gradient(180deg, var(--zt-primary) 0%, var(--zt-primary-dark) 100%)',
                color: '#fff', border: 'none', borderRadius: 12,
                padding: 13, fontSize: 13.5, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: '0 4px 12px rgba(60,80,50,.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}>
                Checkout · ₹{subtotal} <I.chevron s={{ color: '#fff' }} />
              </button>
              <div style={{
                marginTop: 10, fontSize: 10.5, color: 'var(--zt-ink-muted)',
                textAlign: 'center', lineHeight: 1.4,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <I.whatsapp s={{ color: '#25D366', width: 12, height: 12 }} />
                Order updates land in your WhatsApp
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

// ═══════════════════════════════════════ CHECKOUT SECTION
function CheckoutSection(props: {
  anchorId: string;
  mode: OrderMode; setMode: (m: OrderMode) => void;
  deliveryAvailable: boolean; takeawayEnabled: boolean; dineInEnabled: boolean;
  customerName: string; setCustomerName: (v: string) => void;
  customerPhone: string; setCustomerPhone: (v: string) => void;
  deliveryAddress: string; setDeliveryAddress: (v: string) => void;
  tableNumber: string; setTableNumber: (v: string) => void;
  notes: string; setNotes: (v: string) => void;
  marketingOptIn: boolean; setMarketingOptIn: (v: boolean) => void;
  businessName: string; subtotal: number;
  submitting: boolean; error: string | null;
  onSubmit: () => void; onCancel: () => void;
}) {
  const inputStyle: CSSProperties = {
    width: '100%', padding: '11px 14px',
    background: 'var(--zt-bg)', border: '0.5px solid var(--zt-border)',
    borderRadius: 10, fontSize: 13.5, color: 'var(--zt-ink)',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  };
  return (
    <div id={props.anchorId} style={{
      background: 'var(--zt-surface-2)', borderTop: '0.5px solid var(--zt-border)',
      padding: '40px 32px',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto',
        background: 'var(--zt-surface)', border: '0.5px solid var(--zt-border)',
        borderRadius: 18, padding: '28px 32px',
        boxShadow: '0 8px 30px rgba(40,55,30,.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
          <h2 style={{ fontFamily: 'var(--zt-font-display)', fontSize: 32, margin: 0,
            fontWeight: 400, letterSpacing: -.5, color: 'var(--zt-ink)' }}>
            Checkout
          </h2>
          <button type="button" onClick={props.onCancel} style={{
            background: 'none', border: 'none', color: 'var(--zt-ink-muted)',
            fontSize: 13, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit',
          }}>
            ← Back to menu
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {props.deliveryAvailable && (
            <ModeButton active={props.mode === 'delivery'} onClick={() => props.setMode('delivery')}
              icon={<I.scooter />} label="Delivery" />
          )}
          {props.takeawayEnabled && (
            <ModeButton active={props.mode === 'takeaway'} onClick={() => props.setMode('takeaway')}
              icon={<I.bag />} label="Takeaway" />
          )}
          {props.dineInEnabled && (
            <ModeButton active={props.mode === 'dine_in'} onClick={() => props.setMode('dine_in')}
              icon={<I.table />} label="Dine-in" />
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <Field label="Your name">
            <input type="text" value={props.customerName} onChange={(e) => props.setCustomerName(e.target.value)}
              placeholder="Aapka naam" style={inputStyle} />
          </Field>
          <Field label="WhatsApp number">
            <input type="tel" inputMode="numeric" value={props.customerPhone}
              onChange={(e) => props.setCustomerPhone(e.target.value)}
              placeholder="+91 9XXXXXXXXX" style={inputStyle} />
          </Field>
        </div>

        {props.mode === 'delivery' && (
          <Field label="Delivery address">
            <textarea value={props.deliveryAddress} onChange={(e) => props.setDeliveryAddress(e.target.value)}
              placeholder="Full address with landmark / floor / apartment number"
              rows={3} style={{ ...inputStyle, resize: 'vertical', minHeight: 80, fontFamily: 'inherit' }} />
          </Field>
        )}

        {props.mode === 'dine_in' && (
          <Field label="Table number">
            <input type="text" value={props.tableNumber} onChange={(e) => props.setTableNumber(e.target.value)}
              placeholder="e.g. 7" style={inputStyle} />
          </Field>
        )}

        <Field label="Special instructions (optional)">
          <textarea value={props.notes} onChange={(e) => props.setNotes(e.target.value)}
            placeholder="Less spicy, no onion, etc." rows={2}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 60, fontFamily: 'inherit' }} />
        </Field>

        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 6, marginBottom: 16,
          fontSize: 12.5, color: 'var(--zt-ink-muted)', lineHeight: 1.5, cursor: 'pointer',
        }}>
          <input type="checkbox" checked={props.marketingOptIn}
            onChange={(e) => props.setMarketingOptIn(e.target.checked)}
            style={{ marginTop: 2, flexShrink: 0, accentColor: 'var(--zt-primary)' }} />
          <span>
            Send me updates from <b style={{ color: 'var(--zt-ink)' }}>{props.businessName}</b> about offers and weekly specials on WhatsApp.
            <br />
            <span style={{ fontSize: 11, opacity: .75 }}>
              Optional. Reply STOP anytime. Order confirmations are sent regardless.
            </span>
          </span>
        </label>

        {props.error && (
          <div style={{
            padding: '10px 14px', borderRadius: 10,
            background: '#FEF2F2', border: '0.5px solid #FCA5A5', color: '#991B1B',
            fontSize: 12.5, marginBottom: 14,
          }}>{props.error}</div>
        )}

        <button type="button" disabled={props.submitting} onClick={props.onSubmit} style={{
          width: '100%', padding: 15,
          background: props.submitting ? 'var(--zt-ink-muted)'
            : 'linear-gradient(180deg, var(--zt-primary) 0%, var(--zt-primary-dark) 100%)',
          color: '#fff', border: 'none', borderRadius: 12,
          fontSize: 14.5, fontWeight: 700, cursor: props.submitting ? 'wait' : 'pointer',
          fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          boxShadow: '0 6px 18px rgba(60,80,50,.25)',
        }}>
          {props.submitting ? 'Placing order…' : (
            <>Place order — ₹{props.subtotal} <I.chevron s={{ color: '#fff' }} /></>
          )}
        </button>
        <div style={{ fontSize: 11, color: 'var(--zt-ink-muted)', textAlign: 'center', marginTop: 10 }}>
          Payment instructions will be sent on WhatsApp after placing the order.
        </div>
      </div>
    </div>
  );
}

function ModeButton({
  active, onClick, icon, label,
}: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick} style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
      background: active ? 'var(--zt-primary-soft)' : 'var(--zt-surface)',
      color: active ? 'var(--zt-primary-dark)' : 'var(--zt-ink)',
      border: `0.5px solid ${active ? 'var(--zt-primary)' : 'var(--zt-border)'}`,
      fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
    }}>
      {icon} {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: 'var(--zt-ink-muted)',
        letterSpacing: .6, textTransform: 'uppercase', marginBottom: 6,
      }}>{label}</div>
      {children}
    </label>
  );
}

// ═══════════════════════════════════════ FOOTER
function Footer({
  businessName, address, phone, workingHours, fssaiLicenseNumber, gstin, categories,
}: {
  businessName: string; address?: string; phone?: string; workingHours?: string;
  fssaiLicenseNumber?: string; gstin?: string; categories: string[];
}) {
  return (
    <footer style={{
      borderTop: '0.5px solid var(--zt-border)', background: 'var(--zt-surface-2)',
      padding: '40px 32px 30px',
    }}>
      <div style={{
        maxWidth: 1320, margin: '0 auto',
        display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 40,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'linear-gradient(135deg, var(--zt-primary-dark), var(--zt-primary))',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--zt-font-display)', fontSize: 18,
            }}>{businessName.slice(0, 1).toUpperCase()}</div>
            <div style={{ fontFamily: 'var(--zt-font-display)', fontSize: 20, color: 'var(--zt-ink)' }}>
              {businessName}
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--zt-ink-muted)', lineHeight: 1.6 }}>
            {address && (<>{address}<br /></>)}
            {workingHours && (<>{workingHours}<br /></>)}
            {phone && <a href={`tel:${phone}`} style={{ color: 'var(--zt-primary-dark)' }}>{phone}</a>}
          </div>
        </div>
        <FooterCol title="Menu">
          {categories.slice(0, 6).map((c) => (
            <a key={c} href={`#zt-cat-${catSlug(c)}`}
              onClick={(e) => { e.preventDefault(); document.getElementById(`zt-cat-${catSlug(c)}`)?.scrollIntoView({ behavior: 'smooth' }); }}
              style={footerLinkStyle}>{c}</a>
          ))}
        </FooterCol>
        <FooterCol title="Connect">
          {phone && <a href={`tel:${phone}`} style={footerLinkStyle}><I.phone /> Call us</a>}
          <span style={footerLinkStyle}><I.whatsapp s={{ color: '#25D366' }} /> Order via WhatsApp</span>
        </FooterCol>
      </div>
      <div style={{
        maxWidth: 1320, margin: '30px auto 0',
        paddingTop: 20, borderTop: '0.5px dashed var(--zt-border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 11, color: 'var(--zt-ink-muted)', flexWrap: 'wrap', gap: 10,
      }}>
        <div>
          {fssaiLicenseNumber && <>FSSAI {fssaiLicenseNumber}</>}
          {fssaiLicenseNumber && gstin && ' · '}
          {gstin && <>GST {gstin}</>}
        </div>
        <div>Powered by <b style={{ color: 'var(--zt-ink)' }}>ZapText</b> · WhatsApp ordering for restaurants</div>
      </div>
    </footer>
  );
}

const footerLinkStyle: CSSProperties = {
  fontSize: 12.5, color: 'var(--zt-ink)', textDecoration: 'none',
  display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
};

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--zt-ink-muted)',
        letterSpacing: .8, textTransform: 'uppercase', marginBottom: 12,
      }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  );
}
