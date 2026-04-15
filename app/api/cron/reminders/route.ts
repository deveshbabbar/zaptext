import { NextRequest, NextResponse } from 'next/server';
import { getBookingsForTomorrow, getDateOffset, getTodayIST } from '@/lib/booking';
import { getClientById } from '@/lib/google-sheets';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

export async function GET(request: NextRequest) {
  // Optional secret verification
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
      const customerMsg = `🔔 Reminder: Aapka appointment kal hai!\n\n📅 ${b.date}\n🕐 ${b.time_slot}\n📍 ${client.business_name}\n${b.service ? `💼 ${b.service}\n` : ''}\nKoi change ho toh reply karein.`;
      if (client.phone_number_id && b.customer_phone) {
        await sendWhatsAppMessage(client.phone_number_id, b.customer_phone, customerMsg);
        smsSent++;
      }
      // TODO: send customer email when we capture it
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
