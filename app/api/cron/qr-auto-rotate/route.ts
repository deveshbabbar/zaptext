// /api/cron/qr-auto-rotate — daily QR token rotation for opted-in restaurants.
//
// For each restaurant client with `kb.qrAutoRotateEnabled === true`,
// rotates every table's qr_token if the last rotation was longer ago
// than the configured interval (default 24h). Old printed QRs / screenshots
// stop working after rotation — owner gets a system notification reminding
// them to reprint the sheet.
//
// Wired into the morning bucket so it runs at 09:00 IST — owners reprint
// during morning prep, before the first customers arrive.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clients as clientsTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { listTables, rotateTableToken } from '@/lib/db/restaurant-dine-in';
import { generateQrToken } from '@/lib/restaurant-qr';

const DEFAULT_INTERVAL_HOURS = 24;

interface KbShape {
  qrAutoRotateEnabled?: unknown;
  qrAutoRotateIntervalHours?: unknown;
}

function parseKb(raw: string | null | undefined): KbShape {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? (v as KbShape) : {};
  } catch {
    return {};
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const restaurants = await db
    .select({
      client_id: clientsTable.client_id,
      knowledge_base_json: clientsTable.knowledge_base_json,
    })
    .from(clientsTable)
    .where(eq(clientsTable.type, 'restaurant'));

  const results: Array<{ client_id: string; rotated: number; skipped: number; reason?: string }> = [];

  for (const r of restaurants) {
    const kb = parseKb(r.knowledge_base_json);
    if (kb.qrAutoRotateEnabled !== true) {
      results.push({ client_id: r.client_id, rotated: 0, skipped: 0, reason: 'opt-out' });
      continue;
    }
    const intervalHours = typeof kb.qrAutoRotateIntervalHours === 'number' && kb.qrAutoRotateIntervalHours > 0
      ? Math.max(6, Math.min(168, kb.qrAutoRotateIntervalHours))
      : DEFAULT_INTERVAL_HOURS;
    const cutoffMs = Date.now() - intervalHours * 60 * 60 * 1000;

    const tables = await listTables(r.client_id).catch(() => []);
    let rotated = 0;
    let skipped = 0;
    for (const t of tables) {
      if (!t.is_active) { skipped++; continue; }
      const lastMs = t.qr_token_rotated_at ? new Date(t.qr_token_rotated_at).getTime() : 0;
      if (lastMs > cutoffMs) {
        skipped++;
        continue;
      }
      await rotateTableToken(r.client_id, t.table_number, generateQrToken()).catch(() => undefined);
      rotated++;
    }
    results.push({ client_id: r.client_id, rotated, skipped });
  }

  const totalRotated = results.reduce((s, r) => s + r.rotated, 0);
  return NextResponse.json({
    ok: true,
    summary: `Rotated ${totalRotated} tokens across ${results.length} restaurants`,
    results,
  });
}
