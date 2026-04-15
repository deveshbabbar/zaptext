import { NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { getAllClients } from '@/lib/google-sheets';
import { google } from 'googleapis';
import { PLANS } from '@/lib/subscription';

export async function GET() {
  const user = await getUserRole();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const clients = await getAllClients();
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    let subscriptions: Array<{
      userId: string;
      plan: string;
      status: string;
      amount: number;
      startDate: string;
      endDate: string;
    }> = [];
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SPREADSHEET_ID!,
        range: 'subscriptions!A2:I',
      });
      const rows = res.data.values || [];
      subscriptions = rows.map((row) => ({
        userId: row[0] || '',
        plan: row[1] || '',
        status: row[2] || '',
        amount: Number(row[5] || 0),
        startDate: row[6] || '',
        endDate: row[7] || '',
      }));
    } catch {
      // subscriptions sheet may not exist yet
    }

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
