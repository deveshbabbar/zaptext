'use client';

// Mobile-first menu + cart for restaurant customers reaching the public
// menu via a bot-shared link (no QR scan / no table). Three order modes:
// Delivery (asks for address), Takeaway (asks for pickup name), Dine-in
// (asks for table number). On submit hits /api/menu/submit which writes
// to dine_in_orders and sends a WhatsApp confirmation back to the
// customer's phone.

import { useMemo, useState } from 'react';

interface FlatItem {
  id: string;
  category: string;
  name: string;
  price: string;
  description: string;
  isVeg: boolean;
  isBestseller: boolean;
  sizes: Array<{ label: string; price: number }>;
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
}

type OrderMode = 'delivery' | 'takeaway' | 'dine_in';

function parsePrice(raw: string): number {
  const m = raw.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
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
}: Props) {
  const accent = brandColor && /^#[0-9a-fA-F]{3,8}$/.test(brandColor) ? brandColor : '#111';
  const [cart, setCart] = useState<Record<string, number>>({});
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState(prefillPhone);
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
                <textarea
                  placeholder="Delivery address with landmark / Address with landmark"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
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
                style={{ ...inputStyle, marginBottom: 0 }}
              />
            </div>
          </section>
        )}

        {error && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: '#fee', color: '#900', fontSize: 13 }}>{error}</div>
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
