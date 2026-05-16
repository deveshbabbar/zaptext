'use client';

// Order tracking screen — shown after a successful order submit on both
// desktop and mobile. Ports the design's TrackingScreen + TrackingModal
// timeline (other-screens.jsx + desktop-modals.jsx) into a single shared
// component that adapts to viewport via the parent's layout.
//
// Visual-only in D3: the timeline auto-progresses
//   placed → accepted → preparing → (out, for delivery) → delivered
// on a setTimeout cadence, matching the demo behaviour. Real status
// updates come via WhatsApp; a future D3.1 can wire polling against
// dine_in_orders.status if customers want live in-page updates too.

import { useEffect, useState, type ReactNode } from 'react';
import { I, storefrontThemeStyle } from './atoms';

type OrderMode = 'delivery' | 'takeaway' | 'dine_in';
type Status = 'placed' | 'accepted' | 'preparing' | 'out' | 'delivered';

interface Step {
  key: Status;
  label: string;
  caption: string;
  icon: ReactNode;
}

const DELIVERY_STEPS: Step[] = [
  { key: 'placed',    label: 'Order placed',    caption: 'We received your order', icon: <I.check /> },
  { key: 'accepted',  label: 'Kitchen accepted', caption: 'Confirmed by the kitchen', icon: <I.check /> },
  { key: 'preparing', label: 'Preparing',       caption: 'Chefs on it — about 15-20 min', icon: <I.clock /> },
  { key: 'out',       label: 'Out for delivery', caption: 'Rider has picked it up', icon: <I.scooter /> },
  { key: 'delivered', label: 'Delivered',       caption: 'Enjoy! ✨', icon: <I.check /> },
];

const PICKUP_STEPS: Step[] = [
  { key: 'placed',    label: 'Order placed',    caption: 'We received your order', icon: <I.check /> },
  { key: 'accepted',  label: 'Kitchen accepted', caption: 'Confirmed by the kitchen', icon: <I.check /> },
  { key: 'preparing', label: 'Preparing',       caption: 'Chefs on it — about 15 min', icon: <I.clock /> },
  { key: 'delivered', label: 'Ready for pickup', caption: 'Come collect your order', icon: <I.bag /> },
];

const DINEIN_STEPS: Step[] = [
  { key: 'placed',    label: 'Order placed',    caption: 'We received your order', icon: <I.check /> },
  { key: 'accepted',  label: 'Kitchen accepted', caption: 'Confirmed by the kitchen', icon: <I.check /> },
  { key: 'preparing', label: 'Preparing',       caption: 'Chefs on it', icon: <I.clock /> },
  { key: 'delivered', label: 'Served at table', caption: 'Enjoy your meal! ✨', icon: <I.table /> },
];

function stepsForMode(mode: OrderMode): Step[] {
  if (mode === 'delivery') return DELIVERY_STEPS;
  if (mode === 'takeaway') return PICKUP_STEPS;
  return DINEIN_STEPS;
}

export interface TrackingScreenProps {
  orderId: string;
  total: number;
  mode: OrderMode;
  /** Table number for dine-in orders. Surfaced in the header copy. */
  tableNumber?: string;
  businessName: string;
  palette?: string;
  onOrderMore: () => void;
}

