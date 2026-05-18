import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { createSubscription, PLANS, type PlanKey } from '@/lib/subscription';
import { clerkClient } from '@clerk/nextjs/server';
import { writeAuditLog } from '@/lib/db/audit-log';

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

    // Clamp [1, 24] so an admin typo (`months: 1000`) doesn't grant a
    // subscription ending in the year 3026. 24 months covers the
    // longest legitimate manual grant (2-year promo / strategic
    // partner deal); anything beyond that is treated as a mistake.
    const rawMonths = typeof months === 'number' && Number.isFinite(months) ? Math.floor(months) : 12;
    const durationMonths = Math.min(Math.max(rawMonths, 1), 24);

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

    // Audit trail: who granted what plan to whom and for how long. Lets us
    // resolve billing disputes and abuse questions later. Best-effort —
    // never blocks the underlying grant.
    await writeAuditLog({
      actorUserId: user.userId,
      actorEmail: user.email,
      action: 'plan.grant',
      targetUserId: targetUser.id,
      targetEmail: email,
      details: {
        plan,
        months: durationMonths,
        amount: PLANS[plan as PlanKey].price,
        validUntil: end.toISOString(),
      },
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
