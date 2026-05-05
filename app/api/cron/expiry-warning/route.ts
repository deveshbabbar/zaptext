// ─── Subscription expiry warning cron ───
//
// Runs daily (from the morning dispatch pipeline). Finds active
// subscriptions whose end_date is inside the next 8 days and sends:
//   - 7-day heads-up    when end_date is 1..7 days away AND
//                       last_warned_period IS NULL
//   - 1-day final       when end_date is within 1 day AND
//                       last_warned_period IS NULL or '7d'
// After each send the subscription's last_warned_period is set to '7d'
// or '1d' so subsequent cron passes don't re-email the same owner.
//
// Idempotent at cron level via claimCronRun, AND at row level via
// last_warned_period — belt-and-braces.

import { NextRequest, NextResponse } from 'next/server';
import {
  getExpiringActiveSubscriptions,
  markSubscriptionWarned,
} from '@/lib/subscription';
import {
  sendTemplate,
  tplSubscriptionExpiringSoon,
  tplSubscriptionExpiringTomorrow,
} from '@/lib/email';
import { clerkClient } from '@clerk/nextjs/server';
import { claimCronRun, finishCronRun } from '@/lib/db/cron-runs';

const CRON_TASK = 'expiry-warning';
const CRON_LOCKOUT_SEC = 12 * 60 * 60;
const HORIZON_DAYS = 8;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const claim: { claimed: boolean; runId?: string; reason?: string } =
    await claimCronRun(CRON_TASK, CRON_LOCKOUT_SEC).catch(() => ({ claimed: true }));
  if (!claim.claimed) {
    return NextResponse.json({ ok: true, skipped: true, reason: claim.reason });
  }
  const runId = claim.runId;

  let warned7d = 0;
  let warned1d = 0;
  const errors: string[] = [];

  try {
    const subs = await getExpiringActiveSubscriptions(HORIZON_DAYS);
    if (subs.length === 0) {
      if (runId) await finishCronRun(runId, true, { warned7d: 0, warned1d: 0 });
      return NextResponse.json({ ok: true, considered: 0, warned7d: 0, warned1d: 0 });
    }

    const cc = await clerkClient();
    const now = Date.now();

    for (const sub of subs) {
      try {
        const endMs = new Date(sub.endDate).getTime();
        const msLeft = endMs - now;
        if (msLeft <= 0) continue; // already expired; offline reply handles it
        const daysLeft = Math.max(1, Math.ceil(msLeft / ONE_DAY_MS));

        const owner = await cc.users.getUser(sub.userId).catch(() => null);
        const ownerEmail = owner?.emailAddresses[0]?.emailAddress;
        if (!ownerEmail) continue;
        const ownerName = `${owner?.firstName || ''} ${owner?.lastName || ''}`.trim() || 'there';

        // Within 24h → 1-day warning if not already sent.
        if (msLeft <= ONE_DAY_MS) {
          if (sub.lastWarnedPeriod === '1d') continue;
          await sendTemplate(
            ownerEmail,
            tplSubscriptionExpiringTomorrow({
              ownerName,
              businessName: 'your',
              plan: sub.plan,
              endDate: sub.endDate.slice(0, 10),
            }),
            ownerName
          );
          await markSubscriptionWarned(sub.id, '1d');
          warned1d++;
          continue;
        }

        // 1..7 days → 7-day warning, only if no warning fired yet.
        if (daysLeft <= 7 && sub.lastWarnedPeriod == null) {
          await sendTemplate(
            ownerEmail,
            tplSubscriptionExpiringSoon({
              ownerName,
              businessName: 'your',
              plan: sub.plan,
              endDate: sub.endDate.slice(0, 10),
              daysLeft,
            }),
            ownerName
          );
          await markSubscriptionWarned(sub.id, '7d');
          warned7d++;
        }
      } catch (e) {
        errors.push(`sub ${sub.id}: ${String(e).slice(0, 100)}`);
      }
    }

    if (runId) {
      await finishCronRun(runId, true, {
        considered: subs.length,
        warned7d,
        warned1d,
        errorCount: errors.length,
      });
    }
    return NextResponse.json({
      ok: true,
      considered: subs.length,
      warned7d,
      warned1d,
      errors: errors.slice(0, 50),
    });
  } catch (err) {
    if (runId) await finishCronRun(runId, false, { error: String(err).slice(0, 300) }).catch(() => {});
    throw err;
  }
}
