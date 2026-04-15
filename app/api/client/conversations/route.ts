import { NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { getClientConversations } from '@/lib/google-sheets';

export async function GET() {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ conversations: {} });

  try {
    const messages = await getClientConversations(bot.client_id);
    const grouped: Record<string, typeof messages> = {};
    for (const msg of messages) {
      if (!grouped[msg.customer_phone]) grouped[msg.customer_phone] = [];
      grouped[msg.customer_phone].push(msg);
    }
    return NextResponse.json({ conversations: grouped });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
