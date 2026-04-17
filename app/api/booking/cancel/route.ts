import { NextRequest, NextResponse } from 'next/server';
import { cancelBooking, getBookingsByClient } from '@/lib/booking';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserRole();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bookingId } = await request.json();
    if (!bookingId || typeof bookingId !== 'string') {
      return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
    }

    // Verify the booking belongs to this user's bot (unless admin)
    if (user.role !== 'admin') {
      const bot = await resolveActiveBot(user.userId);
      if (!bot) {
        return NextResponse.json({ error: 'No bot found' }, { status: 403 });
      }
      const bookings = await getBookingsByClient(bot.client_id);
      const booking = bookings.find((b) => b.booking_id === bookingId);
      if (!booking) {
        return NextResponse.json({ error: 'Booking not found for your bot' }, { status: 403 });
      }
    }

    const success = await cancelBooking(bookingId);
    if (!success) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cancel booking error:', error);
    return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 });
  }
}
