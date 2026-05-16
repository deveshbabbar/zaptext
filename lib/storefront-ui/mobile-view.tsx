'use client';

// Mobile-only storefront view — ports `menu-screen.jsx` from the
// design files at the repo root. Wired to real props from page.tsx
// instead of `window.MENU` / `window.RESTAURANT`. Single network
// call: POST /api/menu/submit, same payload shape as desktop-view.

import { useEffect, useMemo, useState, useRef, type CSSProperties, type ReactNode } from 'react';
import {
  AddButton,
  BestsellerChip,
  I,
  PhotoSlot,
  VegDot,
  storefrontThemeStyle,
} from './atoms';
import type { FlatItem, DesktopViewProps } from './desktop-view';
import { InfoModal } from './info-modal';

type OrderMode = 'delivery' | 'takeaway' | 'dine_in';

export type MobileViewProps = DesktopViewProps;

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

export function MobileView(props: MobileViewProps) {
  const {
    clientId, businessName, tagline, brandLogoUrl,
    city, cuisineType, workingHours, address,
    deliveryRadius, minimumOrder,
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
  const [showInfo, setShowInfo] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState(prefillPhone || '');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ orderId: string; total: number; mode: OrderMode } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const catRefs = useRef<Record<string, HTMLElement | null>>({});

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
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const onScroll = () => {
      const top = scroller.scrollTop + 80;
      let active: string | null = grouped[0]?.cat || null;
      for (const { cat } of grouped) {
        const el = catRefs.current[cat];
        if (el && el.offsetTop <= top) active = cat;
      }
      if (active && active !== activeCat) setActiveCat(active);
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [grouped, activeCat]);

  function goToCat(cat: string) {
    const el = catRefs.current[cat];
    const scroller = scrollerRef.current;
    if (el && scroller) {
      scroller.scrollTo({ top: el.offsetTop - 56, behavior: 'smooth' });
    }
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
    setErrorMsg(null);
    if (cartLines.length === 0) { setErrorMsg('Please add at least one item.'); return; }
    const phoneDigits = customerPhone.replace(/\D/g, '');
    if (phoneDigits.length < 10) { setErrorMsg('Enter a valid WhatsApp number (10+ digits).'); return; }
    if (orderType === 'delivery' && !deliveryAddress.trim()) { setErrorMsg('Delivery address is required.'); return; }
    if (orderType === 'dine_in' && !tableNumber.trim()) { setErrorMsg('Table number is required for dine-in.'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/menu/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId, mode: orderType,
          customerName: customerName.trim(), customerPhone: phoneDigits,
          deliveryAddress: deliveryAddress.trim(), tableNumber: tableNumber.trim(),
          notes: notes.trim(),
          items: cartLines.map((l) => ({ name: l.name, qty: l.qty, price: l.unit })),
          marketingOptIn,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean; orderId?: string; total?: number; error?: string;
      };
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || `Submit failed (${res.status})`);
        return;
      }
      setSubmitted({ orderId: data.orderId || '', total: data.total ?? subtotal, mode: orderType });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div style={{ ...storefrontThemeStyle(undefined), padding: '60px 20px', textAlign: 'center' }}>
        <div style={{
          maxWidth: 380, margin: '0 auto',
          background: 'var(--zt-surface)', border: '0.5px solid var(--zt-border)',
          borderRadius: 18, padding: '36px 24px',
          boxShadow: '0 12px 32px rgba(40,55,30,.06)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 14 }}>✅</div>
          <h1 style={{
            fontFamily: 'var(--zt-font-display)', fontSize: 28, margin: 0,
            color: 'var(--zt-ink)', letterSpacing: -.3,
          }}>Order placed!</h1>
          <p style={{ color: 'var(--zt-ink-muted)', margin: '10px 0 6px', fontSize: 13.5 }}>
            {submitted.mode === 'delivery' ? 'Delivery — coming to you'
              : submitted.mode === 'dine_in' ? `Dine-in — Table ${tableNumber}`
              : 'Takeaway — ready for pickup'} · <b style={{ color: 'var(--zt-ink)' }}>₹{submitted.total.toFixed(0)}</b>
          </p>
          <p style={{ color: 'var(--zt-ink-muted)', fontSize: 12.5, lineHeight: 1.5, margin: '12px 0 20px' }}>
            The kitchen has been notified. WhatsApp confirmation with payment instructions is on the way.
          </p>
          <button type="button" onClick={() => {
            setSubmitted(null); setCart({}); setShowCheckout(false);
            setNotes(''); setDeliveryAddress(''); setTableNumber('');
          }} style={{
            padding: '11px 22px', borderRadius: 999,
            background: 'var(--zt-primary)', color: '#fff',
            border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            fontFamily: 'inherit',
          }}>
            Order more
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={storefrontThemeStyle(undefined)}>
      <div ref={scrollerRef} style={{
        position: 'relative', display: 'flex', flexDirection: 'column',
        minHeight: '100vh', maxWidth: 540, margin: '0 auto',
        background: 'var(--zt-bg)',
      }}>
        {/* Top sage banner */}
        <div style={{
          background: 'linear-gradient(180deg, var(--zt-primary) 0%, var(--zt-primary-dark) 100%)',
          color: '#fff', padding: '46px 18px 18px',
          boxShadow: '0 1px 0 rgba(0,0,0,.04)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" style={iconBtnLight} aria-label="Restaurant info"
              onClick={() => setShowInfo(true)}>
              <I.info />
            </button>
            <div style={{ fontSize: 11, opacity: .85, fontWeight: 500, letterSpacing: .4 }}>
              Powered by ZapText
            </div>
            <button type="button" style={iconBtnLight} aria-label="Share">
              <I.share />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, paddingBottom: itemCount > 0 ? 90 : 30 }}>
          {/* Identity card */}
          <div style={{
            margin: '-44px 14px 0', padding: '16px 16px 14px',
            background: 'var(--zt-surface)', borderRadius: 16,
            border: '0.5px solid var(--zt-border)',
            boxShadow: '0 6px 24px rgba(40,55,30,.08), 0 1px 0 rgba(255,255,255,1) inset',
            position: 'relative',
          }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {brandLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brandLogoUrl} alt={businessName}
                  style={{
                    width: 54, height: 54, borderRadius: 14, objectFit: 'cover',
                    background: '#fff', border: '0.5px solid var(--zt-border)', flexShrink: 0,
                  }} />
              ) : (
                <div style={{
                  width: 54, height: 54, borderRadius: 14, flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--zt-primary-dark), var(--zt-primary))',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--zt-font-display)', fontSize: 30, fontWeight: 400,
                  boxShadow: '0 2px 8px rgba(60,80,50,.2)',
                }}>{businessName.slice(0, 1).toUpperCase()}</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--zt-font-display)', fontSize: 24, lineHeight: 1.05,
                  color: 'var(--zt-ink)', letterSpacing: -.3, marginBottom: 2,
                }}>{businessName}</div>
                {tagline && (
                  <div style={{ fontSize: 12, color: 'var(--zt-ink-muted)', marginBottom: 8 }}>
                    {tagline}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {workingHours && <span style={metaChip}><I.clock /> {workingHours}</span>}
                  {city && <span style={metaChip}><I.pin /> {city}</span>}
                </div>
              </div>
            </div>
            {(cuisineType || minimumOrder) && (
              <div style={{
                marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--zt-border)',
                fontSize: 11, color: 'var(--zt-ink-muted)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
              }}>
                {cuisineType && <span>{cuisineType}</span>}
                {minimumOrder && (
                  <span style={{ color: 'var(--zt-primary)', fontWeight: 600 }}>
                    Min order {minimumOrder}
                  </span>
                )}
              </div>
            )}
          </div>

          {(deliveryRadius || minimumOrder) && (
            <div style={{ padding: '14px 14px 0' }}>
              <div style={{
                background: '#F6F2E4', border: '0.5px solid #E8DFC2',
                borderRadius: 12, padding: '10px 12px',
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <div style={{ color: '#8A6E2C', marginTop: 1 }}><I.info /></div>
                <div style={{ flex: 1, fontSize: 11, color: '#6B5B2B', lineHeight: 1.5 }}>
                  <b style={{ color: '#5A4A1F' }}>Pricing transparency</b><br />
                  {minimumOrder && <>Min order {minimumOrder}. </>}
                  {deliveryRadius && <>Delivery within {deliveryRadius}. </>}
                  No hidden charges — full breakdown at checkout.
                </div>
              </div>
            </div>
          )}

          <div style={{ padding: '16px 14px 10px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--zt-surface)', border: '0.5px solid var(--zt-border)',
              borderRadius: 12, padding: '10px 14px',
              color: 'var(--zt-ink-muted)',
            }}>
              <I.search />
              <input type="search" value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search dishes — try 'biryani', 'paneer'"
                style={{
                  flex: 1, border: 'none', outline: 'none', background: 'transparent',
                  fontSize: 13, color: 'var(--zt-ink)', fontFamily: 'inherit',
                  minWidth: 0,
                }} />
              {query && (
                <button type="button" onClick={() => setQuery('')}
                  style={{
                    background: 'none', border: 'none', color: 'var(--zt-ink-muted)',
                    cursor: 'pointer', padding: 0,
                  }} aria-label="Clear search">
                  <I.close />
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <FilterChip active={vegOnly} onClick={() => setVegOnly(!vegOnly)}>
                <VegDot veg size={11} /> Veg only
              </FilterChip>
              <FilterChip active={nonvegOnly} onClick={() => setNonvegOnly(!nonvegOnly)}>
                <VegDot veg={false} size={11} /> Non-veg
              </FilterChip>
              <FilterChip active={bestOnly} onClick={() => setBestOnly(!bestOnly)}>
                <I.star s={{ color: '#C5803F', width: 11, height: 11 }} /> Bestsellers
              </FilterChip>
            </div>
          </div>

          {grouped.length > 1 && (
            <div style={{
              position: 'sticky', top: 0, zIndex: 5,
              background: 'var(--zt-bg)',
              borderBottom: '0.5px solid var(--zt-border)',
              padding: '8px 0',
            }}>
              <div style={{
                display: 'flex', gap: 6, overflowX: 'auto', padding: '0 14px',
                scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
              }}>
                {grouped.map(({ cat, items: catItems }) => (
                  <button key={cat} type="button" onClick={() => goToCat(cat)} style={{
                    flex: '0 0 auto', padding: '6px 12px', borderRadius: 999,
                    background: activeCat === cat ? 'var(--zt-ink)' : 'transparent',
                    color: activeCat === cat ? '#fff' : 'var(--zt-ink-muted)',
                    border: activeCat === cat ? 'none' : '0.5px solid var(--zt-border)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'inherit', whiteSpace: 'nowrap',
                    transition: 'all .15s',
                  }}>
                    {cat} <span style={{ opacity: .6, marginLeft: 3 }}>{catItems.length}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {grouped.length === 0 ? (
            <div style={{
              padding: '60px 24px', textAlign: 'center', color: 'var(--zt-ink-muted)',
              fontSize: 13,
            }}>
              <div style={{ fontSize: 34, marginBottom: 12 }}>🍽️</div>
              {items.length === 0
                ? "Menu loading… If this stays empty, the restaurant hasn't configured items yet."
                : 'No dishes match your filters.'}
            </div>
          ) : (
            grouped.map(({ cat, items: catItems }) => (
              <section key={cat}
                ref={(el) => { catRefs.current[cat] = el; }}
                id={`zt-m-cat-${catSlug(cat)}`}
                style={{ padding: '20px 14px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
                  <h2 style={{
                    fontFamily: 'var(--zt-font-display)', fontSize: 22,
                    color: 'var(--zt-ink)', margin: 0, fontWeight: 400, letterSpacing: -.3,
                  }}>{cat}</h2>
                  <span style={{ fontSize: 11, color: 'var(--zt-ink-muted)' }}>
                    {catItems.length} {catItems.length === 1 ? 'item' : 'items'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {catItems.map((item) => (
                    <DishCard key={item.id} item={item} cart={cart} bump={bump} />
                  ))}
                </div>
              </section>
            ))
          )}

          {(props.fssaiLicenseNumber || props.gstin) && (
            <div style={{
              padding: '24px 14px 10px', textAlign: 'center',
              fontSize: 10, color: 'var(--zt-ink-muted)', letterSpacing: .4, opacity: .8,
            }}>
              {props.fssaiLicenseNumber && <>FSSAI {props.fssaiLicenseNumber}</>}
              {props.fssaiLicenseNumber && props.gstin && ' · '}
              {props.gstin && <>GST {props.gstin}</>}
            </div>
          )}
        </div>

        {itemCount > 0 && (
          <CartBar count={itemCount} total={subtotal}
            onTap={() => setShowCheckout(true)} />
        )}

        <InfoModal
          open={showInfo}
          onClose={() => setShowInfo(false)}
          businessName={businessName}
          tagline={tagline}
          city={city}
          address={address}
          phone={props.phone}
          workingHours={workingHours}
          cuisineType={cuisineType}
          deliveryRadius={deliveryRadius}
          minimumOrder={minimumOrder}
          fssaiLicenseNumber={props.fssaiLicenseNumber}
          gstin={props.gstin}
        />

        {showCheckout && (
          <MobileCheckoutSheet
            businessName={businessName}
            itemCount={itemCount}
            mode={orderType} setMode={setOrderType}
            deliveryAvailable={deliveryAvailable} takeawayEnabled={takeawayEnabled} dineInEnabled={dineInEnabled}
            customerName={customerName} setCustomerName={setCustomerName}
            customerPhone={customerPhone} setCustomerPhone={setCustomerPhone}
            deliveryAddress={deliveryAddress} setDeliveryAddress={setDeliveryAddress}
            tableNumber={tableNumber} setTableNumber={setTableNumber}
            notes={notes} setNotes={setNotes}
            marketingOptIn={marketingOptIn} setMarketingOptIn={setMarketingOptIn}
            cartLines={cartLines} subtotal={subtotal}
            submitting={submitting} error={errorMsg}
            address={address}
            onSubmit={handleSubmit} onClose={() => setShowCheckout(false)}
          />
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '7px 12px', borderRadius: 999,
      background: active ? 'var(--zt-primary-soft)' : 'var(--zt-surface)',
      color: active ? 'var(--zt-primary-dark)' : 'var(--zt-ink-muted)',
      border: `0.5px solid ${active ? 'var(--zt-primary)' : 'var(--zt-border)'}`,
      fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
      transition: 'all .15s',
    }}>
      {children}
      {active && <I.check s={{ width: 12, height: 12, color: '#3F5736' }} />}
    </button>
  );
}

function DishCard({
  item, cart, bump,
}: { item: FlatItem; cart: Record<string, number>; bump: (k: string, d: number) => void }) {
  const hasVariants = item.sizes.length > 0;
  const singleQty = hasVariants ? 0 : cart[item.id] || 0;
  return (
    <div style={{
      background: 'var(--zt-surface)', border: '0.5px solid var(--zt-border)',
      borderRadius: 14, padding: 14, display: 'flex', gap: 12,
      boxShadow: '0 1px 3px rgba(40,55,30,.04)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <VegDot veg={item.isVeg} />
          {item.isBestseller && <BestsellerChip />}
        </div>
        <div style={{
          fontSize: 14.5, fontWeight: 700, color: 'var(--zt-ink)', lineHeight: 1.2,
          marginBottom: 4, letterSpacing: -.1,
        }}>{item.name}</div>
        {!hasVariants && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--zt-ink)' }}>{item.price}</span>
          </div>
        )}
        {item.description && (
          <div style={{
            fontSize: 12, color: 'var(--zt-ink-muted)', lineHeight: 1.4,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
          }}>{item.description}</div>
        )}
        {hasVariants && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
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
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <PhotoSlot size={86} label={item.name.split(' ')[0].toLowerCase()} />
        {!hasVariants && (
          <AddButton qty={singleQty} primary="#5C7A4F"
            onAdd={() => bump(item.id, 1)} onInc={() => bump(item.id, 1)} onDec={() => bump(item.id, -1)} />
        )}
      </div>
    </div>
  );
}

function CartBar({ count, total, onTap }: { count: number; total: number; onTap: () => void }) {
  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 14, zIndex: 20,
      pointerEvents: 'none',
    }}>
      <div style={{ maxWidth: 540, margin: '0 auto', padding: '0 12px', pointerEvents: 'none' }}>
        <button type="button" onClick={onTap} style={{
          width: '100%', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          background: 'linear-gradient(180deg, var(--zt-primary) 0%, var(--zt-primary-dark) 100%)',
          color: '#fff', borderRadius: 14, padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 10px 24px rgba(60,80,50,.28), 0 1px 0 rgba(255,255,255,.15) inset',
          pointerEvents: 'auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'rgba(255,255,255,.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><I.bag s={{ color: '#fff' }} /></div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                {count} {count === 1 ? 'item' : 'items'} · ₹{total}
              </div>
              <div style={{ fontSize: 10.5, opacity: .85, fontWeight: 500 }}>
                Extra charges shown at checkout
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700 }}>
            View cart <I.chevron s={{ color: '#fff' }} />
          </div>
        </button>
      </div>
    </div>
  );
}

function MobileCheckoutSheet(props: {
  businessName: string;
  itemCount: number;
  mode: OrderMode; setMode: (m: OrderMode) => void;
  deliveryAvailable: boolean; takeawayEnabled: boolean; dineInEnabled: boolean;
  customerName: string; setCustomerName: (v: string) => void;
  customerPhone: string; setCustomerPhone: (v: string) => void;
  deliveryAddress: string; setDeliveryAddress: (v: string) => void;
  tableNumber: string; setTableNumber: (v: string) => void;
  notes: string; setNotes: (v: string) => void;
  marketingOptIn: boolean; setMarketingOptIn: (v: boolean) => void;
  cartLines: Array<{ key: string; name: string; qty: number; unit: number; lineTotal: number; isVeg: boolean }>;
  subtotal: number;
  submitting: boolean; error: string | null;
  address?: string;
  onSubmit: () => void; onClose: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  const valid = props.customerName.trim().length > 0
    && props.customerPhone.replace(/\D/g, '').length >= 10
    && (props.mode === 'delivery' ? props.deliveryAddress.trim().length > 0
        : props.mode === 'dine_in' ? props.tableNumber.trim().length > 0
        : true);
  const enabledModes = [
    props.deliveryAvailable && 'delivery',
    props.takeawayEnabled && 'takeaway',
    props.dineInEnabled && 'dine_in',
  ].filter(Boolean) as OrderMode[];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: 'var(--zt-bg)', overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
    }}>
      <div style={{ maxWidth: 540, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          position: 'sticky', top: 0, zIndex: 1,
          padding: '14px 16px', background: 'var(--zt-surface)',
          borderBottom: '0.5px solid var(--zt-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <button type="button" onClick={props.onClose}
            aria-label="Back to menu"
            style={{
              width: 36, height: 36, borderRadius: 10,
              border: '0.5px solid var(--zt-border)', background: 'var(--zt-bg)',
              color: 'var(--zt-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', padding: 0,
            }}>
            <I.back />
          </button>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontFamily: 'var(--zt-font-display)', fontSize: 18, color: 'var(--zt-ink)' }}>
              Checkout
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--zt-ink-muted)', marginTop: 1 }}>
              {props.itemCount} {props.itemCount === 1 ? 'item' : 'items'} from {props.businessName}
            </div>
          </div>
          <div style={{ width: 36 }} />
        </div>

        <div style={{ flex: 1, padding: '16px 14px 120px' }}>
          <div style={{
            background: 'var(--zt-surface)', border: '0.5px solid var(--zt-border)',
            borderRadius: 14, padding: '4px 14px', marginBottom: 16,
          }}>
            {props.cartLines.map((it, i) => (
              <div key={it.key} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0',
                borderBottom: i < props.cartLines.length - 1 ? '0.5px solid var(--zt-border)' : 'none',
              }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <VegDot veg={it.isVeg} size={11} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: 'var(--zt-ink)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                    }}>{it.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--zt-ink-muted)' }}>
                      ₹{it.unit} × {it.qty}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--zt-ink)' }}>₹{it.lineTotal}</div>
              </div>
            ))}
          </div>

          {enabledModes.length > 1 && (
            <>
              <FieldLabel>How would you like it?</FieldLabel>
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${enabledModes.length}, 1fr)`,
                gap: 6, background: 'var(--zt-surface-2)', padding: 5, borderRadius: 12,
                border: '0.5px solid var(--zt-border)', marginBottom: 18,
              }}>
                {props.deliveryAvailable && (
                  <SegBtn icon={<I.scooter />} label="Delivery"
                    active={props.mode === 'delivery'} onClick={() => props.setMode('delivery')} />
                )}
                {props.takeawayEnabled && (
                  <SegBtn icon={<I.bag />} label="Takeaway"
                    active={props.mode === 'takeaway'} onClick={() => props.setMode('takeaway')} />
                )}
                {props.dineInEnabled && (
                  <SegBtn icon={<I.table />} label="Dine-in"
                    active={props.mode === 'dine_in'} onClick={() => props.setMode('dine_in')} />
                )}
              </div>
            </>
          )}

          <FieldM label="Your name" required>
            <input type="text" value={props.customerName}
              onChange={(e) => props.setCustomerName(e.target.value)}
              placeholder="Aapka naam" style={inputM} />
          </FieldM>
          <FieldM label="WhatsApp number" required>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{
                ...inputM, width: 64, display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: 'var(--zt-ink-muted)',
              }}>+91</div>
              <input type="tel" inputMode="numeric" value={props.customerPhone}
                onChange={(e) => props.setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="98765 43210"
                style={{ ...inputM, flex: 1 }} />
            </div>
          </FieldM>

          {props.mode === 'delivery' && (
            <FieldM label="Delivery address" required>
              <textarea value={props.deliveryAddress}
                onChange={(e) => props.setDeliveryAddress(e.target.value)}
                placeholder="House / flat no., street, landmark"
                rows={3}
                style={{ ...inputM, resize: 'none' as const, fontFamily: 'inherit', lineHeight: 1.5 }} />
            </FieldM>
          )}

          {props.mode === 'dine_in' && (
            <FieldM label="Table number" required hint="Look at your table card">
              <input type="text" value={props.tableNumber}
                onChange={(e) => props.setTableNumber(e.target.value)}
                placeholder="e.g. 7" style={inputM} />
            </FieldM>
          )}

          {props.mode === 'takeaway' && props.address && (
            <div style={{
              background: 'var(--zt-primary-soft)', border: '0.5px dashed var(--zt-primary)',
              borderRadius: 10, padding: '12px 14px', fontSize: 12.5,
              color: 'var(--zt-primary-dark)',
              display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16,
            }}>
              <I.bag s={{ color: '#3F5736', width: 14, height: 14 }} />
              <div>
                Pickup from <b>{props.address}</b>.<br />
                <span style={{ opacity: .8, fontSize: 11.5 }}>We&apos;ll WhatsApp you when ready</span>
              </div>
            </div>
          )}

          <FieldM label="Special instructions" hint="Spice level, allergies etc.">
            <textarea value={props.notes}
              onChange={(e) => props.setNotes(e.target.value)}
              placeholder="Less spicy, no onion…" rows={2}
              style={{ ...inputM, resize: 'none' as const, fontFamily: 'inherit' }} />
          </FieldM>

          <label style={{
            display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0',
            cursor: 'pointer', marginTop: 4, fontSize: 12, color: 'var(--zt-ink)',
            lineHeight: 1.4,
          }}>
            <input type="checkbox" checked={props.marketingOptIn}
              onChange={(e) => props.setMarketingOptIn(e.target.checked)}
              style={{ accentColor: 'var(--zt-primary)', marginTop: 2, flexShrink: 0 }} />
            <span>
              Send me offers from <b>{props.businessName}</b> on WhatsApp.
              <span style={{ color: 'var(--zt-ink-muted)', fontSize: 11, display: 'block', marginTop: 2 }}>
                Optional. Order confirmations sent regardless.
              </span>
            </span>
          </label>

          {props.error && (
            <div style={{
              padding: '10px 14px', borderRadius: 10,
              background: '#FEF2F2', border: '0.5px solid #FCA5A5', color: '#991B1B',
              fontSize: 12.5, marginTop: 12,
            }}>{props.error}</div>
          )}
        </div>

        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 2,
        }}>
          <div style={{
            maxWidth: 540, margin: '0 auto',
            padding: 12, background: 'var(--zt-surface)',
            borderTop: '0.5px solid var(--zt-border)',
            boxShadow: '0 -4px 16px rgba(40,55,30,.06)',
          }}>
            <button type="button" disabled={!valid || props.submitting} onClick={props.onSubmit} style={{
              width: '100%', padding: 14,
              background: !valid || props.submitting ? 'var(--zt-ink-muted)'
                : 'linear-gradient(180deg, var(--zt-primary) 0%, var(--zt-primary-dark) 100%)',
              color: '#fff', border: 'none', borderRadius: 12,
              fontSize: 14, fontWeight: 700,
              cursor: !valid || props.submitting ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              opacity: !valid || props.submitting ? .55 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: '0 4px 12px rgba(60,80,50,.25)',
            }}>
              {props.submitting ? 'Placing order…' : <>Place order · ₹{props.subtotal} <I.chevron s={{ color: '#fff' }} /></>}
            </button>
            <div style={{
              fontSize: 10.5, color: 'var(--zt-ink-muted)', textAlign: 'center', marginTop: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}>
              <I.whatsapp s={{ color: '#25D366', width: 11, height: 11 }} />
              Payment instructions arrive on WhatsApp
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SegBtn({
  icon, label, active, onClick,
}: { icon: ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '11px 6px', borderRadius: 9, border: 'none',
      background: active ? 'var(--zt-surface)' : 'transparent',
      color: active ? 'var(--zt-ink)' : 'var(--zt-ink-muted)',
      boxShadow: active ? '0 1px 3px rgba(40,55,30,.08), 0 0 0 0.5px var(--zt-border)' : 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      cursor: 'pointer', fontFamily: 'inherit',
      fontWeight: active ? 700 : 500, fontSize: 12.5,
    }}>
      <span style={{ color: active ? 'var(--zt-primary-dark)' : 'var(--zt-ink-muted)' }}>{icon}</span>
      {label}
    </button>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, color: 'var(--zt-ink-muted)',
      letterSpacing: .8, textTransform: 'uppercase', marginBottom: 8,
    }}>{children}</div>
  );
}

function FieldM({
  label, required, hint, children,
}: { label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6,
      }}>
        <label style={{
          fontSize: 11, fontWeight: 600, color: 'var(--zt-ink-muted)',
          letterSpacing: .6, textTransform: 'uppercase',
        }}>
          {label} {required && <span style={{ color: '#B91C1C' }}>*</span>}
        </label>
        {hint && <span style={{ fontSize: 10.5, color: 'var(--zt-ink-muted)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const inputM: CSSProperties = {
  width: '100%', padding: '11px 13px', borderRadius: 10,
  border: '0.5px solid var(--zt-border)', background: 'var(--zt-surface)',
  fontSize: 13.5, fontFamily: 'inherit', color: 'var(--zt-ink)',
  outline: 'none', boxSizing: 'border-box',
};

const iconBtnLight: CSSProperties = {
  width: 36, height: 36, borderRadius: 10,
  background: 'rgba(255,255,255,.16)', border: '0.5px solid rgba(255,255,255,.2)',
  color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', padding: 0,
};

const metaChip: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  fontSize: 11, color: 'var(--zt-ink-muted)', fontWeight: 500,
};
