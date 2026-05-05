import { NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { getClientConversations } from '@/lib/google-sheets';
import { listPausedCustomers } from '@/lib/db/paused-customers';

export async function GET() {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ conversations: {}, paused_customers: [] });

  try {
    const [messages, paused] = await Promise.all([
      getClientConversations(bot.client_id),
      listPausedCustomers(bot.client_id).catch(() => [] as string[]),
    ]);
    const grouped: Record<string, typeof messages> = {};
    for (const msg of messages) {
      if (!grouped[msg.customer_phone]) grouped[msg.customer_phone] = [];
      grouped[msg.customer_phone].push(msg);
    }
    return NextResponse.json({ conversations: grouped, paused_customers: paused });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
