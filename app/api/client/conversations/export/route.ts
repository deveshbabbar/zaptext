import { NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { getClientConversations } from '@/lib/google-sheets';

export async function GET() {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ error: 'No bot selected' }, { status: 400 });

  const rows = await getClientConversations(bot.client_id);
  const format = (bot.export_format || 'csv') as 'csv' | 'json';
  const filename = `conversations-${bot.client_id}`;

  if (format === 'json') {
    const data = rows.map(({ timestamp, customer_phone, direction, message_type, message }) => ({
      timestamp, customer_phone, direction, message_type, message,
    }));
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}.json"`,
      },
    });
  }

  const escape = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = 'timestamp,customer_phone,direction,message_type,message';
  const lines = rows.map((r) =>
    [r.timestamp, r.customer_phone, r.direction, r.message_type, r.message].map(escape).join(',')
  );
  const csv = [header, ...lines].join('\r\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}.csv"`,
    },
  });
}
