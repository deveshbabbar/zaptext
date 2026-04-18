import { google } from 'googleapis';
import { InventoryItem } from './types';

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}
function getSheets() {
  return google.sheets({ version: 'v4', auth: getAuth() });
}

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

function rowToItem(row: string[]): InventoryItem {
  return {
    client_id: row[0] || '',
    sku: row[1] || '',
    name: row[2] || '',
    price: parseFloat(row[3] || '0') || 0,
    stock: parseInt(row[4] || '0', 10) || 0,
    low_stock_threshold: parseInt(row[5] || '0', 10) || 0,
    is_active: (row[6] || 'TRUE').toUpperCase() !== 'FALSE',
    updated_at: row[7] || '',
    notes: row[8] || '',
  };
}

function itemToRow(item: InventoryItem): string[] {
  return [
    item.client_id,
    item.sku,
    item.name,
    item.price.toString(),
    Math.max(0, Math.floor(item.stock)).toString(),
    Math.max(0, Math.floor(item.low_stock_threshold)).toString(),
    item.is_active ? 'TRUE' : 'FALSE',
    item.updated_at,
    item.notes || '',
  ];
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

async function fetchAllRows(): Promise<{ rowIndex: number; item: InventoryItem }[]> {
  const sheets = getSheets();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'inventory!A2:I',
    });
    const rows = res.data.values || [];
    return rows.map((row, i) => ({ rowIndex: i + 2, item: rowToItem(row) }));
  } catch {
    return [];
  }
}

export async function getInventory(clientId: string): Promise<InventoryItem[]> {
  const all = await fetchAllRows();
  return all.filter((x) => x.item.client_id === clientId).map((x) => x.item);
}

export async function getActiveInventory(clientId: string): Promise<InventoryItem[]> {
  const all = await getInventory(clientId);
  return all.filter((i) => i.is_active);
}

export async function getItem(clientId: string, sku: string): Promise<InventoryItem | null> {
  const all = await fetchAllRows();
  const found = all.find((x) => x.item.client_id === clientId && x.item.sku === sku);
  return found ? found.item : null;
}

export async function upsertItem(
  input: Partial<InventoryItem> & { client_id: string; name: string }
): Promise<InventoryItem> {
  const sheets = getSheets();
  const sku = input.sku && input.sku.trim() ? slugify(input.sku) : slugify(input.name);
  const all = await fetchAllRows();
  const existing = all.find((x) => x.item.client_id === input.client_id && x.item.sku === sku);

  const item: InventoryItem = {
    client_id: input.client_id,
    sku,
    name: input.name.trim(),
    price: typeof input.price === 'number' ? input.price : existing?.item.price ?? 0,
    stock: typeof input.stock === 'number' ? Math.max(0, Math.floor(input.stock)) : existing?.item.stock ?? 0,
    low_stock_threshold:
      typeof input.low_stock_threshold === 'number'
        ? Math.max(0, Math.floor(input.low_stock_threshold))
        : existing?.item.low_stock_threshold ?? 0,
    is_active: typeof input.is_active === 'boolean' ? input.is_active : existing?.item.is_active ?? true,
    updated_at: new Date().toISOString(),
    notes: typeof input.notes === 'string' ? input.notes : existing?.item.notes ?? '',
  };

  if (existing) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `inventory!A${existing.rowIndex}:I${existing.rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [itemToRow(item)] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'inventory!A:I',
      valueInputOption: 'RAW',
      requestBody: { values: [itemToRow(item)] },
    });
  }
  return item;
}

export async function setStock(clientId: string, sku: string, qty: number): Promise<InventoryItem | null> {
  const item = await getItem(clientId, sku);
  if (!item) return null;
  return upsertItem({ ...item, stock: Math.max(0, Math.floor(qty)) });
}

export async function adjustStock(
  clientId: string,
  sku: string,
  delta: number
): Promise<{ item: InventoryItem | null; previous: number; crossedLowThreshold: boolean }> {
  const item = await getItem(clientId, sku);
  if (!item) return { item: null, previous: 0, crossedLowThreshold: false };
  const previous = item.stock;
  const next = Math.max(0, previous + Math.floor(delta));
  const crossedLowThreshold =
    item.low_stock_threshold > 0 && previous > item.low_stock_threshold && next <= item.low_stock_threshold;
  const updated = await upsertItem({ ...item, stock: next });
  return { item: updated, previous, crossedLowThreshold };
}

export async function deleteItem(clientId: string, sku: string): Promise<boolean> {
  const item = await getItem(clientId, sku);
  if (!item) return false;
  await upsertItem({ ...item, is_active: false });
  return true;
}

// ─── Fuzzy match for free-text bot item references ───

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
  const active = await getActiveInventory(clientId);
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
