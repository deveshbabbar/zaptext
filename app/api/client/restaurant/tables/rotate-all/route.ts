// POST /api/client/restaurant/tables/rotate-all
//
// Manager-triggered shift token rotation. Generates a fresh qr_token for
// every active table on the bot. Useful before a service shift starts —
// any leaked old QRs immediately stop working.

import { NextResponse } from 'next/server';
import { requireClientWithBots } from '@/lib/auth';
import { listTables, rotateTableToken } from '@/lib/db/restaurant-dine-in';
import { generateQrToken } from '@/lib/restaurant-qr';

export async function POST() {
  const user = await requireClientWithBots().catch(() => null);
  if (!user || !user.activeBot || user.activeBot.type !== 'restaurant') {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const clientId = user.activeBot.client_id;
  const tables = await listTables(clientId).catch(() => []);
  for (const t of tables) {
    if (!t.is_active) continue;
    await rotateTableToken(clientId, t.table_number, generateQrToken());
  }
  return NextResponse.json({ ok: true, rotated: tables.filter((t) => t.is_active).length });
}
