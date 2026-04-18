'use client';

import { useEffect } from 'react';

/**
 * Fires /api/auth/welcome once for a signed-in user.
 * Server-side cookie (`welcomed=1`) prevents duplicate sends.
 * Placed inside client & admin layouts so any authenticated page visit
 * triggers it — catches new users who land on create-bot, settings, etc.
 * (not just dashboard, which was the previous bug).
 */
export function WelcomeTrigger() {
  useEffect(() => {
    fetch('/api/auth/welcome', { method: 'POST' }).catch(() => {});
  }, []);
  return null;
}
