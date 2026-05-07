import { NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { sendTemplate, tplWelcome, tplAdminNewSignup } from '@/lib/email';
import { cookies } from 'next/headers';
import {
  createSubscription,
  getActiveSubscription,
  getSubscriptionHistory,
} from '@/lib/subscription';
import { getISTTimestamp } from '@/lib/utils';
import { clerkClient } from '@clerk/nextjs/server';
import {
  REFERRAL_COOKIE,
  generateReferralCode,
  isValidReferralCodeShape,
} from '@/lib/referral';

// Auto-grants the free tier on every sign-in where the user has no
// active subscription. "Free forever, no card required" is the public
// positioning — the previous "one trial per user EVER" rule was a
// regression that locked existing users out once their 90-day trial
// expired. The TRIAL_MESSAGE_LIMIT (50 lifetime AI replies, enforced
// per-owner across all their bots in the webhook) is the real revenue
// funnel — time-based expiry isn't needed.
//
// We still skip when the user has any current active subscription
// (trial OR paid), so this never overwrites a real plan. We DO grant
// a fresh trial row when the previous one expired, which restores
// dashboard access for users (including the founder) who tested early
// on and got stuck on "Plan required" after their 90 days ran out.
//
// IMPORTANT: razorpayPaymentId MUST be empty for trial rows because
// the `subscriptions_payment_id_idx` unique index includes any
// non-empty value. Earlier code passed the literal string
// 'trial-auto-grant' which only worked for the first user — every
// subsequent user got silently no-op'd by the dedup check inside
// createSubscription. Sentinel for audit visibility lives in
// razorpay_order_id (which has no unique constraint).
async function autoGrantTrialIfNeeded(userId: string): Promise<void> {
  try {
    const active = await getActiveSubscription(userId);
    if (active) return;
    const now = new Date();
    const end = new Date(now);
    // Effectively forever — Postgres timestamp comfortably handles year
    // 2126 and the 50-message lifetime cap remains the gating factor.
    end.setFullYear(end.getFullYear() + 100);
    await createSubscription({
      userId,
      plan: 'trial',
      status: 'active',
      razorpayPaymentId: '',
      razorpayOrderId: 'trial-auto-grant',
      amount: 0,
      startDate: now.toISOString(),
      endDate: end.toISOString(),
      createdAt: getISTTimestamp(),
    });
    console.log(`[Welcome] Auto-granted free tier to ${userId}`);
  } catch (err) {
    // Don't let trial auto-grant block the welcome email flow — log and continue.
    console.error('[Welcome] Auto-grant trial failed:', err);
  }
}

// Persists the referrer attribution onto the new user's Clerk
// publicMetadata exactly once (first-touch). Skips when:
//   - cookie is absent or malformed
//   - the user has already been attributed (idempotent re-runs)
//   - the visitor's own code matches the cookie (anti-self-referral)
async function captureReferralIfPresent(userId: string): Promise<void> {
  try {
    const store = await cookies();
    const raw = (store.get(REFERRAL_COOKIE)?.value || '').trim();
    if (!raw || !isValidReferralCodeShape(raw)) return;

    const ownCode = generateReferralCode(userId);
    if (raw.toUpperCase() === ownCode.toUpperCase()) return; // own link

    const cc = await clerkClient();
    const me = await cc.users.getUser(userId);
    const meta = (me.publicMetadata || {}) as Record<string, unknown>;
    if (typeof meta.referredBy === 'string' && meta.referredBy.trim()) {
      return; // already attributed — preserve first-touch winner
    }

    await cc.users.updateUserMetadata(userId, {
      publicMetadata: { ...meta, referredBy: raw.toUpperCase() },
    });
    console.log(`[Welcome] Captured referral: ${userId} ← ${raw.toUpperCase()}`);

    // Clear the cookie so a subsequent visit by this user doesn't keep
    // re-running the lookup (the metadata check above already short-
    // circuits, but cleaning up is tidy).
    store.set(REFERRAL_COOKIE, '', { maxAge: 0, path: '/' });
  } catch (err) {
    console.error('[Welcome] Capture referral failed:', err);
  }
}

export async function POST() {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Auto-grant trial BEFORE the welcomed cookie short-circuit, so existing
  // users who land on the dashboard for the first time after this ships
  // also get a trial automatically.
  await autoGrantTrialIfNeeded(user.userId);

  // Capture referral attribution if a zt_ref cookie was set during the
  // visitor phase. First-touch wins — once stored on the user, never
  // overwritten on subsequent welcome calls.
  await captureReferralIfPresent(user.userId);

  const store = await cookies();
  if (store.get('welcomed')?.value === '1') {
    return NextResponse.json({ alreadySent: true });
  }

  let emailSent = false;

  // Welcome email to user
  if (user.email) {
    console.log(`[Welcome] Sending welcome email to ${user.email}`);
    const result = await sendTemplate(user.email, tplWelcome({ name: user.name || 'there' }), user.name);
    if (result.success) {
      emailSent = true;
      console.log(`[Welcome] Welcome email sent successfully to ${user.email}`);
    } else {
      console.error(`[Welcome] Failed to send welcome email to ${user.email}:`, result.error);
    }
  }

  // Admin notification
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const adminResult = await sendTemplate(adminEmail, tplAdminNewSignup({ name: user.name || 'Unknown', email: user.email }));
    if (!adminResult.success) {
      console.error(`[Welcome] Failed to send admin notification:`, adminResult.error);
    }
  }

  // Only set cookie if email was actually sent — so it retries next time if it failed
  if (emailSent) {
    store.set('welcomed', '1', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });
  }

  return NextResponse.json({ success: emailSent, emailSent });
}
