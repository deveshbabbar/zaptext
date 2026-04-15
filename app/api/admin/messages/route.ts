import { NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { getAllClients } from '@/lib/google-sheets';
import { google } from 'googleapis';

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
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID!,
      range: 'conversations!A2:F',
    });
    const rows = res.data.values || [];

    // Build client lookup
    const clientById = new Map(clients.map((c) => [c.client_id, c]));

    // Group by customer phone + client
    const grouped = new Map<
      string,
      {
        client_id: string;
        customer_phone: string;
        lastMessage: string;
        lastTimestamp: string;
        messageCount: number;
        lastDirection: string;
      }
    >();
    let todayCount = 0;
    const todayPrefix = new Date()
      .toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
      .replace(/\//g, '/');
    for (const row of rows) {
      const timestamp = row[0] || '';
      const client_id = row[1] || '';
      const customer_phone = row[2] || '';
      const direction = row[3] || '';
      const message = row[4] || '';
      if (!client_id || !customer_phone) continue;
      const key = `${client_id}::${customer_phone}`;
      const existing = grouped.get(key);
      if (!existing || timestamp > existing.lastTimestamp) {
        grouped.set(key, {
          client_id,
          customer_phone,
          lastMessage: message,
          lastTimestamp: timestamp,
          messageCount: (existing?.messageCount || 0) + 1,
          lastDirection: direction,
        });
      } else {
        existing.messageCount++;
      }
      if (timestamp.includes(todayPrefix)) todayCount++;
    }

    const conversations = Array.from(grouped.values())
      .map((c) => ({
        ...c,
        business_name: clientById.get(c.client_id)?.business_name || 'Unknown',
        business_type: clientById.get(c.client_id)?.type || '',
      }))
      .sort((a, b) => (b.lastTimestamp || '').localeCompare(a.lastTimestamp || ''));

    return NextResponse.json({
      conversations,
      stats: {
        totalConversations: conversations.length,
        totalMessages: rows.length,
        today: todayCount,
        avgPerClient: clients.length > 0 ? Math.round(rows.length / clients.length) : 0,
      },
    });
  } catch (error) {
    console.error('Admin messages error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
