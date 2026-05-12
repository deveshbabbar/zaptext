// /api/client/restaurant/tables
//   GET   → list tables for the active restaurant bot
//   POST  → upsert a table { tableNumber, seats? } (auto-generates qr_token)
//   DELETE?tableNumber=N → deactivate a table

import { NextRequest, NextResponse } from 'next/server';
import { requireClientWithBots } from '@/lib/auth';
import {
  listTables,
  upsertTable,
  deactivateTable,
} from '@/lib/db/restaurant-dine-in';
import { generateQrToken } from '@/lib/restaurant-qr';
import { isDineInEnabledForClient } from '@/lib/restaurant/dine-in-handler';

async function authedClient(): Promise<{ clientId: string } | NextResponse> {
  const user = await requireClientWithBots().catch(() => null);
  if (!user || !user.activeBot || user.activeBot.type !== 'restaurant') {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  return { clientId: user.activeBot.client_id };
}

async function requireDineInEnabled(clientId: string): Promise<NextResponse | null> {
  const enabled = await isDineInEnabledForClient(clientId);
  if (enabled) return null;
  return NextResponse.json(
    { ok: false, error: 'PLAN_LIMIT', message: 'Dine-in QR ordering is on Growth+ plans. Upgrade to unlock.', upgradeTo: 'growth' },
    { status: 403 }
  );
}

export async function GET() {
  const auth = await authedClient();
  if (auth instanceof NextResponse) return auth;
  const tables = await listTables(auth.clientId).catch(() => []);
  return NextResponse.json({ ok: true, tables });
}

export async function POST(request: NextRequest) {
  const auth = await authedClient();
  if (auth instanceof NextResponse) return auth;
  const gate = await requireDineInEnabled(auth.clientId);
  if (gate) return gate;

  let body: { tableNumber?: string; seats?: number };
  try {
    body = (await request.json()) as { tableNumber?: string; seats?: number };
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const tableNumber = String(body.tableNumber || '').trim();
  if (!tableNumber) return NextResponse.json({ ok: false, error: 'Missing tableNumber' }, { status: 400 });
  if (!/^[\w-]{1,16}$/.test(tableNumber)) {
    return NextResponse.json({ ok: false, error: 'Table number must be 1-16 letters / digits / dashes' }, { status: 400 });
  }

  const seats = Math.max(0, Math.floor(Number(body.seats) || 0));
  const token = generateQrToken();
  const table = await upsertTable({
    client_id: auth.clientId,
    table_number: tableNumber,
    qr_token: token,
    seats,
  });
  return NextResponse.json({ ok: true, table });
}

export async function DELETE(request: NextRequest) {
  const auth = await authedClient();
  if (auth instanceof NextResponse) return auth;
  const tableNumber = request.nextUrl.searchParams.get('tableNumber') || '';
  if (!tableNumber) return NextResponse.json({ ok: false, error: 'Missing tableNumber' }, { status: 400 });
  await deactivateTable(auth.clientId, tableNumber);
  return NextResponse.json({ ok: true });
}
