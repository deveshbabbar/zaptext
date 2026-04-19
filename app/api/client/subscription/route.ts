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

    // On trial: sum outbound replies across the user's bots for the usage meter.
    let trialUsage: { messagesUsed: number; messagesLimit: number } | null = null;
    if (current && isTrialPlan(current.plan)) {
      const bots = await getBotsByOwner(user.userId).catch(() => []);
      let count = 0;
      for (const bot of bots) {
        const convos = await getClientConversations(bot.client_id).catch(() => []);
        count += convos.filter((c) => c.direction === 'outgoing').length;
      }
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
