import { NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { getBookingsByClient, getBookingsForDate, getTodayIST } from '@/lib/booking';
import { getClientAnalytics, getClientConversations } from '@/lib/google-sheets';

export async function GET() {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ stats: { totalBookings: 0, todayBookings: 0, totalMessages: 0, uniqueCustomers: 0 }, todayBookings: [] });

  try {
    const today = getTodayIST();
    const [allBookings, todayBookings, analytics, conversations] = await Promise.all([
      getBookingsByClient(bot.client_id, 'confirmed'),
      getBookingsForDate(bot.client_id, today),
      getClientAnalytics(bot.client_id),
      getClientConversations(bot.client_id),
    ]);

    const uniqueCustomers = new Set(conversations.map((c) => c.customer_phone)).size;
    const totalMessages = analytics.reduce((sum, a) => sum + a.total_messages, 0);

    return NextResponse.json({
      stats: {
        totalBookings: allBookings.length,
        todayBookings: todayBookings.filter((b) => b.status === 'confirmed').length,
        totalMessages,
        uniqueCustomers,
      },
      todayBookings: todayBookings.filter((b) => b.status === 'confirmed'),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
