import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { verifyPaymentSignature } from '@/lib/razorpay';
import { createSubscription, PLANS, PlanKey } from '@/lib/subscription';
import { getISTTimestamp } from '@/lib/utils';
import { sendTemplate, tplSubscriptionStarted, tplAdminNewSubscription } from '@/lib/email';
import { clerkClient } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
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

    // Calculate subscription dates (30-day cycle)
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    // Create subscription record in Google Sheets
    await createSubscription({
      userId: user.userId,
      plan: plan as PlanKey,
      status: 'active',
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      amount: PLANS[plan as PlanKey].price,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      createdAt: getISTTimestamp(),
    });

    const planLabel = PLANS[plan as PlanKey].name;
    const planAmount = PLANS[plan as PlanKey].price;

    try {
      const cc = await clerkClient();
      const ownerData = await cc.users.getUser(user.userId);
      const ownerEmail = ownerData.emailAddresses[0]?.emailAddress;
      const ownerName = `${ownerData.firstName || ''} ${ownerData.lastName || ''}`.trim() || 'there';
      const nextBilling = new Date(); nextBilling.setMonth(nextBilling.getMonth() + 1);
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
