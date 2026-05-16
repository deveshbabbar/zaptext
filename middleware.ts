import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse, type NextRequest } from 'next/server';
import { APP_DOMAIN, RESERVED_SUBDOMAINS } from '@/lib/storefront-slug';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhook(.*)',
  '/api/cron(.*)',
  // Public-facing API endpoints (no auth) — the demo-bot lookup powers
  // the floating "Try the live demo" widget on the landing page, so it
  // must be reachable to anonymous visitors. Any future /api/public/*
  // route is unauth by convention.
  '/api/public(.*)',
  // Customer-facing menu / dine-in surfaces. Anonymous visitors land
  // here from a WhatsApp link or QR scan — they MUST NOT be redirected
  // to sign-in. The menu page itself reads only the restaurant's own
  // public KB; the submit endpoint rate-limits + validates per-client.
  '/m(.*)',
  '/api/menu(.*)',
  '/api/dine-in(.*)',
  // Vertical landing pages — SEO + ad-funnel destinations. Anonymous
  // visitors land here from Google / Instagram / Facebook ads and must
  // see the page, not a sign-in redirect.
  '/(restaurant|tiffin|salon|gym|coaching|realestate|d2c)',
  '/privacy',
  '/terms',
  '/refund',
  '/cancellation',
  '/contact',
  '/about',
]);

// Storefront subdomain support. A host like `bigchillicafe.zaptext.shop`
// is rewritten to `/m/bigchillicafe/...` so the existing public ordering
// page handles it. Reserved subdomains (www, app, api, etc.) and the
// apex domain fall through to normal routing. Constants are imported from
// lib/storefront-slug.ts so the settings API and this edge runtime agree.

// Header attached to subdomain rewrites so the rewritten page can tell
// "did this request arrive via <slug>.zaptext.shop?" vs a legacy /m/<id>
// link from the bot. The page uses this to enforce storefront_enabled:
// subdomain visits are gated, direct /m/<id> visits are not (since the
// bot only emits those links to active customers anyway).
const STOREFRONT_HOST_HEADER = 'x-storefront-host';

function detectStorefrontSlug(req: NextRequest): string | null {
  const host = (req.headers.get('host') || '').split(':')[0].toLowerCase();
  // Vercel preview/dev hosts: `*.vercel.app` and `localhost` never match —
  // we only rewrite on the production app domain.
  if (!host.endsWith('.' + APP_DOMAIN)) return null;
  const sub = host.slice(0, -('.' + APP_DOMAIN).length);
  // Single-level subdomains only — reject `foo.bar.zaptext.shop` (mis-config).
  if (!sub || sub.includes('.')) return null;
  if (RESERVED_SUBDOMAINS.has(sub)) return null;
  // DNS-label-safe characters only — anything else is a typo / probe.
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(sub)) return null;
  return sub;
}

export default clerkMiddleware(async (auth, req) => {
  const slug = detectStorefrontSlug(req);
  if (slug) {
    const url = req.nextUrl.clone();
    const path = url.pathname;
    // Skip framework/asset/api paths — the matcher already excludes most,
    // but defensive in case future config widens it.
    if (path.startsWith('/_next') || path.startsWith('/api/')) {
      return NextResponse.next();
    }
    // Map the bare subdomain visit (or /store) to the public menu page.
    // `/m/[clientId]/page.tsx` resolves the segment via getClientByIdOrSlug.
    if (path === '/' || path === '/store' || path === '/store/') {
      url.pathname = `/m/${slug}`;
    } else if (!path.startsWith('/m/')) {
      // Preserve any nested storefront path (e.g. future /order/123 page)
      // by prepending the /m/<slug> namespace. Already-/m/ paths pass
      // through unchanged so internal redirects don't double-prefix.
      url.pathname = `/m/${slug}${path}`;
    }
    // Storefront is public — bypass Clerk's auth.protect() entirely. The
    // /m(.*) prefix is already listed in isPublicRoute so a follow-up
    // request hitting the rewritten path also stays unauth.
    // Attach an internal header so the rewritten page can distinguish
    // "arrived via subdomain" from "arrived via legacy /m/<id> bot link"
    // and apply the storefront_enabled gate only to the former.
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set(STOREFRONT_HOST_HEADER, '1');
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
