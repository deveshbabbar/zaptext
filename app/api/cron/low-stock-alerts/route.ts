// /api/cron/low-stock-alerts — daily low-stock summary to restaurant owners.
//
// For every active restaurant client whose owner has WhatsApp configured,
// scan inventory rows where:
//   - tracks_stock = true
//   - stock >= 0  (i.e. tracking is enabled — `-1` means unlimited)
//   - stock <= low_stock_threshold (and threshold > 0)
//   - is_active = true
// If at least one row matches, send the owner a single bilingual
// WhatsApp message listing the items + remaining stock so they can
// re-stock the kitchen before the lunch / dinner rush.
//
// Wired into the morning bucket (09:00 IST) so owners get it during
// prep time, before customers start ordering.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clients as clientsTable, inventory as inventoryTable } from '@/lib/db/schema';
import { and, eq, gte } from 'drizzle-orm';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

interface LowItem { name: string; stock: number; threshold: number }

function buildLowStockMessage(businessName: string, items: LowItem[]): string {
  const lines = items
    .slice(0, 25) // cap so the WA message stays readable
    .map((it) => `• ${it.name} — ${it.stock} left (alert at ${it.threshold})`)
    .join('\n');
  const more = items.length > 25 ? `\n…and ${items.length - 25} more — full list in /client/inventory` : '';
  return [
    `${businessName} — Low stock alert ⚠️`,
    `${items.length} item${items.length === 1 ? '' : 's'} below your alert threshold this morning:`,
    lines + more,
    `Re-stock or mark unavailable in /client/inventory before the lunch rush.`,
    ``,
    `${businessName} — Low stock alert ⚠️`,
    `${items.length} item${items.length === 1 ? '' : 's'} aapke alert level se kam hain:`,
    `Inventory page se restock kariye ya unavailable mark kariye lunch rush se pehle.`,
  ].join('\n');
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Pull restaurant clients only — other verticals don't have menu items
  // tracked in inventory the same way and would generate noise.
  const restaurants = await db
    .select({
      client_id: clientsTable.client_id,
      business_name: clientsTable.business_name,
      whatsapp_number: clientsTable.whatsapp_number,
      phone_number_id: clientsTable.phone_number_id,
      status: clientsTable.status,
    })
    .from(clientsTable)
    .where(eq(clientsTable.type, 'restaurant'));

  const results: Array<{ client_id: string; alerted: boolean; itemCount: number; reason?: string }> = [];

  for (const r of restaurants) {
    if (r.status !== 'active') {
      results.push({ client_id: r.client_id, alerted: false, itemCount: 0, reason: 'inactive' });
      continue;
    }
    if (!r.phone_number_id || !r.whatsapp_number) {
      results.push({ client_id: r.client_id, alerted: false, itemCount: 0, reason: 'no_wa' });
      continue;
    }

    // Pull active+tracks_stock+stock>=0+threshold>=1, filter "stock <=
    // threshold" in JS — drizzle's typesafe builder doesn't have a clean
    // "field <= field" comparator, and the per-restaurant row count is
    // small (< 200 menu items typically) so JS filtering is fine.
    const rows = await db
      .select({
        name: inventoryTable.name,
        stock: inventoryTable.stock,
        low_stock_threshold: inventoryTable.low_stock_threshold,
      })
      .from(inventoryTable)
      .where(and(
        eq(inventoryTable.client_id, r.client_id),
        eq(inventoryTable.tracks_stock, true),
        eq(inventoryTable.is_active, true),
        gte(inventoryTable.stock, 0),
        gte(inventoryTable.low_stock_threshold, 1),
      ));

    const lowItems: LowItem[] = rows
      .filter((row) => row.stock <= row.low_stock_threshold)
      .map((row) => ({ name: row.name, stock: row.stock, threshold: row.low_stock_threshold }))
      .sort((a, b) => a.stock - b.stock);

    if (lowItems.length === 0) {
      results.push({ client_id: r.client_id, alerted: false, itemCount: 0, reason: 'all_good' });
      continue;
    }

    try {
      const ownerPhone = r.whatsapp_number.replace(/\D/g, '');
      const text = buildLowStockMessage(r.business_name, lowItems);
      await sendWhatsAppMessage(r.phone_number_id, ownerPhone, text);
      results.push({ client_id: r.client_id, alerted: true, itemCount: lowItems.length });
    } catch (err) {
      console.error('[low-stock-alerts] send failed', { client_id: r.client_id, err });
      results.push({ client_id: r.client_id, alerted: false, itemCount: lowItems.length, reason: 'send_failed' });
    }
  }

  const totalAlerts = results.filter((r) => r.alerted).length;
  return NextResponse.json({
    ok: true,
    summary: `Notified ${totalAlerts} of ${restaurants.length} restaurants`,
    results,
  });
}
