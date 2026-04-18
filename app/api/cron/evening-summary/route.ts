import { NextRequest, NextResponse } from 'next/server';
import { getAllClients } from '@/lib/google-sheets';
import { getBookingsForDate, getTodayIST, getDateOffset } from '@/lib/booking';
import { sendTemplate, tplDailyEveningSummary } from '@/lib/email';
import { buildDailyDigest, digestSubject, digestIntroHtml } from '@/lib/daily-digest';
import { clerkClient } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clients = await getAllClients();
  const today = getTodayIST();
  const tomorrow = getDateOffset(today, 1);
  let sent = 0;
  let digestsSent = 0;
  const errors: string[] = [];
  const cc = await clerkClient();

  const activeClients = clients.filter((c) => c.status === 'active');
  const results = await Promise.allSettled(
    activeClients.map(async (client) => {
      const [tomorrowBookings, todayBookings] = await Promise.all([
        getBookingsForDate(client.client_id, tomorrow),
        getBookingsForDate(client.client_id, today),
      ]);
      const confirmedTomorrow = tomorrowBookings.filter((b) => b.status === 'confirmed');
      const owner = await cc.users.getUser(client.owner_user_id);
      const ownerEmail = owner.emailAddresses[0]?.emailAddress;
      const ownerName = `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || 'there';
      if (!ownerEmail) return;

      // Tomorrow-preview email (existing behavior)
      await sendTemplate(
        ownerEmail,
        tplDailyEveningSummary({
          ownerName,
          businessName: client.business_name,
          tomorrowDate: tomorrow,
          bookings: confirmedTomorrow.map((b) => ({ time: b.time_slot, customer: b.customer_name, service: b.service })),
        }),
        ownerName
      );
      sent++;

      // Today-digest email (new) — CSV/JSON attachment, only if today had bookings
      if (todayBookings.length > 0) {
        const format = client.export_format === 'json' ? 'json' : 'csv';
        const systemName = (client.existing_system || '').trim() || undefined;
        const file = buildDailyDigest({
          businessName: client.business_name,
          date: today,
          bookings: todayBookings.map((b) => ({
            booking_id: b.booking_id,
            customer_name: b.customer_name,
            customer_phone: b.customer_phone,
            date: b.date,
            time_slot: b.time_slot,
            end_time: b.end_time,
            service: b.service,
            status: b.status,
            notes: b.notes,
            created_at: b.created_at,
          })),
          systemName,
          format,
        });
        await sendTemplate(
          ownerEmail,
          {
            subject: digestSubject(client.business_name, today, todayBookings.length, systemName),
            html: digestIntroHtml(client.business_name, today, todayBookings.length, systemName, format),
          },
          ownerName,
          [{ filename: file.filename, content: file.base64, contentType: file.mimeType }]
        );
        digestsSent++;
      }
    })
  );
  for (const r of results) {
    if (r.status === 'rejected') errors.push(String(r.reason));
  }

  return NextResponse.json({ success: true, sent, digestsSent, errors });
}
