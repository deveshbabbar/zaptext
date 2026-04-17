import { NextRequest, NextResponse } from 'next/server';
import { getAllClients } from '@/lib/google-sheets';
import { getBookingsForDate, getTodayIST, getDateOffset } from '@/lib/booking';
import { sendTemplate, tplDailyEveningSummary } from '@/lib/email';
import { clerkClient } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clients = await getAllClients();
  const tomorrow = getDateOffset(getTodayIST(), 1);
  let sent = 0;
  const errors: string[] = [];
  const cc = await clerkClient();

  const activeClients = clients.filter((c) => c.status === 'active');
  const results = await Promise.allSettled(
    activeClients.map(async (client) => {
      const bookings = await getBookingsForDate(client.client_id, tomorrow);
      const confirmed = bookings.filter((b) => b.status === 'confirmed');
      const owner = await cc.users.getUser(client.owner_user_id);
      const ownerEmail = owner.emailAddresses[0]?.emailAddress;
      const ownerName = `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || 'there';
      if (!ownerEmail) return;
      await sendTemplate(ownerEmail, tplDailyEveningSummary({
        ownerName,
        businessName: client.business_name,
        tomorrowDate: tomorrow,
        bookings: confirmed.map((b) => ({ time: b.time_slot, customer: b.customer_name, service: b.service })),
      }), ownerName);
      sent++;
    })
  );
  for (const r of results) {
    if (r.status === 'rejected') errors.push(String(r.reason));
  }

  return NextResponse.json({ success: true, sent, errors });
}
