import { NextRequest, NextResponse } from 'next/server';
import { getBookingsForTomorrow, getDateOffset, getTodayIST } from '@/lib/booking';
import { getClientById } from '@/lib/google-sheets';
import type { ClientRow } from '@/lib/types';
import { sendWhatsAppTemplate, TEMPLATE_NAMES } from '@/lib/whatsapp-templates';
import { claimCronRun, finishCronRun } from '@/lib/db/cron-runs';

const CRON_TASK = 'reminders';
// Reminders run once per evening pipeline (~8pm IST). 12h lockout safely
// covers the 23h gap until the next intended run.
const CRON_LOCKOUT_SEC = 12 * 60 * 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Idempotency claim — without this a Vercel retry would re-send every
  // tomorrow-reminder template, which both annoys customers and burns
  // ~₹0.115 per duplicate UTILITY template.
  const claim: { claimed: boolean; runId?: string; reason?: string } =
    await claimCronRun(CRON_TASK, CRON_LOCKOUT_SEC).catch(() => ({ claimed: true }));
  if (!claim.claimed) {
    return NextResponse.json({ ok: true, skipped: true, reason: claim.reason });
  }
  const runId = claim.runId;

  const tomorrow = getDateOffset(getTodayIST(), 1);
  const bookings = await getBookingsForTomorrow(tomorrow);

  let smsSent = 0;
  const errors: string[] = [];

  // Memoise getClientById across the loop. 50 bookings often span only
  // 5-10 unique clients, but the old code fetched each client_id
  // freshly per booking — 5× extra Sheets API calls minimum, easily
  // tripping the per-user 60 reads/min quota on a busy evening.
  const clientCache = new Map<string, ClientRow | null>();
  const resolveClient = async (id: string): Promise<ClientRow | null> => {
    if (clientCache.has(id)) return clientCache.get(id) ?? null;
    const row = await getClientById(id).catch(() => null);
    clientCache.set(id, row);
    return row;
  };

  try {
    for (const b of bookings) {
      if (b.reminded) continue;
      try {
        const client = await resolveClient(b.client_id);
        if (!client) continue;
        if (!client.phone_number_id || !b.customer_phone) continue;

        // COMPLIANCE: reminders fire outside the 24h customer-service window,
        // so MUST use an approved WhatsApp template — never free-form text.
        // The `booking_reminder` template must exist and be APPROVED in Meta
        // Business Manager (Category: UTILITY).
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
          errors.push(`Booking ${b.booking_id}: template send failed — ${result.error}`.slice(0, 200));
        }
      } catch (e) {
        errors.push(`Booking ${b.booking_id} failed: ${String(e).slice(0, 100)}`);
      }
    }

    if (runId) await finishCronRun(runId, true, {
      date: tomorrow,
      bookingsProcessed: bookings.length,
      smsSent,
      errorCount: errors.length,
    });
    return NextResponse.json({
      success: true,
      date: tomorrow,
      bookingsProcessed: bookings.length,
      smsSent,
      errors: errors.slice(0, 50),
      errorCount: errors.length,
    });
  } catch (err) {
    if (runId) await finishCronRun(runId, false, { error: String(err).slice(0, 300) }).catch(() => {});
    throw err;
  }
}
