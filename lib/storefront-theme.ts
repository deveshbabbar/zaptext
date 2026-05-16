// Storefront design tokens. Dark-first palette with a warm undertone so
// food photography pops and the page reads as "restaurant" not "SaaS
// dashboard." Light mode is provided as a secondary scheme; the public
// menu page defaults to DARK regardless of system preference because
// owners explicitly chose the dark-first direction (premium fine-dine
// vibe, distinct from the zaptext.shop landing).
//
// All colors expose two faces: a hex literal (for legacy inline styles
// during migration) and a CSS custom-property name (for the parts that
// have already been migrated). New components should use the CSS var
// names — existing inline-styled blocks read the hex constants during
// the gradual Phase 1→3 migration.
//
// Brand-color blending: when the owner sets `brandColor` in their
// settings we blend it sparingly — pure-color accents on CTAs, a 10%
// tint behind hero text shadow, and that's it. The neutral palette
// stays the same so two restaurants with different brand colors still
// feel like "ZapText storefronts" not like wildly different sites.

export interface ThemeColors {
  // Backgrounds
  bg: string;           // page background — the warm near-black
  surface: string;      // cards, cart sidebar — slightly lifted
  surfaceAlt: string;   // recessed (inputs, hover-out states)
  // Text
  text: string;         // primary copy — warm cream
  textMuted: string;    // secondary copy, captions
  textDim: string;      // tertiary (timestamps, micro-labels)
  // Lines + dividers
  border: string;       // subtle warm 1px lines
  borderStrong: string; // emphasis borders (focused inputs)
  // Semantic
  success: string;
  error: string;
  warning: string;
  info: string;         // muted info banners
  infoBg: string;
  infoText: string;
}

// Dark-first palette. The warm undertones (slight orange/brown tint) keep
// it from feeling like a sterile crypto-app dark theme — restaurant
// customers should feel cozy, not surveilled.
export const DARK: ThemeColors = {
  bg: '#0E0C0A',
  surface: '#1A1614',
  surfaceAlt: '#221D1A',
  text: '#F5EFE5',
  textMuted: '#A89A8B',
  textDim: '#6B5F54',
  border: '#2A2522',
  borderStrong: '#3A332E',
  success: '#22C55E',
  error: '#F87171',
  warning: '#FBBF24',
  info: '#60A5FA',
  infoBg: '#0F2640',
  infoText: '#93C5FD',
};

// Light scheme kept around for future opt-in. Not used by default.
export const LIGHT: ThemeColors = {
  bg: '#FBF8F3',
  surface: '#FFFFFF',
  surfaceAlt: '#F4EFE6',
  text: '#1A1410',
  textMuted: '#6B5F54',
  textDim: '#A89A8B',
  border: '#ECE5DA',
  borderStrong: '#D9CFC0',
  success: '#16A34A',
  error: '#DC2626',
  warning: '#D97706',
  info: '#2563EB',
  infoBg: '#E8F5FF',
  infoText: '#0A4A78',
};

// Default brand accent when the owner hasn't picked one. A warm
// terracotta orange that flatters most food photography and reads well
// on both dark and light backgrounds. Lighter and warmer than the bot's
// fallback `#111` so the storefront feels distinct from the dashboard.
export const DEFAULT_BRAND_ACCENT = '#E27D3B';

// Validate + normalise a user-supplied brand color. Falls back to the
// default accent when the input is empty / malformed.
export function resolveAccent(brandColor: string | undefined): string {
  if (!brandColor) return DEFAULT_BRAND_ACCENT;
  const v = brandColor.trim().toLowerCase();
  return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(v) ? v : DEFAULT_BRAND_ACCENT;
}

// Tighter helper used by the hero gradient and meta-pill backgrounds —
// returns the accent with an alpha suffix so we can layer it at low
// opacity without needing a colour-mixing library. Only 6-char hex is
// reliable for this; 3-char and 8-char inputs fall back to the default.
export function accentWithAlpha(brandColor: string | undefined, alphaHex: string): string {
  const base = resolveAccent(brandColor);
  if (/^#[0-9a-f]{6}$/.test(base)) return `${base}${alphaHex}`;
  return DEFAULT_BRAND_ACCENT + alphaHex;
}

// CSS variable names that ALL migrated components read. Defined once so
// a typo in one place is caught at compile time when consumers import
// from this enum rather than spelling 'var(--zt-bg)' themselves.
export const CSS_VARS = {
  bg: '--zt-bg',
  surface: '--zt-surface',
  surfaceAlt: '--zt-surface-alt',
  text: '--zt-text',
  textMuted: '--zt-text-muted',
  textDim: '--zt-text-dim',
  border: '--zt-border',
  borderStrong: '--zt-border-strong',
  success: '--zt-success',
  error: '--zt-error',
  warning: '--zt-warning',
  info: '--zt-info',
  infoBg: '--zt-info-bg',
  infoText: '--zt-info-text',
  accent: '--zt-accent',
  accentSoft: '--zt-accent-soft',
} as const;

// Build the inline-style object for the storefront theme wrapper. The
// caller spreads this onto a root <div> and every child inherits the
// CSS vars. We attach the brand-color-derived `--zt-accent` here too
// so item cards / cart buttons can reference `var(--zt-accent)` without
// each having to validate the brand color separately.
export function themeCssVars(brandColor: string | undefined): React.CSSProperties {
  const accent = resolveAccent(brandColor);
  return {
    [CSS_VARS.bg]: DARK.bg,
    [CSS_VARS.surface]: DARK.surface,
    [CSS_VARS.surfaceAlt]: DARK.surfaceAlt,
    [CSS_VARS.text]: DARK.text,
    [CSS_VARS.textMuted]: DARK.textMuted,
    [CSS_VARS.textDim]: DARK.textDim,
    [CSS_VARS.border]: DARK.border,
    [CSS_VARS.borderStrong]: DARK.borderStrong,
    [CSS_VARS.success]: DARK.success,
    [CSS_VARS.error]: DARK.error,
    [CSS_VARS.warning]: DARK.warning,
    [CSS_VARS.info]: DARK.info,
    [CSS_VARS.infoBg]: DARK.infoBg,
    [CSS_VARS.infoText]: DARK.infoText,
    [CSS_VARS.accent]: accent,
    [CSS_VARS.accentSoft]: accentWithAlpha(brandColor, '22'), // ~13% alpha
    // Page-level paint so the dark background extends past the content
    // edge on wide displays. Page bg + text + font stack inherit down.
    backgroundColor: DARK.bg,
    color: DARK.text,
    minHeight: '100vh',
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  } as React.CSSProperties;
}

// Helper for the hero overlay gradient — darker at the bottom for text
// legibility, with a hint of the brand color so each restaurant feels
// distinct without the gradient being garish. Pure black at 0%, mostly
// black with brand tint at 100%.
export function heroGradient(brandColor: string | undefined): string {
  const accentSoft = accentWithAlpha(brandColor, '33'); // ~20% alpha
  return `linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.55) 65%, ${accentSoft} 100%)`;
}

// Container max-width tokens. Mobile is unconstrained (page is full-
// bleed); we cap content width on tablet + desktop so menu/cart sit at
// readable line lengths instead of stretching across 4K monitors.
export const LAYOUT = {
  contentMaxWidth: 1280,
  contentPaddingMobile: 16,
  contentPaddingDesktop: 24,
  heroMaxHeight: 480, // cover photos taller than this get cropped
} as const;
