// POST /api/client/inventory/bulk-update
//
// Multi-row patch for the inventory dashboard. Owner ticks N rows, types
// "20" in the Stock field of the bulk-action bar, hits Apply — this
// endpoint updates all N rows in one round-trip.
//
// Body: { skus: string[], patch: { stock?, low_stock_threshold?, is_active? } }
// Response: { ok: true, updated, skipped }
//
// Auth: owner or admin scoped to the active bot. SKUs that don't belong
// to the caller's client_id are silently skipped (not surfaced as errors,
// so a stale browser tab can't enumerate other tenants' SKUs by trial).
//
// Note: a separate /bulk-upsert endpoint exists for IMPORT flows (CSV /
// Excel preview commits). Different concern — that one creates new rows
// from full payloads; this one patches a few fields on existing rows.

import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { getItem, upsertItem } from '@/lib/inventory';
import { mirrorInventoryToKb } from '@/lib/inventory-sync';
import type { InventoryItem } from '@/lib/types';

interface BulkPatch {
  stock?: number;
  low_stock_threshold?: number;
  is_active?: boolean;
}

export async function POST(req: NextRequest): Promise<Response> {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ error: 'No bot selected' }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const raw = body as { skus?: unknown; patch?: unknown };
  const skus = Array.isArray(raw.skus)
    ? raw.skus.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    : [];
  if (skus.length === 0) {
    return NextResponse.json({ error: 'skus required (non-empty array)' }, { status: 400 });
  }
  if (skus.length > 500) {
    // Soft cap so a buggy client can't lock up the loop. 500 covers any
    // realistic menu; if someone has 500+ SKUs they should script the API.
    return NextResponse.json({ error: 'too many skus in one batch (max 500)' }, { status: 400 });
  }

  const patchRaw = (raw.patch || {}) as Record<string, unknown>;
  const patch: BulkPatch = {};
  if (typeof patchRaw.stock === 'number' && Number.isFinite(patchRaw.stock)) {
    patch.stock = Math.max(0, Math.floor(patchRaw.stock));
  }
  if (
    typeof patchRaw.low_stock_threshold === 'number' &&
    Number.isFinite(patchRaw.low_stock_threshold)
  ) {
    patch.low_stock_threshold = Math.max(0, Math.floor(patchRaw.low_stock_threshold));
  }
  if (typeof patchRaw.is_active === 'boolean') {
    patch.is_active = patchRaw.is_active;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: 'patch must include at least one of: stock, low_stock_threshold, is_active' },
      { status: 400 }
    );
  }

  let updated = 0;
  let skipped = 0;
  for (const sku of skus) {
    try {
      const existing = await getItem(bot.client_id, sku);
      if (!existing) {
        skipped++;
        continue;
      }
      // For tracks_stock=false items (services / memberships / unlimited-prep
      // dishes) the `stock` field is meaningless — keep the bulk action
      // honest by skipping the stock-write on those rows.
      const next: Partial<InventoryItem> & { client_id: string; name: string } = {
        client_id: existing.client_id,
        sku: existing.sku,
        name: existing.name,
      };
      if (patch.stock !== undefined && existing.tracks_stock !== false) {
        next.stock = patch.stock;
      }
      if (patch.low_stock_threshold !== undefined) {
        next.low_stock_threshold = patch.low_stock_threshold;
      }
      if (patch.is_active !== undefined) {
        next.is_active = patch.is_active;
      }
      await upsertItem(next);
      updated++;
    } catch (err) {
      console.error('[bulk-update] sku failed:', sku, err);
      skipped++;
    }
  }

  // Best-effort KB mirror so settings JSON stays in sync. Single call after
  // the loop — much cheaper than N per-item mirrors.
  mirrorInventoryToKb(bot.client_id).catch((e) =>
    console.error('[bulk-update] KB mirror failed:', e)
  );

  return NextResponse.json({ ok: true, updated, skipped });
}
