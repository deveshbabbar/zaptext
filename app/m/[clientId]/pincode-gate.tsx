'use client';

// Pincode-entry gate for the public storefront. Renders a full-screen
// overlay on first visit asking the customer for their pincode, then
// either:
//   (a) the pincode is in the owner's service_pincodes list → close the
//       overlay, save to localStorage, never show again for this slug
//   (b) the pincode isn't serviceable → show a "we don't deliver here
//       yet" panel with two outs: "try another pincode" or "browse
//       anyway" (takeaway / dine-in customers should still see the menu)
//   (c) customer skips entirely → store __skipped__ marker so we don't
//       nag them on every page reload
//
// Storage key is namespaced by the restaurant identifier so a customer
// who orders at two different restaurants doesn't carry their pincode
// from one to the other.
//
// Server pre-render: when no servicePincodes are configured (empty
// list), this component short-circuits to {children} immediately — no
// overlay, no localStorage read, no hydration mismatch.

import { useEffect, useState } from 'react';

const PINCODE_REGEX = /^[1-8]\d{5}$/;
const SKIP_MARKER = '__skipped__';

interface PincodeGateProps {
  // Slug or client_id of the restaurant — used to namespace the
  // localStorage key so the gate remembers per-restaurant.
  storageKey: string;
  businessName: string;
  servicePincodes: string[];
  children: React.ReactNode;
}

type GateState =
  | { phase: 'loading' }
  | { phase: 'asking'; error?: string }
  | { phase: 'unserviceable'; pincode: string }
  | { phase: 'open' };

export function PincodeGate({ storageKey, businessName, servicePincodes, children }: PincodeGateProps) {
  const enabled = servicePincodes.length > 0;
  const [state, setState] = useState<GateState>(
    enabled ? { phase: 'loading' } : { phase: 'open' }
  );
  const [input, setInput] = useState('');

  const lsKey = `zt-pincode-${storageKey}`;

  // Hydrate from localStorage on mount. Server already rendered children;
  // we just decide whether to overlay them with the modal.
  useEffect(() => {
    if (!enabled) return;
    try {
      const saved = window.localStorage.getItem(lsKey);
      if (saved === SKIP_MARKER) {
        setState({ phase: 'open' });
        return;
      }
      if (saved && servicePincodes.includes(saved)) {
        setState({ phase: 'open' });
        return;
      }
      // Saved-but-no-longer-serviceable: owner removed this pincode from
      // their list since the customer's last visit. Treat as fresh ask.
      setState({ phase: 'asking' });
    } catch {
      // localStorage disabled (privacy mode / SSR) — fall through to
      // asking but don't try to persist later.
      setState({ phase: 'asking' });
    }
  }, [enabled, lsKey, servicePincodes]);

  function save(value: string) {
    try {
      window.localStorage.setItem(lsKey, value);
    } catch {
      // ignore — gate still works in-session, just won't remember
    }
  }

  function handleCheck() {
    const pin = input.trim();
    if (!PINCODE_REGEX.test(pin)) {
      setState({ phase: 'asking', error: 'Please enter a valid 6-digit pincode' });
      return;
    }
    if (servicePincodes.includes(pin)) {
      save(pin);
      setState({ phase: 'open' });
    } else {
      setState({ phase: 'unserviceable', pincode: pin });
    }
  }

  function handleSkip() {
    save(SKIP_MARKER);
    setState({ phase: 'open' });
  }

  function handleTryAnother() {
    setInput('');
    setState({ phase: 'asking' });
  }

  // While loading or open, just render the menu. The overlay is purely
  // additive — it doesn't unmount the children, so cart / scroll state
  // is preserved if the gate ever re-appears (e.g. owner removes the
  // pincode from the serviceable list mid-session).
  if (state.phase === 'loading' || state.phase === 'open') {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pincode-gate-title"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 15, 15, 0.55)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: 18,
            padding: '28px 24px 22px',
            maxWidth: 420,
            width: '100%',
            boxShadow: '0 24px 80px rgba(0,0,0,.35)',
          }}
        >
          {state.phase === 'asking' ? (
            <>
              <div style={{ fontSize: 38, lineHeight: 1, marginBottom: 12 }}>📍</div>
              <h2 id="pincode-gate-title" style={{ fontSize: 19, fontWeight: 700, margin: '0 0 6px', color: '#111' }}>
                Check delivery to your area
              </h2>
              <p style={{ fontSize: 13.5, color: '#555', lineHeight: 1.5, margin: '0 0 16px' }}>
                {businessName} delivers to limited pincodes. Enter your 6-digit pincode to confirm —
                takeaway and dine-in are always available regardless.
              </p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  pattern="[1-8][0-9]{5}"
                  maxLength={6}
                  autoFocus
                  value={input}
                  onChange={(e) => setInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCheck();
                  }}
                  placeholder="110001"
                  aria-label="Pincode"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '12px 14px',
                    border: '1.5px solid #ddd',
                    borderRadius: 10,
                    fontSize: 16,
                    fontFamily: 'inherit',
                    letterSpacing: 1,
                  }}
                />
                <button
                  type="button"
                  onClick={handleCheck}
                  style={{
                    padding: '0 18px',
                    borderRadius: 10,
                    background: '#111',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  Check
                </button>
              </div>
              {state.error && (
                <p style={{ color: '#c1272d', fontSize: 12.5, margin: '4px 0 0' }}>{state.error}</p>
              )}
              <button
                type="button"
                onClick={handleSkip}
                style={{
                  marginTop: 14,
                  background: 'none',
                  border: 'none',
                  color: '#777',
                  fontSize: 12.5,
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Skip — I just want to browse / takeaway / dine-in
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 38, lineHeight: 1, marginBottom: 12 }}>😔</div>
              <h2 id="pincode-gate-title" style={{ fontSize: 19, fontWeight: 700, margin: '0 0 6px', color: '#111' }}>
                We don&apos;t deliver to {state.pincode} yet
              </h2>
              <p style={{ fontSize: 13.5, color: '#555', lineHeight: 1.5, margin: '0 0 18px' }}>
                {businessName} doesn&apos;t deliver to your pincode at the moment.
                You can still browse the menu for takeaway or dine-in.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleTryAnother}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 10,
                    background: '#fff',
                    color: '#111',
                    border: '1.5px solid #111',
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  Try another pincode
                </button>
                <button
                  type="button"
                  onClick={handleSkip}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 10,
                    background: '#111',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  Browse menu anyway →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
