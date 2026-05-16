'use client';

// Storefront design-system atoms. Lifted verbatim from the
// design-system files (`components.jsx`) the owner installed at the
// repo root, with .jsx → .tsx + TypeScript prop signatures + the
// `'use client'` directive so they can be imported by App-Router
// pages.
//
// Everything here is presentational. No data fetching, no business
// logic. Shared by mobile-view.tsx + desktop-view.tsx + the screen
// modals (cart, checkout, payment, tracking, info).
//
// CSS variables (--zt-bg, --zt-surface, --zt-ink, --zt-primary, etc.)
// are set by the root theme provider in menu-public-client.tsx so the
// atoms inherit them — see `storefrontThemeStyle()` at the bottom of
// this file for the var names + defaults.

import type { CSSProperties, ReactNode } from 'react';

type IconStyle = CSSProperties;

// ─────────────────────────── Icons (24-px viewBox, stroke-based)

export const I = {
  search: ({ s }: { s?: IconStyle } = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  ),
  back: ({ s }: { s?: IconStyle } = {}) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  ),
  close: ({ s }: { s?: IconStyle } = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  star: ({ s }: { s?: IconStyle } = {}) => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={s}>
      <path d="m12 2 3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14 2 9.27l6.91-1.01z" />
    </svg>
  ),
  info: ({ s }: { s?: IconStyle } = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-5M12 8h.01" />
    </svg>
  ),
  share: ({ s }: { s?: IconStyle } = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  ),
  chevron: ({ s }: { s?: IconStyle } = {}) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  ),
  chevronDown: ({ s }: { s?: IconStyle } = {}) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
  plus: ({ s }: { s?: IconStyle } = {}) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" style={s}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  minus: ({ s }: { s?: IconStyle } = {}) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" style={s}>
      <path d="M5 12h14" />
    </svg>
  ),
  cart: ({ s }: { s?: IconStyle } = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
    </svg>
  ),
  bag: ({ s }: { s?: IconStyle } = {}) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  ),
  scooter: ({ s }: { s?: IconStyle } = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <circle cx="5" cy="17" r="3" />
      <circle cx="19" cy="17" r="3" />
      <path d="M14 17H8M14 7h3l2 5-2 5M3 7h8l3 6" />
    </svg>
  ),
  table: ({ s }: { s?: IconStyle } = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <path d="M3 8h18M5 8v10M19 8v10M3 12h2M19 12h2" />
    </svg>
  ),
  whatsapp: ({ s }: { s?: IconStyle } = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={s}>
      <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.2-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.5-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.2-.3-.3-.6-.4Z" />
      <path d="M20.5 3.5A11.9 11.9 0 0 0 12 0C5.4 0 0 5.4 0 12c0 2.1.6 4.1 1.6 5.9L0 24l6.3-1.6a12 12 0 0 0 5.7 1.4c6.6 0 12-5.4 12-12 0-3.2-1.2-6.2-3.5-8.3ZM12 21.8c-1.8 0-3.6-.5-5.1-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.7 9.7 0 0 1 2.2 12c0-5.4 4.4-9.8 9.8-9.8 2.6 0 5.1 1 6.9 2.9a9.7 9.7 0 0 1 2.9 6.9c0 5.4-4.4 9.8-9.8 9.8Z" />
    </svg>
  ),
  spice: ({ s }: { s?: IconStyle } = {}) => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={s}>
      <path d="M11 2c0 4 3 6 3 9 0 1-1 2-3 2s-3-1-3-2C8 8 11 6 11 2Z" />
      <path d="M12 12c0 4 1 7 4 10-4 0-9-2-9-7 0-2 2-3 5-3Z" />
    </svg>
  ),
  clock: ({ s }: { s?: IconStyle } = {}) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  pin: ({ s }: { s?: IconStyle } = {}) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  check: ({ s }: { s?: IconStyle } = {}) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  phone: ({ s }: { s?: IconStyle } = {}) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1A19.5 19.5 0 0 1 5 13a19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 3.9 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8.1 9.6a16 16 0 0 0 6.3 6.3l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2.1Z" />
    </svg>
  ),
  filter: ({ s }: { s?: IconStyle } = {}) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  ),
  tag: ({ s }: { s?: IconStyle } = {}) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <path d="M20.5 12.5 12 21l-9-9V3h9Z" />
      <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" />
    </svg>
  ),
};

// ─────────────────────────── Veg / Non-veg dot

export function VegDot({ veg = true, size = 14 }: { veg?: boolean; size?: number }) {
  const color = veg ? '#2E7D32' : '#B91C1C';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        border: `1.5px solid ${color}`,
        borderRadius: 3,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: size * 0.45,
          height: size * 0.45,
          background: color,
          borderRadius: veg ? '50%' : 0,
        }}
      />
    </span>
  );
}

// ─────────────────────────── Star rating pill

export function RatingPill({
  rating,
  count,
  size = 'sm',
}: {
  rating?: number;
  count?: string | number;
  size?: 'sm' | 'lg';
}) {
  if (!rating) return null;
  const isLg = size === 'lg';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: '#F4F1E8',
        color: '#3F5736',
        padding: isLg ? '4px 8px' : '2px 7px',
        borderRadius: 6,
        fontSize: isLg ? 12 : 11,
        fontWeight: 600,
      }}
    >
      <I.star s={{ color: '#3F5736' }} />
      {rating}
      {count !== undefined && <span style={{ opacity: 0.55, fontWeight: 500 }}>({count})</span>}
    </span>
  );
}

// ─────────────────────────── Bestseller chip

