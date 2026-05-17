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

// ─────────────────────────── Photo placeholder (emoji + warm gradient)
//
// Replaces the old monospace-label-on-grey-stripes placeholder. We now
// pick a food emoji + a warm gradient based on the dish name. This makes
// the storefront look approachable on first paint even before the owner
// has uploaded real photography. Keyword → emoji table is biased toward
// Indian + popular global cuisine so most owners get a sensible visual
// for free; unknown names fall back to a plate emoji on a neutral cream.

interface EmojiMatch {
  emoji: string;
  /** Two-stop gradient. First color is the main brand-warm tone, second
   *  is a deeper variant for the diagonal fade. Picked to feel like
   *  food packaging — never neon, never pastel-baby. */
  gradient: [string, string];
  /** When true, the dot in the centre uses a subtle inner shadow so the
   *  emoji sits in a "spot" rather than floating. Set on richer food
   *  categories (curry / biryani) where the bowl shape reads well. */
  bowl?: boolean;
}

// Order is hierarchical from most-specific dish CATEGORY → ingredient →
// generic. The key insight: "Chicken Biryani" should be 🍚 (rice dish),
// not 🍗 (chicken). "Tandoori Roti" should be 🫓 (bread), not 🍗
// (chicken). "Sweet Lassi" should be 🥤 (drink), not 🍮 (dessert).
// So beverages + named dish categories come FIRST, ingredient/protein
// modifiers come AFTER, and the generic catch-alls come last.
const EMOJI_RULES: Array<[RegExp, EmojiMatch]> = [
  // ── 1. Beverages (run first — owners prefix with "Masala"/"Sweet"/etc.) ───
  [/\b(masala chai|chai|tea)\b/i, { emoji: '🍵', gradient: ['#E8C89C', '#A87545'] }],
  [/\b(coffee|espresso|latte|cappuccino|mocha|americano)\b/i,
    { emoji: '☕', gradient: ['#D4A77A', '#7C4B2A'] }],
  [/\b(lassi|chaas|buttermilk|smoothie|shake|milkshake|thandai)\b/i,
    { emoji: '🥤', gradient: ['#FFD8E0', '#E08BA1'] }],
  [/\b(juice|sharbat|nimbu|lemonade|cooler|mocktail|jaljeera|aam panna)\b/i,
    { emoji: '🧃', gradient: ['#FFD18A', '#E6852E'] }],
  [/\b(beer|wine|cocktail|whisky|whiskey|rum|vodka|gin)\b/i,
    { emoji: '🍹', gradient: ['#FFB179', '#D86A2E'] }],
  [/\b(water|bisleri|aquafina|bottled)\b/i, { emoji: '💧', gradient: ['#C5E5F0', '#7BB0C7'] }],

  // ── 2. Named dish categories (beat ingredient modifiers like chicken/mutton/tandoori) ──
  // Biryani BEFORE chicken/mutton/egg — "Chicken Hyderabadi Biryani" → 🍚.
  [/\b(biryani|biriyani|pulao|pulav|fried rice|jeera rice|khichdi|khichri)\b/i,
    { emoji: '🍚', gradient: ['#FFE0B2', '#E8A95C'], bowl: true }],
  // Bread BEFORE tandoori — "Tandoori Roti" → 🫓.
  [/\b(naan|roti|chapati|paratha|kulcha|bhatura|puri|poori|phulka|rumali|bread loaf)\b/i,
    { emoji: '🫓', gradient: ['#FFE8C2', '#E6B86A'] }],
  [/\b(dosa|uttapam|uttappam|appam)\b/i, { emoji: '🥞', gradient: ['#FFE4A0', '#D9A04A'] }],
  [/\b(idli|medu vada|sambar idli)\b/i, { emoji: '🥟', gradient: ['#F4E1C1', '#C99A55'], bowl: true }],
  [/\b(pizza|margherita|focaccia)\b/i, { emoji: '🍕', gradient: ['#FFC7A0', '#E55B2D'] }],
  [/\b(burger|sandwich|sub|wrap)\b/i, { emoji: '🍔', gradient: ['#FFCB8A', '#D08440'] }],
  [/\b(pasta|spaghetti|noodle|noodles|hakka|maggi|ramen|chow mein|chowmein)\b/i,
    { emoji: '🍜', gradient: ['#FFD391', '#D8923D'], bowl: true }],
  [/\b(taco|burrito|quesadilla)\b/i, { emoji: '🌮', gradient: ['#FFC07A', '#E08137'] }],
  [/\b(fries|chips|wedges)\b/i, { emoji: '🍟', gradient: ['#FFD899', '#E2A24F'] }],
  [/\b(chaat|pani puri|gol gappa|bhel|sev puri|aloo tikki|dahi puri)\b/i,
    { emoji: '🌮', gradient: ['#FFB783', '#E27735'] }],
  [/\b(samosa|kachori|pakora|pakoda|bhajiya|bhaji)\b/i,
    { emoji: '🥟', gradient: ['#F4C57B', '#D88C2A'] }],
  [/\b(spring roll|momo|dimsum|dim sum|wonton)\b/i, { emoji: '🥟', gradient: ['#EFD9A8', '#C5934C'] }],

  // ── 3. Specific desserts (BEFORE the catch-all "sweet" keyword has any chance) ──
  // "Sweet Lassi" already matched #1; the only items left are real desserts.
  [/\b(ice cream|kulfi|falooda|gelato|sundae|sorbet|softy)\b/i,
    { emoji: '🍦', gradient: ['#FFD6E1', '#E89AB2'] }],
  [/\b(cake|pastry|brownie|cupcake|muffin|cheesecake|tiramisu|donut|doughnut)\b/i,
    { emoji: '🍰', gradient: ['#FFCFD8', '#E27E92'] }],
  [/\b(gulab jamun|gulabjamun|jamun|jalebi|rasgulla|rasmalai|barfi|laddu|ladoo|halwa|kheer|firni|payasam|peda|mysore pak)\b/i,
    { emoji: '🍩', gradient: ['#FFC58A', '#D9852E'] }],
  [/\b(chocolate|cocoa|fudge)\b/i, { emoji: '🍫', gradient: ['#D2A682', '#85553A'] }],

  // ── 4. Salads (beat the generic curry/masala catch-all) ──
  [/\b(salad|kachumber|raita)\b/i, { emoji: '🥗', gradient: ['#C8E6A6', '#7CB04D'] }],

  // ── 5. Proteins / ingredients (paneer BEFORE tikka so "Paneer Tikka" → 🧀) ──
  [/\b(paneer|tofu|cottage cheese)\b/i, { emoji: '🧀', gradient: ['#FFF1B8', '#F2C94C'] }],
  [/\b(mushroom|champignon)\b/i, { emoji: '🍄', gradient: ['#D6BFA8', '#A88B6B'] }],
  [/\b(prawn|shrimp|lobster|crab)\b/i, { emoji: '🦐', gradient: ['#FFC78C', '#FF8A3D'] }],
  [/\b(fish|pomfret|rohu|salmon|tuna|seafood|surmai|bangda)\b/i,
    { emoji: '🐟', gradient: ['#AED9E0', '#5C9EAD'] }],
  [/\b(egg|anda|omelette|omelet|bhurji|akuri)\b/i,
    { emoji: '🍳', gradient: ['#FFE4A8', '#F4B860'] }],
  [/\b(mutton|lamb|goat|keema|kheema|seekh)\b/i,
    { emoji: '🍖', gradient: ['#E8A990', '#C26B4F'] }],
  [/\b(chicken|murg|murgh|tandoori|tikka|kebab|kabab|65)\b/i,
    { emoji: '🍗', gradient: ['#FFB87A', '#E56B2E'] }],

  // ── 6. Generic catch-alls (curry / dal / soup) ──
  [/\b(curry|gravy|masala|makhani|kadai|kadhai|korma|qorma|dal|daal|lentil|sambar|sambhar)\b/i,
    { emoji: '🍛', gradient: ['#FFAA66', '#D9591B'], bowl: true }],
  [/\b(soup|shorba|broth)\b/i, { emoji: '🍲', gradient: ['#FFC089', '#D87A2A'], bowl: true }],
  // Plain "rice" only catches when no biryani/pulao/khichdi already matched.
  [/\b(rice|steamed rice)\b/i, { emoji: '🍚', gradient: ['#FFE0B2', '#E8A95C'], bowl: true }],

  // ── 7. Fruits ──
  [/\b(apple|fruit|banana|mango|orange|watermelon|grape|guava|papaya|pineapple)\b/i,
    { emoji: '🍎', gradient: ['#FFC7C5', '#E37576'] }],
];

