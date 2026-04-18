import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { createSubscription, PLANS, type PlanKey } from '@/lib/subscription';
import { clerkClient } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
  const user = await getUserRole();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { email, plan, months } = await req.json();

    if (!email || !plan || !PLANS[plan as PlanKey]) {
      return NextResponse.json({ error: 'email and valid plan required' }, { status: 400 });
    }

    const durationMonths = typeof months === 'number' && months > 0 ? months : 12;

    const cc = await clerkClient();
    const found = await cc.users.getUserList({ emailAddress: [email], limit: 5 });
    const targetUser = found.data[0];
    if (!targetUser) {
      return NextResponse.json({ error: `No Clerk user found with email ${email}` }, { status: 404 });
    }

    const now = new Date();
    const end = new Date(now);
    end.setMonth(end.getMonth() + durationMonths);

    await createSubscription({
      userId: targetUser.id,
      plan: plan as PlanKey,
      status: 'active',
      razorpayPaymentId: 'admin-grant',
      razorpayOrderId: 'admin-grant',
      amount: PLANS[plan as PlanKey].price,
      startDate: now.toISOString(),
      endDate: end.toISOString(),
      createdAt: now.toISOString(),
    });

    return NextResponse.json({
      ok: true,
      userId: targetUser.id,
      name: `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim(),
      email,
      plan,
      validUntil: end.toISOString().slice(0, 10),
    });
  } catch (err) {
    console.error('grant-plan error:', err);
    return NextResponse.json({ error: String(err).slice(0, 400) }, { status: 500 });
  }
}
