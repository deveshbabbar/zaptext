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

  // CSV-injection (formula / DDE injection) defence. Message content
  // is fully customer-controlled (customers WhatsApp the bot and that
  // text lands here verbatim). Excel / LibreOffice / Google Sheets
  // evaluate any cell whose first character is `=  +  -  @  TAB  CR`
  // as a formula — so a customer message like
  // `=HYPERLINK("http://evil.com","click")` would fire as a live link
  // when the owner next opened the CSV. Prefix any such value with a
  // single quote (Microsoft-documented mitigation) — cosmetic in
  // plain-text viewers, defangs the formula in every spreadsheet.
  const escape = (v: string) => {
    const s = String(v ?? '');
    const lead = s.charCodeAt(0);
    // 0x09 TAB, 0x0D CR, '=' 0x3D, '+' 0x2B, '-' 0x2D, '@' 0x40
    const isFormula = lead === 0x09 || lead === 0x0d || lead === 0x3d || lead === 0x2b || lead === 0x2d || lead === 0x40;
    const safe = isFormula ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
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
