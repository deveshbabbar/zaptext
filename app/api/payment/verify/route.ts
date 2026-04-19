import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { verifyPaymentSignature } from '@/lib/razorpay';
import { createSubscription, getSubscriptionByPaymentId, PLANS, PlanKey } from '@/lib/subscription';
import { getISTTimestamp } from '@/lib/utils';
import { sendTemplate, tplSubscriptionStarted, tplAdminNewSubscription } from '@/lib/email';
import { clerkClient } from '@clerk/nextjs/server';
import { rateLimit, getClientKey } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const rl = rateLimit(getClientKey(req, '/api/payment/verify'), 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many verify attempts. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': Math.ceil(rl.resetInMs / 1000).toString() } }
    );
  }

  try {
    const user = await getUserRole();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan,
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !plan) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate plan is a real plan key before using it
    if (typeof plan !== 'string' || !(plan in PLANS)) {
      return NextResponse.json(
        { error: 'Invalid plan' },
        { status: 400 }
      );
    }
    const validPlan = plan as PlanKey;

    // Verify the payment signature
    const isValid = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid payment signature' },
        { status: 400 }
      );
    }

    // Idempotency: if this payment_id already produced a subscription,
    // return it instead of creating a second row (double-click / retry safe).
    const existing = await getSubscriptionByPaymentId(razorpay_payment_id);
    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Subscription already active for this payment',
        plan: existing.plan,
        endDate: existing.endDate,
        duplicate: true,
      });
    }

    // Calculate subscription dates (30-day cycle)
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    // Create subscription record in Google Sheets
    await createSubscription({
      userId: user.userId,
      plan: validPlan,
      status: 'active',
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      amount: PLANS[validPlan].price,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      createdAt: getISTTimestamp(),
    });

    const planLabel = PLANS[validPlan].name;
    const planAmount = PLANS[validPlan].price;

    try {
      const cc = await clerkClient();
      const ownerData = await cc.users.getUser(user.userId);
      const ownerEmail = ownerData.emailAddresses[0]?.emailAddress;
      const ownerName = `${ownerData.firstName || ''} ${ownerData.lastName || ''}`.trim() || 'there';
      const nextBilling = new Date(); nextBilling.setDate(nextBilling.getDate() + 30);
      if (ownerEmail) {
        await sendTemplate(ownerEmail, tplSubscriptionStarted({
          name: ownerName,
          plan: planLabel,
          amount: planAmount,
          nextBilling: nextBilling.toISOString().slice(0, 10),
        }), ownerName);
      }
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@zaptext.shop';
      await sendTemplate(adminEmail, tplAdminNewSubscription({
        ownerName,
        ownerEmail: ownerEmail || 'unknown',
        plan: planLabel,
        amount: planAmount,
      }));
    } catch (e) {
      console.error('Subscription emails failed:', e);
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified and subscription activated',
      plan,
      endDate: endDate.toISOString(),
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    return NextResponse.json(
      { error: 'Failed to verify payment' },
      { status: 500 }
    );
  }
}
