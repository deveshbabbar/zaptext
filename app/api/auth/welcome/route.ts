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

// Auto-grants the free trial on first sign-in. Idempotent: skips when the
// user already has any active subscription, AND skips when the user has
// EVER had a trial before (one-trial-per-user rule, mirrors start-trial).
// We do NOT rely on the welcomed cookie for this — we want trial to be
// granted even if the welcome email already went out (cookie set, but the
// user hadn't pressed "Start trial" before this auto-grant existed).
async function autoGrantTrialIfNeeded(userId: string): Promise<void> {
  try {
    const active = await getActiveSubscription(userId);
    if (active) return;
    const history = await getSubscriptionHistory(userId);
    if (history.some((s) => s.plan === 'trial')) return;
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 90);
    await createSubscription({
      userId,
      plan: 'trial',
      status: 'active',
      razorpayPaymentId: 'trial-auto-grant',
      razorpayOrderId: 'trial-auto-grant',
      amount: 0,
      startDate: now.toISOString(),
      endDate: end.toISOString(),
      createdAt: getISTTimestamp(),
    });
    console.log(`[Welcome] Auto-granted free trial to ${userId}`);
  } catch (err) {
    // Don't let trial auto-grant block the welcome email flow — log and continue.
    console.error('[Welcome] Auto-grant trial failed:', err);
  }
}

export async function POST() {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Auto-grant trial BEFORE the welcomed cookie short-circuit, so existing
  // users who land on the dashboard for the first time after this ships
  // also get a trial automatically.
  await autoGrantTrialIfNeeded(user.userId);

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
