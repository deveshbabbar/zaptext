import { NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { getAllClients } from '@/lib/google-sheets';
import { google } from 'googleapis';
import { PLANS } from '@/lib/subscription';

interface SubRow {
  userId: string;
  plan: string;
  status: string;
  amount: number;
  startDate: string;
  endDate: string;
  createdAt: string;
}

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

    let subscriptions: SubRow[] = [];
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
        createdAt: row[8] || '',
      }));
    } catch {
      // subscriptions sheet may not exist yet
    }

    const planPrice = (key: string): number => {
      const p = (PLANS as Record<string, { price: number }>)[key];
      return p?.price || 0;
    };

    const activeSubs = subscriptions.filter((s) => s.status === 'active');
    const mrr = activeSubs.reduce((sum, s) => sum + (s.amount || planPrice(s.plan)), 0);
    const totalRevenue = subscriptions.reduce(
      (sum, s) => sum + (s.amount || planPrice(s.plan)),
      0,
    );
    const activeCount = activeSubs.length;
    const churnRate = 0;

    // Monthly chart: last 6 months by createdAt (or startDate fallback)
    const now = new Date();
    const months: { key: string; label: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-US', { month: 'short' });
      months.push({ key, label, value: 0 });
    }
    for (const s of subscriptions) {
      const raw = s.createdAt || s.startDate;
      if (!raw) continue;
      const d = new Date(raw);
      if (isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bucket = months.find((m) => m.key === key);
      if (bucket) bucket.value += s.amount || planPrice(s.plan);
    }

    // Map userId -> business names
    const userToClients = new Map<string, string[]>();
    for (const c of clients) {
      const existing = userToClients.get(c.owner_user_id) || [];
      existing.push(c.business_name);
      userToClients.set(c.owner_user_id, existing);
    }

    const recent = subscriptions
      .slice()
      .sort((a, b) => (b.createdAt || b.startDate || '').localeCompare(a.createdAt || a.startDate || ''))
      .slice(0, 20)
      .map((s) => ({
        ...s,
        businessNames: userToClients.get(s.userId) || ['Unknown'],
      }));

    return NextResponse.json({
      mrr,
      totalRevenue,
      activeCount,
      churnRate,
      chart: months.map((m) => ({ month: m.label, value: m.value })),
      recent,
    });
  } catch (error) {
    console.error('Admin revenue error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
