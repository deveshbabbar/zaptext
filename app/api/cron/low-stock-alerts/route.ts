// /api/cron/low-stock-alerts — daily low-stock EMAIL digest to restaurant owners.
//
// For every active restaurant client, scan inventory rows where:
//   - tracks_stock = true
//   - stock >= 0  (i.e. tracking is enabled — `-1` means unlimited)
//   - stock <= low_stock_threshold (and threshold > 0)
//   - is_active = true
// If at least one row matches, send the owner a single email (via
// ZeptoMail/Brevo) listing the items + remaining stock with a CTA into
// /client/inventory so they can re-stock the kitchen before the lunch /
// dinner rush.
//
// EMAIL was chosen over WhatsApp on purpose — daily ops digests scroll
// off the chat thread and the owner can't bookmark / forward / file
// them. Email keeps the alert searchable + actionable. (Same reason
// we use email for morning-summary + evening-summary today.)
//
// Wired into the morning bucket (09:00 IST) so owners get it during
// prep time, before customers start ordering.

import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { clients as clientsTable, inventory as inventoryTable } from '@/lib/db/schema';
import { and, eq, gte } from 'drizzle-orm';
import { sendTemplate, tplLowStock } from '@/lib/email';
import { claimCronRun, finishCronRun } from '@/lib/db/cron-runs';

interface LowItem { name: string; stock: number; threshold: number }

const CRON_TASK = 'low-stock-alerts';
// Lockout >> the daily schedule. If a successful run finished within the
// last 12 hours, a duplicate trigger is a Vercel retry — skip it.
const CRON_LOCKOUT_SEC = 12 * 60 * 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Idempotency claim — Vercel can retry a timed-out cron and we don't
  // want owners to receive a duplicate digest.
  const claim: { claimed: boolean; runId?: string; reason?: string } =
    await claimCronRun(CRON_TASK, CRON_LOCKOUT_SEC).catch(() => ({ claimed: true }));
  if (!claim.claimed) {
    return NextResponse.json({ ok: true, skipped: true, reason: claim.reason });
  }
  const runId = claim.runId;

  let sent = 0;
  const errors: string[] = [];
  const results: Array<{ client_id: string; alerted: boolean; itemCount: number; reason?: string }> = [];

  try {
    const restaurants = await db
      .select({
        client_id: clientsTable.client_id,
        business_name: clientsTable.business_name,
        owner_user_id: clientsTable.owner_user_id,
        status: clientsTable.status,
      })
      .from(clientsTable)
      .where(eq(clientsTable.type, 'restaurant'));

    const cc = await clerkClient();
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    for (const r of restaurants) {
      if (r.status !== 'active') {
        results.push({ client_id: r.client_id, alerted: false, itemCount: 0, reason: 'inactive' });
        continue;
      }

      // Pull active+tracks_stock+stock>=0+threshold>=1, filter "stock <=
      // threshold" in JS — drizzle's typesafe builder doesn't have a
      // clean field-vs-field comparator and per-restaurant row count is
      // small (< 200 menu items typically) so JS filter is fine.
      const rows = await db
        .select({
          name: inventoryTable.name,
          stock: inventoryTable.stock,
          low_stock_threshold: inventoryTable.low_stock_threshold,
        })
        .from(inventoryTable)
        .where(and(
          eq(inventoryTable.client_id, r.client_id),
          eq(inventoryTable.tracks_stock, true),
          eq(inventoryTable.is_active, true),
          gte(inventoryTable.stock, 0),
          gte(inventoryTable.low_stock_threshold, 1),
        ));

      const lowItems: LowItem[] = rows
        .filter((row) => row.stock <= row.low_stock_threshold)
        .map((row) => ({ name: row.name, stock: row.stock, threshold: row.low_stock_threshold }))
        .sort((a, b) => a.stock - b.stock);

      if (lowItems.length === 0) {
        results.push({ client_id: r.client_id, alerted: false, itemCount: 0, reason: 'all_good' });
        continue;
      }

      try {
        const owner = await cc.users.getUser(r.owner_user_id);
        const ownerEmail = owner.emailAddresses[0]?.emailAddress;
        const ownerName = `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || 'there';
        if (!ownerEmail) {
          results.push({ client_id: r.client_id, alerted: false, itemCount: lowItems.length, reason: 'no_owner_email' });
          continue;
        }
        await sendTemplate(
          ownerEmail,
          tplLowStock({
            ownerName,
            businessName: r.business_name,
            date: today,
            items: lowItems,
          }),
          ownerName,
        );
        sent++;
        results.push({ client_id: r.client_id, alerted: true, itemCount: lowItems.length });
      } catch (err) {
        const msg = String(err).slice(0, 200);
        errors.push(`${r.client_id}: ${msg}`);
        results.push({ client_id: r.client_id, alerted: false, itemCount: lowItems.length, reason: 'email_failed' });
        console.error('[low-stock-alerts] send failed', { client_id: r.client_id, err });
      }
    }

    if (runId) await finishCronRun(runId, true, { sent, errorCount: errors.length });
    return NextResponse.json({
      ok: true,
      summary: `Emailed ${sent} of ${restaurants.length} restaurants`,
      sent,
      errors: errors.slice(0, 50),
      errorCount: errors.length,
      results,
    });
  } catch (err) {
    if (runId) await finishCronRun(runId, false, { error: String(err).slice(0, 300) }).catch(() => {});
    throw err;
  }
}
