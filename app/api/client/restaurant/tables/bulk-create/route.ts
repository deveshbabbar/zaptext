// POST /api/client/restaurant/tables/bulk-create
// Body: { count: number, seats?: number, startFrom?: number }
//
// One-click table setup. Creates tables numbered startFrom..startFrom+count-1
// (default 1..count), each with a fresh qr_token. Skips numbers that already
// exist for this client.

import { NextRequest, NextResponse } from 'next/server';
import { requireClientWithBots } from '@/lib/auth';
import { listTables, upsertTable } from '@/lib/db/restaurant-dine-in';
import { generateQrToken } from '@/lib/restaurant-qr';
import { isDineInEnabledForClient } from '@/lib/restaurant/dine-in-handler';

const MAX_BULK = 100;

export async function POST(request: NextRequest) {
  const user = await requireClientWithBots().catch(() => null);
  if (!user || !user.activeBot || user.activeBot.type !== 'restaurant') {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: { count?: number; seats?: number; startFrom?: number };
  try {
    body = (await request.json()) as { count?: number; seats?: number; startFrom?: number };
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const count = Math.floor(Number(body.count) || 0);
  const seats = Math.max(0, Math.floor(Number(body.seats) || 0));
  const startFrom = Math.max(1, Math.floor(Number(body.startFrom) || 1));
  if (count < 1 || count > MAX_BULK) {
    return NextResponse.json({ ok: false, error: `count must be 1..${MAX_BULK}` }, { status: 400 });
  }

  const clientId = user.activeBot.client_id;
  if (!(await isDineInEnabledForClient(clientId))) {
    return NextResponse.json(
      { ok: false, error: 'PLAN_LIMIT', message: 'Dine-in QR ordering is on Growth+ plans. Upgrade to unlock.', upgradeTo: 'growth' },
      { status: 403 }
    );
  }
  const existing = new Set((await listTables(clientId).catch(() => [])).map((t) => t.table_number));

  let created = 0;
  let skipped = 0;
  for (let i = 0; i < count; i++) {
    const tableNumber = String(startFrom + i);
    if (existing.has(tableNumber)) {
      skipped += 1;
      continue;
    }
    await upsertTable({
      client_id: clientId,
      table_number: tableNumber,
      qr_token: generateQrToken(),
      seats,
    });
    created += 1;
  }

  return NextResponse.json({ ok: true, created, skipped });
}
