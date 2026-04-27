import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  createSubscription,
  getSubscriptionByPaymentId,
  PLANS,
  PlanKey,
  DURATIONS,
  isDurationKey,
  computePlanPrice,
} from '@/lib/subscription';
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

    // Verify HMAC-SHA256 signature
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      console.warn('[razorpay-webhook] signature mismatch');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    let body: { event?: string; payload?: { payment?: { entity?: Record<string, unknown> } } };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ ok: true });
    }

    // Only act on payment.captured. payment.failed is logged for audit.
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
      console.warn('[razorpay-webhook] missing fields — cannot create subscription', {
        paymentId, orderId, userId, planNote,
      });
      // 200 OK so Razorpay doesn't retry forever; we logged the gap.
      return NextResponse.json({ ok: true, skipped: true });
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
    // Return 200 to avoid Razorpay retry storms; log for manual reconciliation.
    return NextResponse.json({ ok: true, error: String(err).slice(0, 200) });
  }
}
