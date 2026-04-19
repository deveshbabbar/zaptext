import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { createOrder } from '@/lib/razorpay';
import { PLANS, PlanKey } from '@/lib/subscription';
import { generateId } from '@/lib/utils';
import { rateLimit, getClientKey } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const rl = rateLimit(getClientKey(req, '/api/payment/create-order'), 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many order attempts. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': Math.ceil(rl.resetInMs / 1000).toString() } }
    );
  }

  try {
    const user = await getUserRole();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const plan = body.plan as PlanKey;

    if (!plan || !PLANS[plan]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const amount = PLANS[plan].price;
    const receipt = `rcpt_${generateId().slice(0, 8)}`;

    const order = await createOrder(amount, 'INR', receipt);

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      plan,
    });
  } catch (error) {
    console.error('Create order error:', error);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
