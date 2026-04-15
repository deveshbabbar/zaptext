import { NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { getBookingsByClient } from '@/lib/booking';

export async function GET() {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ bookings: [] });

  try {
    const bookings = await getBookingsByClient(bot.client_id);
    return NextResponse.json({ bookings });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
