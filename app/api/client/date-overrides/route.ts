import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { getDateOverrides, addDateOverride } from '@/lib/booking';

export async function GET() {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ overrides: [] });

  try {
    const overrides = await getDateOverrides(bot.client_id);
    return NextResponse.json({ overrides });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ error: 'No bot selected' }, { status: 400 });

  try {
    const { date, override_type, custom_start, custom_end, reason } = await request.json();
    await addDateOverride({
      client_id: bot.client_id,
      date,
      override_type: override_type || 'blocked',
      custom_start: custom_start || '',
      custom_end: custom_end || '',
      reason: reason || '',
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
