import { NextRequest, NextResponse } from 'next/server';
import { getBookingsForTomorrow, getDateOffset, getTodayIST } from '@/lib/booking';
import { getClientById } from '@/lib/google-sheets';
import { sendWhatsAppTemplate, TEMPLATE_NAMES } from '@/lib/whatsapp-templates';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tomorrow = getDateOffset(getTodayIST(), 1);
  const bookings = await getBookingsForTomorrow(tomorrow);

  let smsSent = 0;
  const errors: string[] = [];

  for (const b of bookings) {
    if (b.reminded) continue;
    try {
      const client = await getClientById(b.client_id);
      if (!client) continue;
      if (!client.phone_number_id || !b.customer_phone) continue;

      // COMPLIANCE: reminders fire outside the 24h customer-service window,
      // so MUST use an approved WhatsApp template — never free-form text.
      // The `booking_reminder` template must exist and be APPROVED in Meta
      // Business Manager (Category: UTILITY). Expected body:
      //   "Reminder: your appointment at {{1}} is on {{2}} at {{3}}.
      //    Reply to this message to reschedule."
      const result = await sendWhatsAppTemplate(
        client.phone_number_id,
        b.customer_phone,
        TEMPLATE_NAMES.BOOKING_REMINDER,
        [
          client.business_name || 'us',
          b.date,
          b.time_slot,
        ]
      );
      if (result.success) {
        smsSent++;
      } else {
        errors.push(`Booking ${b.booking_id}: template send failed — ${result.error}`);
      }
    } catch (e) {
      errors.push(`Booking ${b.booking_id} failed: ${e}`);
    }
  }

  return NextResponse.json({
    success: true,
    date: tomorrow,
    bookingsProcessed: bookings.length,
    smsSent,
    errors,
  });
}
