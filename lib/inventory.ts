// Inventory: pure utilities + Neon-backed DB layer.
// DB-touching functions live in lib/db/inventory.ts and are re-exported here.

import type { InventoryItem } from './types';
import {
  getActiveInventory as _getActiveInventory,
  adjustStock,
} from './db/inventory';

// Re-export the DB-touching functions so callers keep importing from
// '@/lib/inventory'.
export {
  getInventory,
  getActiveInventory,
  getItem,
  upsertItem,
  setStock,
  adjustStock,
  batchUpsertItems,
  deleteItem,
} from './db/inventory';

// ─── Pure utilities (no I/O) ─────────────────────────────────────────────

// Check if an item is available at a specific IST moment. An item with no
// time window (both available_from/to empty) is always available. Time
// windows support wrap-around midnight (e.g. from=22:00, to=02:00).
// available_days empty/absent = available every day of the week.
export function isItemAvailableNow(item: InventoryItem, now: Date = new Date()): boolean {
  // Convert to IST for the day-of-week + HH:MM check.
  const istFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = istFormatter.formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value?.toLowerCase().slice(0, 3) || '';
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const minsNow = parseInt(hour, 10) * 60 + parseInt(minute, 10);

  // Day-of-week check
  if (item.available_days && item.available_days.length > 0 && !item.available_days.includes(weekday)) {
    return false;
  }

  // Time window check (empty = always available)
  const from = (item.available_from || '').trim();
  const to = (item.available_to || '').trim();
  if (!from && !to) return true;
  const parseHHMM = (s: string): number | null => {
    const m = s.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = parseInt(m[1], 10);
    const mn = parseInt(m[2], 10);
    if (h < 0 || h > 23 || mn < 0 || mn > 59) return null;
    return h * 60 + mn;
  };
  const fromMins = from ? parseHHMM(from) : 0;
  const toMins = to ? parseHHMM(to) : 24 * 60;
  if (fromMins === null || toMins === null) return true; // malformed — fail open

  if (fromMins <= toMins) {
    return minsNow >= fromMins && minsNow < toMins;
  }
  // Wrap around midnight (e.g. 22:00 → 02:00)
  return minsNow >= fromMins || minsNow < toMins;
}

export function formatAvailabilityHuman(item: InventoryItem): string {
  const from = (item.available_from || '').trim();
  const to = (item.available_to || '').trim();
  const days = item.available_days || [];
  const hasWindow = from || to;
  const hasDays = days.length > 0 && days.length < 7;
  if (!hasWindow && !hasDays) return 'always available';
  const parts: string[] = [];
  if (hasWindow) parts.push(`${from || '00:00'}–${to || '24:00'}`);
  if (hasDays) parts.push(days.map((d) => d[0].toUpperCase() + d.slice(1)).join('/'));
  return parts.join(' · ');
}

export function slugify(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'item'
  );
}

export function parseQuantityFromToken(raw: string): { qty: number; name: string } {
  const m = raw.match(/^\s*(\d+)\s*[xX*×]\s*(.+?)\s*$/);
  if (m) return { qty: parseInt(m[1], 10), name: m[2].trim() };
  return { qty: 1, name: raw.trim() };
}

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function findBestMatch(items: InventoryItem[], query: string): InventoryItem | null {
  if (!items.length || !query.trim()) return null;
  const q = normalizeForMatch(query);
  if (!q) return null;

  const exact = items.find((it) => it.sku === slugify(query) || normalizeForMatch(it.name) === q);
  if (exact) return exact;

  const qTokens = new Set(q.split(' ').filter(Boolean));
  let best: InventoryItem | null = null;
  let bestScore = 0;
  for (const it of items) {
    const n = normalizeForMatch(it.name);
    const nTokens = new Set(n.split(' ').filter(Boolean));
    let overlap = 0;
    qTokens.forEach((t) => {
      if (nTokens.has(t)) overlap++;
    });
    if (n.includes(q) || q.includes(n)) overlap += 2;
    if (overlap > bestScore) {
      bestScore = overlap;
      best = it;
    }
  }
  return bestScore >= 1 ? best : null;
}

// ─── Reserve (atomic-ish) an order against inventory ───
//
// Two-phase: (1) match every requested token to an active inventory item
// and check stock-vs-requested; (2) if all lines have stock, decrement
// each item's stock individually. This is "atomic-ish" — Neon transactions
// would make it fully atomic, but the current bot flow tolerates the
// extremely rare race-window in step 2 (we'd reduce stock past zero,
// which is harmless because the order has already been confirmed).

export interface ReservationLine {
  requested: string;
  qtyRequested: number;
  matchedSku: string | null;
  matchedName: string | null;
  stockBefore: number;
  stockAfter: number;
  shortfall: number;
}

export interface ReservationResult {
  success: boolean;
  lines: ReservationLine[];
  lowStockAlerts: { sku: string; name: string; stock: number; threshold: number }[];
}

export async function reserveOrder(
  clientId: string,
  rawItemTokens: string[]
): Promise<ReservationResult> {
  const active = await _getActiveInventory(clientId);
  const lines: ReservationLine[] = rawItemTokens.map((raw) => {
    const parsed = parseQuantityFromToken(raw);
    const match = findBestMatch(active, parsed.name);
    const stockBefore = match ? match.stock : 0;
    const shortfall = match ? Math.max(0, parsed.qty - stockBefore) : parsed.qty;
    return {
      requested: raw,
      qtyRequested: parsed.qty,
      matchedSku: match ? match.sku : null,
      matchedName: match ? match.name : null,
      stockBefore,
      stockAfter: match ? stockBefore - parsed.qty + shortfall : 0,
      shortfall,
    };
  });

  const anyShortfall = lines.some((l) => l.shortfall > 0 || !l.matchedSku);
  if (anyShortfall) {
    return { success: false, lines, lowStockAlerts: [] };
  }

  const lowStockAlerts: ReservationResult['lowStockAlerts'] = [];
  for (const l of lines) {
    if (!l.matchedSku) continue;
    const { crossedLowThreshold, item } = await adjustStock(clientId, l.matchedSku, -l.qtyRequested);
    if (item && crossedLowThreshold) {
      lowStockAlerts.push({
        sku: item.sku,
        name: item.name,
        stock: item.stock,
        threshold: item.low_stock_threshold,
      });
    }
    l.stockAfter = item ? item.stock : l.stockBefore - l.qtyRequested;
  }

  return { success: true, lines, lowStockAlerts };
}
