// app/api/grocery/daily-catalog/upsert/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getClientByOwnerUserId } from '@/lib/db/clients';
import { upsertDailyCatalog } from '@/lib/db/grocery-daily-catalog';
import { todayIsoIST } from '@/lib/grocery/date-utils';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const c = await getClientByOwnerUserId(userId);
  if (!c || c.type !== 'grocery') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const date = typeof body?.date === 'string' && body.date.length === 10 ? body.date : todayIsoIST();
  if (!Array.isArray(body?.items)) {
    return NextResponse.json({ error: 'items must be array' }, { status: 400 });
  }
  const items = body.items.map((it: any) => ({
    product_id: String(it.product_id),
    price_per_unit: Number(it.price_per_unit) || 0,
    in_stock: it.in_stock !== false,
    stock_qty: it.stock_qty == null ? null : Number(it.stock_qty),
  }));
  await upsertDailyCatalog(c.client_id, date, items);
  return NextResponse.json({ ok: true, count: items.length });
}
