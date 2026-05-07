// ─── Referral program helpers ───
//
// Each user gets a deterministic 6-char referral code derived from their
// Clerk userId. No counter table, no migration — same userId always
// produces the same code, so we can validate/lookup without a DB hit.
//
// Flow:
//   1. Visitor lands on /<anything>?ref=ABC123 → tiny client component
//      reads the query param and sets cookie `zt_ref` (90-day expiry).
//   2. On first sign-in (POST /api/auth/welcome), if the cookie is set
//      AND the referrer is a different user, we persist
//      `referredBy: ABC123` in the new user's Clerk publicMetadata.
//   3. Admin reviews referral attributions in the dashboard / runs a
//      monthly script to credit referrers a free month for each
//      referee that converted to a paid plan.
//
// V1 stays manual on credit application — automation can come later
// once we see real referral volume justifying the work.

import crypto from 'crypto';

export const REFERRAL_COOKIE = 'zt_ref';
export const REFERRAL_COOKIE_TTL_DAYS = 90;

// Deterministic 6-char A-F/0-9 code derived from the Clerk user ID.
// Same userId → same code, every time. SHA-256 → first 6 hex chars,
// uppercased. Hex gives us 16^6 = 16.7M unique codes — safe collision
// margin for our SMB scale (we'd need ~5,000 users before a 1% birthday
// collision risk, by which time we'd switch to an explicit table).
export function generateReferralCode(clerkUserId: string): string {
  if (!clerkUserId) return '';
  const hash = crypto.createHash('sha256').update(clerkUserId).digest('hex');
  return hash.slice(0, 6).toUpperCase();
}

// Lightweight syntactic validation. Real ownership check is done by
// looking the code up against Clerk's user list — but malformed codes
// can be rejected upfront without that round-trip.
export function isValidReferralCodeShape(code: string): boolean {
  return /^[A-F0-9]{6}$/i.test(code);
}

// Build the share link the referrer will paste. Reads
// NEXT_PUBLIC_APP_URL so it works across staging/prod without code
// changes; falls back to a sensible default for local dev.
export function buildReferralLink(code: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://zaptext.io').replace(/\/$/, '');
  return `${base}/?ref=${code}`;
}
