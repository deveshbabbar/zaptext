// GET /api/client/customers
//
// Returns the unified customer list for the caller's active bot —
// every unique phone that has chatted, booked, or placed an order
// (dine-in / takeaway / delivery / grocery) — with the freshest
// known name and per-source counts.
//
// Used by /client/customers (page) and the CSV-download link there.
// Auth: same as every other /api/client/* route (Clerk session +
// resolveActiveBot scoped to the user's own client_id).

import { NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { listCustomersForClient, summariseCustomerList } from '@/lib/db/customers';

export async function GET() {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const bot = await resolveActiveBot(user.userId);
  if (!bot) {
    return NextResponse.json({
      customers: [],
      totals: { totalCustomers: 0, totalMessages: 0, totalBookings: 0, totalOrders: 0, totalGroceryOrders: 0 },
    });
  }

  try {
    const customers = await listCustomersForClient(bot.client_id);
    const totals = summariseCustomerList(customers);
    return NextResponse.json({ customers, totals });
  } catch (err) {
    console.error('[api/client/customers] error', err);
    return NextResponse.json(
      { error: 'Failed to load customers' },
      { status: 500 }
    );
  }
}
