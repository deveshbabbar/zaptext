// app/api/grocery/daily-catalog/upsert/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getClientByOwnerUserId } from '@/lib/db/clients';
import { upsertDailyCatalog } from '@/lib/db/grocery-daily-catalog';
import { listProducts } from '@/lib/db/grocery-products';
import { todayIsoIST } from '@/lib/grocery/date-utils';

// Strict YYYY-MM-DD with a calendar-validity round-trip so values like
// "9999-99-99" or "2025-02-30" don't survive (length === 10 was not
// enough).
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function parseIsoDate(input: unknown): string | null {
  if (typeof input !== 'string' || !ISO_DATE_RE.test(input)) return null;
  const t = Date.parse(input + 'T00:00:00Z');
  if (!Number.isFinite(t)) return null;
  const round = new Date(t).toISOString().slice(0, 10);
  return round === input ? input : null;
}

// Sane upper bounds so an owner (or a compromised owner account)
// can't write absurd prices/stock that corrupt downstream analytics
// or trigger overflow in money math elsewhere.
const MAX_PRICE_RUPEES = 1_000_000;
const MAX_STOCK_QTY = 1_000_000;

interface IncomingItem {
  product_id?: unknown;
  price_per_unit?: unknown;
  in_stock?: unknown;
  stock_qty?: unknown;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const c = await getClientByOwnerUserId(userId);
  if (!c || c.type !== 'grocery') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const date = parseIsoDate(body?.date) ?? todayIsoIST();
  if (!Array.isArray(body?.items)) {
    return NextResponse.json({ error: 'items must be array' }, { status: 400 });
  }

  // Build the set of product_ids THIS tenant owns. Any incoming item
  // whose product_id is unknown or belongs to another grocery tenant
  // is silently dropped. The previous version trusted whatever
  // product_id the body sent and could overwrite another grocery
  // tenant's catalog if the attacker guessed an id.
  const ownedProducts = await listProducts(c.client_id);
  const allowedProductIds = new Set(ownedProducts.map((p) => p.id));

  const incoming = body.items as IncomingItem[];
  const items: Array<{
    product_id: string;
    price_per_unit: number;
    in_stock: boolean;
    stock_qty: number | null;
  }> = [];
  let rejectedForeign = 0;

  for (const it of incoming) {
    const pid = typeof it.product_id === 'string' ? it.product_id : null;
    if (!pid || !allowedProductIds.has(pid)) {
      rejectedForeign += 1;
      continue;
    }
    const priceRaw = Number(it.price_per_unit);
    const price = Number.isFinite(priceRaw) ? priceRaw : 0;
    if (price < 0 || price > MAX_PRICE_RUPEES) continue;

    let stockQty: number | null = null;
    if (it.stock_qty != null) {
      const sRaw = Number(it.stock_qty);
      if (!Number.isFinite(sRaw) || sRaw < 0 || sRaw > MAX_STOCK_QTY) continue;
      stockQty = sRaw;
    }
    items.push({
      product_id: pid,
      price_per_unit: price,
      in_stock: it.in_stock !== false,
      stock_qty: stockQty,
    });
  }

  if (rejectedForeign > 0) {
    console.warn('[grocery/daily-catalog] dropped cross-tenant product_ids', {
      clientId: c.client_id,
      rejected: rejectedForeign,
    });
  }

  await upsertDailyCatalog(c.client_id, date, items);
  return NextResponse.json({ ok: true, count: items.length, skipped: rejectedForeign });
}
