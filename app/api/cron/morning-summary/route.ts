import { NextRequest, NextResponse } from 'next/server';
import { getAllClients } from '@/lib/google-sheets';
import { getBookingsForDate, getTodayIST } from '@/lib/booking';
import { sendTemplate, tplDailyMorningSummary } from '@/lib/email';
import { clerkClient } from '@clerk/nextjs/server';
import { claimCronRun, finishCronRun } from '@/lib/db/cron-runs';

const CRON_TASK = 'morning-summary';
// Lockout >> the daily schedule. If a successful run finished within the
// last 12 hours, a duplicate trigger is a Vercel retry — skip it.
const CRON_LOCKOUT_SEC = 12 * 60 * 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Idempotency claim. Vercel can retry a timed-out cron — without this
  // gate every owner would receive a duplicate digest. If claim fails the
  // task is either freshly-completed or in-flight, both = skip.
  const claim: { claimed: boolean; runId?: string; reason?: string } =
    await claimCronRun(CRON_TASK, CRON_LOCKOUT_SEC).catch(() => ({ claimed: true }));
  if (!claim.claimed) {
    return NextResponse.json({ ok: true, skipped: true, reason: claim.reason });
  }
  const runId = claim.runId;

  let sent = 0;
  const errors: string[] = [];
  try {
    const clients = await getAllClients();
    const today = getTodayIST();
    const cc = await clerkClient();

    const activeClients = clients.filter((c) => c.status === 'active');
    const results = await Promise.allSettled(
      activeClients.map(async (client) => {
        const bookings = await getBookingsForDate(client.client_id, today);
        const confirmed = bookings.filter((b) => b.status === 'confirmed');
        const owner = await cc.users.getUser(client.owner_user_id);
        const ownerEmail = owner.emailAddresses[0]?.emailAddress;
        const ownerName = `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || 'there';
        if (!ownerEmail) return;
        await sendTemplate(ownerEmail, tplDailyMorningSummary({
          ownerName,
          businessName: client.business_name,
          date: today,
          bookings: confirmed.map((b) => ({ time: b.time_slot, customer: b.customer_name, service: b.service })),
        }), ownerName);
        sent++;
      })
    );
    for (const r of results) {
      if (r.status === 'rejected') errors.push(String(r.reason).slice(0, 200));
    }

    if (runId) await finishCronRun(runId, true, { sent, errorCount: errors.length });
    return NextResponse.json({ success: true, sent, errors: errors.slice(0, 50), errorCount: errors.length });
  } catch (err) {
    if (runId) await finishCronRun(runId, false, { error: String(err).slice(0, 300) }).catch(() => {});
    throw err;
  }
}