const FALLBACK: EmojiMatch = { emoji: '🍽️', gradient: ['#F4E6C3', '#D9B872'] };

// Deterministic so the same dish always gets the same look — server and
// client SSR produce identical markup.
function pickEmoji(name: string): EmojiMatch {
  const s = (name || '').toLowerCase();
  for (const [re, m] of EMOJI_RULES) if (re.test(s)) return m;
  return FALLBACK;
}

export function PhotoSlot({
  size = 96,
  label = 'dish',
  rounded = 14,
}: {
  size?: number;
  label?: string;
  rounded?: number;
}) {
  const m = pickEmoji(label);
  // Emoji sized at ~58% of the tile so it has visual weight without
  // touching the rounded corners. The bowl variant uses a soft inset
  // shadow + slightly lower emoji position so it looks like the food's
  // sitting in a vessel.
  const emojiSize = Math.round(size * 0.58);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        flexShrink: 0,
        background: `linear-gradient(135deg, ${m.gradient[0]} 0%, ${m.gradient[1]} 100%)`,
        border: '0.5px solid rgba(0,0,0,.06)',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: m.bowl
          ? 'inset 0 -8px 18px rgba(0,0,0,.10), inset 0 1px 0 rgba(255,255,255,.20)'
          : 'inset 0 1px 0 rgba(255,255,255,.22), inset 0 -4px 12px rgba(0,0,0,.06)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: emojiSize,
          // System emoji stack — Apple, Google, Microsoft, fallback.
          fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", system-ui, sans-serif',
          lineHeight: 1,
          // Slight drop shadow so emojis pop on warmer gradients.
          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.18))',
          // Lower the emoji slightly when rendered in a "bowl" so it
          // sits in the bottom half of the tile (like food in a vessel).
          paddingTop: m.bowl ? `${Math.round(size * 0.08)}px` : 0,
        }}
      >
        {m.emoji}
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
// component reads var(--zt-*). Owner picks one of 5 named palettes (see
// PALETTES below) — the design files specify exactly these five and no
// more. Free-form brandColor is ignored (was an earlier exploration);
// owners pick a palette by name in /client/restaurant/storefront.

