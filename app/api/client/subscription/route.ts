import { NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { getActiveSubscription, getSubscriptionHistory } from '@/lib/subscription';

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

    return NextResponse.json({ current, history });
  } catch (error) {
    console.error('Get subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to get subscription data' },
      { status: 500 }
    );
  }
}
