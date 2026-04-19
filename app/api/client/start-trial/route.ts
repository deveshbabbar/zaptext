import { NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { createSubscription, getActiveSubscription, getSubscriptionHistory } from '@/lib/subscription';
import { getISTTimestamp } from '@/lib/utils';

export async function POST() {
  const user = await getUserRole();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Already has an active subscription (trial or paid) — nothing to do.
  const active = await getActiveSubscription(user.userId);
  if (active) {
    return NextResponse.json(
      { error: 'ALREADY_ACTIVE', message: 'You already have an active subscription.', plan: active.plan },
      { status: 409 }
    );
  }

  // One-trial-per-user: block if this user has ever activated a trial before
  // (prevents repeat-trial abuse).
  const history = await getSubscriptionHistory(user.userId);
  if (history.some((s) => s.plan === 'trial')) {
    return NextResponse.json(
      { error: 'TRIAL_USED', message: 'Free trial already used on this account. Pick a paid plan to continue.' },
      { status: 409 }
    );
  }

  // Trial bookkeeping date (actual gate is message count, not date).
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + 90);

  await createSubscription({
    userId: user.userId,
    plan: 'trial',
    status: 'active',
    razorpayPaymentId: 'trial-self-serve',
    razorpayOrderId: 'trial-self-serve',
    amount: 0,
    startDate: now.toISOString(),
    endDate: end.toISOString(),
    createdAt: getISTTimestamp(),
  });

  return NextResponse.json({
    success: true,
    plan: 'trial',
    message: 'Free trial activated — create your first bot to start.',
  });
}