export function TrackingScreen(props: TrackingScreenProps) {
  const steps = stepsForMode(props.mode);
  const [status, setStatus] = useState<Status>('placed');

  // Auto-progress for visual polish. Each step lands ~3.2s after the
  // previous — matches the design's demo behaviour.
  useEffect(() => {
    const idx = steps.findIndex((s) => s.key === status);
    if (idx >= steps.length - 1) return;
    const t = setTimeout(() => setStatus(steps[idx + 1].key), 3200);
    return () => clearTimeout(t);
  }, [status, steps]);

  const currentIdx = steps.findIndex((s) => s.key === status);

  const modeHeading =
    props.mode === 'delivery' ? 'Coming to you'
    : props.mode === 'takeaway' ? 'Ready soon for pickup'
    : `Table ${props.tableNumber || ''}`.trim();

  return (
    <div style={storefrontThemeStyle(undefined, props.palette)}>
      <div style={{
        maxWidth: 720, margin: '0 auto',
        padding: 'clamp(28px, 5vw, 60px) 20px 80px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 72, height: 72, borderRadius: '50%',
            background: 'var(--zt-primary-soft)',
            color: 'var(--zt-primary-dark)',
            marginBottom: 14, fontSize: 36,
          }}>
            ✅
          </div>
          <h1 style={{
            fontFamily: 'var(--zt-font-display)', fontSize: 'clamp(28px, 4vw, 38px)',
            margin: 0, color: 'var(--zt-ink)', letterSpacing: -0.3,
          }}>
            Order placed!
          </h1>
          <p style={{
            color: 'var(--zt-ink-muted)', fontSize: 14,
            margin: '8px 0 4px',
          }}>
            {modeHeading} · <b style={{ color: 'var(--zt-ink)' }}>₹{props.total.toFixed(0)}</b>
          </p>
          {props.orderId && (
            <p style={{
              color: 'var(--zt-ink-muted)', fontSize: 11.5,
              margin: '2px 0 0', fontFamily: 'ui-monospace, monospace',
              letterSpacing: 0.3,
            }}>
              Order #{props.orderId.slice(0, 8).toUpperCase()}
            </p>
          )}
        </div>

        <div style={{
          background: 'var(--zt-surface)', border: '0.5px solid var(--zt-border)',
          borderRadius: 16, padding: '20px 20px 8px',
          boxShadow: '0 4px 14px rgba(40,55,30,.04)',
        }}>
          {steps.map((step, i) => {
            const isPast = i < currentIdx;
            const isActive = i === currentIdx;
            const isFuture = i > currentIdx;
            return (
              <TimelineRow
                key={step.key}
                step={step}
                isPast={isPast}
                isActive={isActive}
                isFuture={isFuture}
                showConnector={i < steps.length - 1}
              />
            );
          })}
        </div>

        <div style={{
          marginTop: 14, padding: '12px 14px',
          background: '#E7F4EB', border: '0.5px solid #B6DAB8',
          borderRadius: 12, display: 'flex', gap: 10, alignItems: 'center',
        }}>
          <I.whatsapp s={{ color: '#25D366', width: 18, height: 18 }} />
          <div style={{ fontSize: 12.5, color: '#1B5E20', lineHeight: 1.45 }}>
            Real-time updates land in your WhatsApp. Reply <b>STATUS</b> to {props.businessName} any time.
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 28 }}>
          <button type="button" onClick={props.onOrderMore} style={{
            padding: '12px 26px', borderRadius: 999,
            background: 'var(--zt-primary)', color: '#fff',
            border: 'none', fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: '0 4px 12px rgba(60,80,50,.18)',
          }}>
            Order more
          </button>
        </div>
      </div>
    </div>
  );
}

function TimelineRow({
  step, isPast, isActive, isFuture, showConnector,
}: {
  step: Step; isPast: boolean; isActive: boolean; isFuture: boolean; showConnector: boolean;
}) {
  const dotBg = isPast || isActive ? 'var(--zt-primary)' : 'var(--zt-surface)';
  const dotBorder = isPast || isActive ? 'var(--zt-primary)' : 'var(--zt-border)';
  const dotShadow = isActive ? '0 0 0 4px var(--zt-primary-soft)' : 'none';
  const dotColor = isPast || isActive ? '#fff' : 'var(--zt-ink-muted)';
  const labelColor = isFuture ? 'var(--zt-ink-muted)' : 'var(--zt-ink)';
  const labelWeight = isActive ? 700 : 600;

  return (
    <div style={{ display: 'flex', gap: 14, paddingBottom: showConnector ? 0 : 12 }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        flexShrink: 0,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: dotBg,
          border: `1.5px solid ${dotBorder}`,
          boxShadow: dotShadow,
          color: dotColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background .25s, box-shadow .25s',
        }}>
          {isPast ? <I.check /> : step.icon}
        </div>
        {showConnector && (
          <div style={{
            width: 2, flex: 1, minHeight: 28,
            background: isPast
              ? 'var(--zt-primary)'
              : isActive
                ? 'linear-gradient(180deg, var(--zt-primary), var(--zt-border))'
                : 'var(--zt-border)',
            marginTop: 2,
            transition: 'background .25s',
          }} />
        )}
      </div>
      <div style={{ flex: 1, paddingBottom: showConnector ? 18 : 0, paddingTop: 4 }}>
        <div style={{
          fontSize: 14, fontWeight: labelWeight, color: labelColor,
          letterSpacing: -0.1, marginBottom: 2,
          transition: 'color .25s',
        }}>
          {step.label}
        </div>
        <div style={{
          fontSize: 12, color: 'var(--zt-ink-muted)', lineHeight: 1.4,
        }}>
          {step.caption}
        </div>
      </div>
    </div>
  );
}
