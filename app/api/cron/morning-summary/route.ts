import { NextRequest, NextResponse } from 'next/server';
import { getAllClients } from '@/lib/google-sheets';
import { getBookingsForDate, getTodayIST } from '@/lib/booking';
import { sendTemplate, tplDailyMorningSummary } from '@/lib/email';
import { clerkClient } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clients = await getAllClients();
  const today = getTodayIST();
  let sent = 0;
  const errors: string[] = [];
  const cc = await clerkClient();

  for (const client of clients) {
    if (client.status !== 'active') continue;
    try {
      const bookings = await getBookingsForDate(client.client_id, today);
      const confirmed = bookings.filter((b) => b.status === 'confirmed');
      const owner = await cc.users.getUser(client.owner_user_id);
      const ownerEmail = owner.emailAddresses[0]?.emailAddress;
      const ownerName = `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || 'there';
      if (!ownerEmail) continue;
      await sendTemplate(ownerEmail, tplDailyMorningSummary({
        ownerName,
        businessName: client.business_name,
        date: today,
        bookings: confirmed.map((b) => ({ time: b.time_slot, customer: b.customer_name, service: b.service })),
      }), ownerName);
      sent++;
    } catch (e) {
      errors.push(`${client.client_id}: ${e}`);
    }
  }

  return NextResponse.json({ success: true, sent, errors });
}