export function BestsellerChip() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        background: 'linear-gradient(180deg,#FFF4E0,#FFE9C2)',
        color: '#7A4A14',
        border: '0.5px solid #E8C892',
        padding: '2px 7px',
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
      }}
    >
      <I.star s={{ color: '#C5803F', width: 9, height: 9 }} />
      Bestseller
    </span>
  );
}

// ─────────────────────────── Spice meter (chili icons)

export function SpiceMeter({ level }: { level?: number }) {
  if (!level) return null;
  return (
    <span style={{ display: 'inline-flex', gap: 1, color: '#B91C1C' }}>
      {Array.from({ length: level }).map((_, i) => (
        <I.spice key={i} />
      ))}
    </span>
  );
}

// ─────────────────────────── Photo placeholder (subtle striped)

export function PhotoSlot({
  size = 96,
  label = 'dish',
  rounded = 14,
}: {
  size?: number;
  label?: string;
  rounded?: number;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        flexShrink: 0,
        background: `repeating-linear-gradient(135deg, #F0EFE7 0 6px, #E8E6DA 6px 12px)`,
        border: '0.5px solid #E5E2D6',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 9,
          color: '#A39E8B',
          letterSpacing: 0.3,
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ─────────────────────────── Add / Quantity stepper

const qtyBtnStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#fff',
  width: 26,
  height: 28,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: 0,
};

export function AddButton({
  qty,
  onAdd,
  onInc,
  onDec,
  primary = '#5C7A4F',
}: {
  qty: number;
  onAdd?: () => void;
  onInc?: () => void;
  onDec?: () => void;
  primary?: string;
}) {
  if (qty > 0) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0,
          background: primary,
          color: '#fff',
          borderRadius: 10,
          height: 32,
          padding: '0 2px',
          boxShadow: '0 1px 0 rgba(0,0,0,.06)',
        }}
      >
        <button type="button" onClick={onDec} style={qtyBtnStyle} aria-label="Decrease">
          <I.minus />
        </button>
        <span style={{ width: 22, textAlign: 'center', fontSize: 13, fontWeight: 700 }}>{qty}</span>
        <button type="button" onClick={onInc} style={qtyBtnStyle} aria-label="Increase">
          <I.plus />
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onAdd}
      style={{
        height: 32,
        padding: '0 14px',
        borderRadius: 10,
        background: '#fff',
        color: primary,
        border: `1px solid ${primary}40`,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        cursor: 'pointer',
        boxShadow: '0 1px 2px rgba(0,0,0,.04)',
      }}
    >
      Add <span style={{ marginLeft: 2, opacity: 0.7 }}>+</span>
    </button>
  );
}

// ─────────────────────────── Subtle section divider

export function Hairline({ style = {} }: { style?: CSSProperties }) {
  return <div style={{ height: 1, background: '#ECEBE5', ...style }} />;
}

// ─────────────────────────── Bill row (used in cart + cart panel)

export function BillRow({
  label,
  value,
  valueStyle,
  sub,
}: {
  label: ReactNode;
  value: ReactNode;
  valueStyle?: CSSProperties;
  sub?: ReactNode;
}) {
  return (
    <div style={{ padding: '3px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12.5, color: '#1F2421' }}>
        <span style={{ color: '#6B7068' }}>{label}</span>
        <span style={{ fontWeight: 600, ...valueStyle }}>{value}</span>
      </div>
      {sub && <div style={{ fontSize: 10.5, color: '#9DA39B', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

// ─────────────────────────── Root theme CSS variables
//
// Spread the return of this onto the root storefront <div>; every child
// component reads var(--zt-*). Owner-provided brandColor overrides the
// default sage primary. Default palette = Sage (matches the design files).

const SAGE: [string, string, string] = ['#5C7A4F', '#3F5736', '#E7EFE1'];

function isValidHex(h: string): boolean {
  return /^#[0-9a-f]{3,8}$/i.test(h);
}

// Light-tint a brand color for primary-soft surfaces by appending a low
// alpha — relies on the surface underneath being white. Falls back to the
// sage soft (#E7EFE1) when the brand color is missing or malformed.
function softTint(base: string | undefined): string {
  if (!base || !isValidHex(base)) return SAGE[2];
  const m6 = base.match(/^#([0-9a-f]{6})$/i);
  if (m6) return `${base}1F`;
  return SAGE[2];
}

// Note: brandColor is intentionally IGNORED in the current build — the
// design system specifies the sage palette exactly and the owner asked
// for "bilkul aisa bana do, there should be no changes made in this
// design." Palette selection (sage / forest / olive / charcoal /
// terracotta) is a planned D4 task that will let owners pick from a
// fixed set rather than feed an arbitrary hex.
export function storefrontThemeStyle(_brandColor: string | undefined): CSSProperties {
  const primary = SAGE[0];
  const primaryDark = SAGE[1];
  const primarySoft = SAGE[2];
  return {
    ['--zt-bg' as string]: '#FAFAF6',
    ['--zt-surface' as string]: '#FFFFFF',
    ['--zt-surface-2' as string]: '#F4F1E8',
    ['--zt-ink' as string]: '#1F2421',
    ['--zt-ink-muted' as string]: '#6B7068',
    ['--zt-border' as string]: '#ECEBE5',
    ['--zt-primary' as string]: primary,
    ['--zt-primary-dark' as string]: primaryDark,
    ['--zt-primary-soft' as string]: primarySoft,
    ['--zt-accent' as string]: '#C58940',
    ['--zt-font-display' as string]: '"Instrument Serif", Georgia, serif',
    ['--zt-font-body' as string]: '"Plus Jakarta Sans", system-ui, sans-serif',
    backgroundColor: '#FAFAF6',
    color: '#1F2421',
    fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
    minHeight: '100vh',
  };
}
