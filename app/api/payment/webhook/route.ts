import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  createSubscription,
  getSubscriptionByPaymentId,
  cancelSubscriptionByPaymentId,
  PLANS,
  PlanKey,
  DURATIONS,
  isDurationKey,
  computePlanPrice,
} from '@/lib/subscription';
import { cancelPendingBookingsForOwner } from '@/lib/booking';
import { getISTTimestamp } from '@/lib/utils';

// Razorpay server-to-server webhook.
// Configure in Razorpay dashboard → Settings → Webhooks → URL:
//   https://<your-domain>/api/payment/webhook
// Subscribe to events: payment.captured (and optionally payment.failed).
// Set the webhook secret in env as RAZORPAY_WEBHOOK_SECRET.
//
// Why this exists: the client-side /api/payment/verify only fires when the
// browser callback runs. If the customer closes the popup mid-flow, payment
// captures in Razorpay but no subscription row is created — owner has paid
// but bot is still gated. This webhook is the safety-net that creates the
// subscription idempotently.

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature') || '';
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!secret) {
      console.error('[razorpay-webhook] RAZORPAY_WEBHOOK_SECRET not set — rejecting');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
    }

    // Verify HMAC-SHA256 signature.
    //
    // Razorpay sends the signature as a hex string. Decode BOTH the expected
    // and the received signature as hex (not utf8) before comparing — utf8
    // decoding pulls in multi-byte expansion for any non-ASCII char, which
    // changes byte length and trips length checks unpredictably. Hex decode
    // also catches malformed signatures (invalid hex chars produce a shorter
    // buffer, so length comparison fails fast and timingSafeEqual never sees
    // mismatched-size inputs).
    const expectedHex = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    let expectedBuf: Buffer;
    let receivedBuf: Buffer;
    try {
      expectedBuf = Buffer.from(expectedHex, 'hex');
      receivedBuf = Buffer.from(signature, 'hex');
    } catch {
      console.warn('[razorpay-webhook] signature buffer decode failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }
    if (
      expectedBuf.length === 0 ||
      receivedBuf.length === 0 ||
      expectedBuf.length !== receivedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, receivedBuf)
    ) {
      console.warn('[razorpay-webhook] signature mismatch');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    let body: { event?: string; payload?: { payment?: { entity?: Record<string, unknown> } } };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ ok: true });
    }

    // We act on three events:
    //   - payment.captured   → create the subscription row
    //   - payment.refunded   → mark the matching subscription cancelled so
    //                          the user loses bot access immediately
    //   - everything else    → 200 OK and log (e.g. payment.failed, audit)
    if (body.event === 'payment.refunded') {
      const refundedPaymentId = String(body.payload?.payment?.entity?.id || '');
      if (!refundedPaymentId) {
        console.warn('[razorpay-webhook] refund event without payment id');
        return NextResponse.json({ ok: true, skipped: true });
      }
      // Look up the subscription FIRST so we have the userId before we
      // mark it cancelled — needed to cascade-cancel orphan bookings.
      const sub = await getSubscriptionByPaymentId(refundedPaymentId).catch(() => null);
      const cancelled = await cancelSubscriptionByPaymentId(refundedPaymentId);

      // Cascade: any pending_approval bookings can never get approved
      // once the plan lapses (feature gates strip the trainer's tags),
      // so free those slots proactively. Confirmed bookings stay — the
      // customer is supposed to attend them; the owner can manually
      // cancel if they choose.
      let bookingsCancelled = 0;
      if (sub?.userId) {
        try {
          bookingsCancelled = await cancelPendingBookingsForOwner(
            sub.userId,
            'subscription_refunded'
          );
        } catch (err) {
          console.error('[razorpay-webhook] cascade cancel failed (non-fatal):', err);
        }
      }

      console.log('[razorpay-webhook] refund processed', {
        paymentId: refundedPaymentId,
        cancelledSubscription: cancelled,
        cascadedBookings: bookingsCancelled,
      });
      return NextResponse.json({ ok: true, refunded: true, cancelled, bookingsCancelled });
    }
    if (body.event !== 'payment.captured') {
      console.log('[razorpay-webhook] event ignored:', body.event);
      return NextResponse.json({ ok: true });
    }

    const payment = body.payload?.payment?.entity || {};
    const paymentId = String(payment.id || '');
    const orderId = String(payment.order_id || '');
    const amountPaise = typeof payment.amount === 'number' ? payment.amount : parseInt(String(payment.amount || '0'), 10);
    const notes = (payment.notes as Record<string, string> | undefined) || {};
    const userId = notes.userId || notes.user_id || '';
    const planNote = notes.plan || '';
    const monthsNote = notes.months ? parseInt(String(notes.months), 10) : 1;

    if (!paymentId || !orderId || !userId || !planNote) {
      // We previously returned 200 here so Razorpay wouldn't retry, but that
      // turned a real "money captured, subscription never created" bug into
      // a silent failure. Return 400 instead — Razorpay will retry a small
      // number of times, giving the platform a chance to recover (e.g. if
      // a transient infra issue dropped notes mid-payload). After retry
      // budget is exhausted the event lands in the Razorpay webhook log
      // for manual reconciliation, which is what we want.
      console.warn('[razorpay-webhook] missing fields — cannot create subscription', {
        paymentId, orderId, userId, planNote,
      });
      return NextResponse.json({ error: 'missing notes', paymentId }, { status: 400 });
    }

    // Idempotency: skip if this payment_id already produced a subscription row.
    const existing = await getSubscriptionByPaymentId(paymentId);
    if (existing) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    if (!(planNote in PLANS)) {
      console.warn('[razorpay-webhook] unknown plan:', planNote);
      return NextResponse.json({ ok: true, skipped: true });
    }
    if (!isDurationKey(monthsNote)) {
      console.warn('[razorpay-webhook] bad duration:', monthsNote);
      return NextResponse.json({ ok: true, skipped: true });
    }

    const plan = planNote as PlanKey;
    const months = monthsNote;
    const planAmount = computePlanPrice(plan, months);

    // Sanity-check captured amount vs expected plan price (paise → rupees).
    const paidRupees = Math.round(amountPaise / 100);
    if (Math.abs(paidRupees - planAmount) > 1) {
      console.warn('[razorpay-webhook] amount mismatch — plan vs captured', {
        plan, months, expected: planAmount, captured: paidRupees,
      });
      // Still record so admin can manually reconcile from /admin/revenue.
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + months);

    await createSubscription({
      userId,
      plan,
      status: 'active',
      razorpayPaymentId: paymentId,
      razorpayOrderId: orderId,
      amount: planAmount,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      createdAt: getISTTimestamp(),
    });

    console.log('[razorpay-webhook] subscription created via webhook', {
      userId, plan, months, paymentId,
    });

    // Reference DURATIONS so the import isn't tree-shaken; reserved for the
    // upcoming duration-aware confirmation email.
    void DURATIONS;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[razorpay-webhook] handler error:', err);
    // Return 500 (NOT 200) so Razorpay retries the delivery within its
    // 24h retry budget. The previous 200 here turned a real
    // "money captured, subscription never created" outage into a
    // silent failure — if Neon was flaky for 30 seconds during the
    // first delivery, the customer paid but never got their plan.
    // Razorpay caps retries at ~5 attempts so we won't get hammered;
    // anything still failing after that lands in the dashboard
    // webhook log for manual reconciliation, which is what we want.
    return NextResponse.json(
      { ok: false, error: String(err).slice(0, 200) },
      { status: 500 }
    );
  }
}
