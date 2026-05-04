import { NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { getAllClients } from '@/lib/google-sheets';
import { PLANS, getAllSubscriptions } from '@/lib/subscription';

export async function GET() {
  const user = await getUserRole();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const clients = await getAllClients();

    // Was Sheets-backed (`subscriptions!A2:I`); now reads Neon. Same row
    // shape used by the per-plan aggregation below.
    const allSubs = await getAllSubscriptions().catch(() => []);
    const subscriptions = allSubs.map((s) => ({
      userId: s.userId,
      plan: s.plan,
      status: s.status,
      amount: s.amount,
      startDate: s.startDate,
      endDate: s.endDate,
    }));

    // Aggregate by plan
    const planStats: Record<
      string,
      { name: string; price: number; activeCount: number; revenue: number }
    > = {};
    for (const [key, p] of Object.entries(PLANS) as Array<
      [string, { name: string; price: number }]
    >) {
      planStats[key] = { name: p.name, price: p.price, activeCount: 0, revenue: 0 };
    }
    for (const s of subscriptions) {
      if (s.status === 'active' && planStats[s.plan]) {
        planStats[s.plan].activeCount++;
        planStats[s.plan].revenue += s.amount || planStats[s.plan].price;
      }
    }

    // Map subs to client business names
    const userToClients = new Map<string, string[]>();
    for (const c of clients) {
      const existing = userToClients.get(c.owner_user_id) || [];
      existing.push(c.business_name);
      userToClients.set(c.owner_user_id, existing);
    }

    const enrichedSubs = subscriptions.map((s) => ({
      ...s,
      businessNames: userToClients.get(s.userId) || ['Unknown'],
    }));

    return NextResponse.json({
      planStats: Object.values(planStats),
      subscriptions: enrichedSubs,
      totalActive: enrichedSubs.filter((s) => s.status === 'active').length,
      totalMRR: Object.values(planStats).reduce((sum, p) => sum + p.revenue, 0),
    });
  } catch (error) {
    console.error('Admin subscriptions error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
