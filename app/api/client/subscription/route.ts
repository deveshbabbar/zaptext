import { NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { getActiveSubscription, getSubscriptionHistory, isTrialPlan, TRIAL_MESSAGE_LIMIT } from '@/lib/subscription';
import { getBotsByOwner } from '@/lib/owner-clients';
import { getClientConversations } from '@/lib/google-sheets';

export async function GET() {
  try {
    const user = await getUserRole();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [current, history] = await Promise.all([
      getActiveSubscription(user.userId),
      getSubscriptionHistory(user.userId),
    ]);

    // On trial: sum outbound replies across the user's bots for the
    // usage meter. The old sequential loop hit the Sheets API once
    // per bot serially — a user on a Scale plan with 10 bots paid
    // 10× the latency before the subscription page rendered AND was
    // at risk of tripping Sheets' 60-reads/user/minute quota. Parallel
    // fan-out cuts wall time to ~max(per-bot latency).
    let trialUsage: { messagesUsed: number; messagesLimit: number } | null = null;
    if (current && isTrialPlan(current.plan)) {
      const bots = await getBotsByOwner(user.userId).catch(() => []);
      const counts = await Promise.all(
        bots.map((bot) =>
          getClientConversations(bot.client_id)
            .then((convos) => convos.filter((c) => c.direction === 'outgoing').length)
            .catch(() => 0),
        ),
      );
      const count = counts.reduce((s, n) => s + n, 0);
      trialUsage = { messagesUsed: count, messagesLimit: TRIAL_MESSAGE_LIMIT };
    }

    return NextResponse.json({ current, history, trialUsage });
  } catch (error) {
    console.error('Get subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to get subscription data' },
      { status: 500 }
    );
  }
}
