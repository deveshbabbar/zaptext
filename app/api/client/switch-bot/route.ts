import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { getBotByIdForOwner } from '@/lib/owner-clients';
import { setActiveBotId } from '@/lib/active-bot';

export async function POST(request: NextRequest) {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { botId } = await request.json();
  if (!botId) return NextResponse.json({ error: 'botId required' }, { status: 400 });

  const bot = await getBotByIdForOwner(botId, user.userId);
  if (!bot) return NextResponse.json({ error: 'Bot not found or not owned' }, { status: 404 });

  await setActiveBotId(botId);
  return NextResponse.json({ success: true });
}
