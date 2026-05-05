import { NextRequest, NextResponse } from 'next/server';
import { cancelBooking, getBookingById } from '@/lib/booking';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { getClientById } from '@/lib/google-sheets';
import { notifyBookingCancellation } from '@/lib/booking-notifications';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserRole();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const bookingId = typeof body.bookingId === 'string' ? body.bookingId : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 200) : '';
    if (!bookingId) {
      return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
    }

    const booking = await getBookingById(bookingId);
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (user.role !== 'admin') {
      const bot = await resolveActiveBot(user.userId);
      if (!bot || bot.client_id !== booking.client_id) {
        return NextResponse.json({ error: 'Booking not found for your bot' }, { status: 403 });
      }
    }

    const success = await cancelBooking(bookingId, reason);
    if (!success) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    // Auto-notify the customer on WhatsApp. The helper checks the 24hr
    // free-form window and falls back to the booking_cancellation template
    // when the customer has been silent for >24h. Free-form sends would
    // silently fail outside the window.
    try {
      const client = await getClientById(booking.client_id);
      if (client?.phone_number_id && booking.customer_phone) {
        await notifyBookingCancellation({
          phoneNumberId: client.phone_number_id,
          clientId: booking.client_id,
          customerPhone: booking.customer_phone,
          customerName: booking.customer_name || '',
          service: booking.service || '',
          date: booking.date,
          time: booking.time_slot || '',
          bookingId: booking.booking_id || '',
          businessName: client.business_name,
          reason,
        });
      }
    } catch (notifyErr) {
      console.error('Customer cancel-notify failed:', notifyErr);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cancel booking error:', error);
    return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 });
  }
}
