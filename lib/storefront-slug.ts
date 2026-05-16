// Shared storefront-slug rules. Imported by:
//   - middleware.ts (subdomain detection at the edge)
//   - app/api/client/restaurant/storefront/route.ts (slug edit endpoint)
//
// Both must agree on what's a legal subdomain and what's reserved, otherwise
// the API could accept a slug that the middleware then refuses to route, or
// vice-versa. Keep all DNS-label-level rules in this one file.

export const APP_DOMAIN = 'zaptext.shop';

// Subdomains that must NEVER be assigned to a tenant — they collide with
// platform routes, common admin/staging hosts, or are too generic to be a
// recognisable brand. The middleware refuses to rewrite these to /m/<slug>;
// the API refuses to save them. Edit in one place; both layers update.
export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
  'www',
  'app',
  'api',
  'admin',
  'dashboard',
  'm',
  'static',
  'cdn',
  'mail',
  'staging',
  'preview',
  'dev',
  'test',
]);

// DNS-label rules: lowercase alphanumeric + hyphens, must start with an
// alphanumeric (no leading hyphen), 1–63 characters. We cap at 63 to fit
// the DNS-label max even though our DB column allows 80 (the extra room is
// just for safety margin around collision-suffix backfill).
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,62}$/;

export function isValidSlug(slug: string): boolean {
  if (typeof slug !== 'string') return false;
  const s = slug.trim().toLowerCase();
  if (!s) return false;
  if (s.endsWith('-')) return false; // disallow trailing hyphen
  return SLUG_REGEX.test(s);
}

export function slugIsReserved(slug: string): boolean {
  return RESERVED_SUBDOMAINS.has(slug.trim().toLowerCase());
}

// Normalise free-text into a slug candidate. Used by the API to suggest a
// slug when the owner clears their input, and by the settings UI's
// "auto-suggest from business name" button.
export function suggestSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// Build the public storefront URL for a given slug. Used by the settings UI
// to render a copy-link button. Always https because Vercel auto-issues
// certs for the wildcard.
export function storefrontUrlFor(slug: string): string {
  return `https://${slug}.${APP_DOMAIN}`;
}

// ─── Bot menu-link emission ─────────────────────────────────────────────
//
// Decides which URL the WhatsApp bot should send when a customer asks for
// the menu. There are two surfaces today and we want the bot to prefer the
// "nice" one when the owner has opted in:
//
//   1. <slug>.zaptext.shop                  (storefront subdomain — opted-in)
//   2. https://www.zaptext.shop/m/<clientId> (legacy bot link — always works)
//
// Subdomain URL is only safe to emit when BOTH:
//   - the client has a non-empty `slug` value (i.e. a DNS name is reserved)
//   - the client has `storefront_enabled = true` (owner flipped the toggle)
//
// If either condition is missing the page would 404 (the subdomain gate in
// /m/[clientId]/page.tsx returns notFound when the request arrived via
// x-storefront-host and storefront_enabled is false), and we'd rather send
// a working legacy link than a broken pretty one.
//
// The `appOrigin` parameter is the configured NEXT_PUBLIC_APP_URL — passed
// in instead of read from env here so this helper stays env-free + testable.

export interface MenuLinkClient {
  client_id: string;
  slug?: string | null;
  storefront_enabled?: boolean | null;
}

export interface MenuLinkOptions {
  /** Site origin for the legacy /m/<clientId> fallback. Strip trailing slash. */
  appOrigin: string;
  /** Optional query params appended to the URL (`?p=...&q=...&new=1`). */
  query?: URLSearchParams;
}

export function buildPublicMenuUrl(client: MenuLinkClient, opts: MenuLinkOptions): string {
  const qs = opts.query?.toString() || '';
  const suffix = qs ? `?${qs}` : '';
  const slug = (client.slug || '').trim().toLowerCase();
  const enabled = Boolean(client.storefront_enabled);
  if (slug && enabled && isValidSlug(slug) && !slugIsReserved(slug)) {
    return `${storefrontUrlFor(slug)}/${suffix}`;
  }
  const origin = opts.appOrigin.replace(/\/+$/, '');
  return `${origin}/m/${client.client_id}${suffix}`;
}
