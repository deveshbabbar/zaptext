import { NextRequest, NextResponse } from 'next/server';
import { cancelBooking, getBookingById } from '@/lib/booking';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { getClientById } from '@/lib/google-sheets';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

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

    // Auto-notify the customer on WhatsApp
    try {
      const client = await getClientById(booking.client_id);
      if (client?.phone_number_id && booking.customer_phone) {
        const reasonLine = reason ? `\nReason: ${reason}` : '';
        const isOrder = (booking.service || '').startsWith('ORDER');
        const subject = isOrder ? 'order' : 'booking';
        const msg =
          `🙏 Sorry ${booking.customer_name || ''}, your ${subject} for ` +
          `${booking.date}${booking.time_slot ? ` at ${booking.time_slot}` : ''} (${client.business_name}) ` +
          `has been cancelled.${reasonLine}\n\n` +
          `Reply here and we'll help you rebook.`;
        await sendWhatsAppMessage(client.phone_number_id, booking.customer_phone, msg);
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
