import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

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

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