// Named palettes from desktop-app.jsx::D_PALETTES + app.jsx::PALETTES in
// the design files at the repo root. Each tuple is [primary, dark, soft]:
//   - primary is the main accent (gradient start, CTAs, active states)
//   - dark   is the gradient end + hover / pressed states
//   - soft   is the wash colour for active filter chips + faint surfaces
// Sage is the default — matches what we've been shipping since D1.
export const PALETTES: Record<string, readonly [string, string, string]> = {
  sage:        ['#5C7A4F', '#3F5736', '#E7EFE1'],
  forest:      ['#2F5D3A', '#1F3D26', '#DCE9DA'],
  olive:       ['#7A8540', '#54592D', '#EFF0DE'],
  charcoal:    ['#3D4744', '#1F2421', '#E5E5E1'],
  terracotta:  ['#B5664A', '#7A3F2A', '#F3E2D4'],
};

// Friendly display labels for the settings UI palette picker — keep the
// keys above stable (they're persisted to knowledge_base_json) while the
// labels can evolve without a migration.
export const PALETTE_LABELS: Record<string, string> = {
  sage: 'Sage',
  forest: 'Forest',
  olive: 'Olive',
  charcoal: 'Charcoal',
  terracotta: 'Terracotta',
};

export type PaletteName = keyof typeof PALETTES;

// Resolve a palette name to its colour tuple. Any unknown / undefined
// input falls back to sage so a typo or stale value can never break the
// storefront paint.
function resolvePalette(name: string | undefined): readonly [string, string, string] {
  if (!name) return PALETTES.sage;
  const v = name.trim().toLowerCase();
  return PALETTES[v] ?? PALETTES.sage;
}

// Public lookup: components outside atoms.tsx use this when they need
// raw hex values (the settings page previews the chosen palette before
// the owner hits save).
export function getPaletteColors(name: string | undefined): readonly [string, string, string] {
  return resolvePalette(name);
}

export function storefrontThemeStyle(
  _brandColor: string | undefined,
  paletteName?: string,
): CSSProperties {
  const [primary, primaryDark, primarySoft] = resolvePalette(paletteName);
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
