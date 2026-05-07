// ─── GST Tax Invoice endpoint ───
//
// GET /api/invoice/<subscriptionId>
//
// Returns a printable HTML tax invoice for one paid ZapText subscription.
// The bot owner taps "Download invoice" on /client/subscription, browser
// renders the HTML, user prints-to-PDF (Ctrl+P) — no extra dependency
// for PDF generation in the runtime.
//
// Auth:
//   - Authenticated user can fetch invoice for THEIR OWN subscriptions.
//   - Admin can fetch any subscription's invoice (for support cases).
//   - Trial subscriptions (no payment) return 400 — nothing to invoice.

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { subscriptions } from '@/lib/db/schema';
import { getUserRole } from '@/lib/auth';
import { buildInvoice, renderInvoiceHTML } from '@/lib/invoice';
import { clerkClient } from '@clerk/nextjs/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ subscriptionId: string }> }
) {
  const user = await getUserRole();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { subscriptionId } = await params;
  if (!subscriptionId || typeof subscriptionId !== 'string') {
    return NextResponse.json({ error: 'Invalid subscription id' }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId))
    .limit(1);
  const sub = rows[0];

  if (!sub) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
  }

  // Owner-only access (admin override).
  if (sub.user_id !== user.userId && user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Trial subscriptions have no payment — nothing to invoice.
  if (!sub.razorpay_payment_id || sub.plan === 'trial' || Number(sub.amount) <= 0) {
    return NextResponse.json(
      {
        error: 'No invoice available',
        message: 'Trial subscriptions and zero-amount records do not have a tax invoice.',
      },
      { status: 400 }
    );
  }

  // Buyer info from Clerk. We pull from the SUBSCRIPTION owner, not the
  // requester, because admins can fetch on someone's behalf.
  let buyerName = 'Customer';
  let buyerEmail = '';
  let buyerState: string | undefined;
  let buyerGstin: string | undefined;
  try {
    const cc = await clerkClient();
    const owner = await cc.users.getUser(sub.user_id);
    buyerName =
      `${owner.firstName || ''} ${owner.lastName || ''}`.trim() ||
      owner.username ||
      'Customer';
    buyerEmail = owner.emailAddresses[0]?.emailAddress || '';
    // Optional buyer-side GSTIN/state stored in Clerk public metadata so
    // B2B customers can claim ITC. The user can set these from a future
    // /client/billing page; absent values render as empty in the invoice.
    const meta = (owner.publicMetadata || {}) as Record<string, unknown>;
    if (typeof meta.gstin === 'string' && meta.gstin.trim()) buyerGstin = meta.gstin.trim();
    if (typeof meta.state === 'string' && meta.state.trim()) buyerState = meta.state.trim();
  } catch (e) {
    console.error('[invoice] failed to load buyer from Clerk:', e);
  }

  const invoice = buildInvoice({
    sub,
    buyer: {
      name: buyerName,
      email: buyerEmail,
      gstin: buyerGstin,
      state: buyerState,
    },
  });

  const html = renderInvoiceHTML(invoice);

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Suggest a sensible filename if the user does Save Page As.
      'Content-Disposition': `inline; filename="${invoice.invoiceNumber.replace(/\//g, '_')}.html"`,
      // Don't cache — each subscription's invoice is stable but tying
      // it to user state means CDN caching is wrong.
      'Cache-Control': 'private, no-store',
    },
  });
}
