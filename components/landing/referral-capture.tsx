'use client';

import { useEffect } from 'react';
import { REFERRAL_COOKIE, REFERRAL_COOKIE_TTL_DAYS, isValidReferralCodeShape } from '@/lib/referral';

// ─── Referral attribution capture ───
//
// Renders nothing. On mount, reads ?ref=CODE from the URL and persists
// it as a cookie so that when the visitor signs up later (possibly
// after browsing for a while), the welcome route can attribute the
// signup to the referrer.
//
// Idempotent — overwriting the cookie with the same value is harmless.
// We also DON'T overwrite an existing valid cookie; first-touch
// attribution wins (industry standard for SaaS referrals — last-touch
// rewards spammers who repost links over genuine introducers).

export function ReferralCapture() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = (params.get('ref') || '').trim();
      if (!ref || !isValidReferralCodeShape(ref)) return;

      // First-touch wins — don't clobber an existing cookie.
      const existing = document.cookie
        .split(';')
        .map((s) => s.trim())
        .find((s) => s.startsWith(`${REFERRAL_COOKIE}=`));
      if (existing) return;

      const maxAge = REFERRAL_COOKIE_TTL_DAYS * 24 * 60 * 60;
      document.cookie =
        `${REFERRAL_COOKIE}=${encodeURIComponent(ref)}; max-age=${maxAge}; path=/; samesite=lax`;
    } catch {
      // Cookie/URL APIs not available (SSR fallback or sandboxed iframe)
      // — silently no-op. Worst case the visitor doesn't get attributed,
      // never breaks the page.
    }
  }, []);

  return null;
}
