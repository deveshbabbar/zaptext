import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getClientByOwnerUserId } from '@/lib/db/clients';
import { listZones, createZone } from '@/lib/db/grocery-zones';

async function getCtx() {
  const { userId } = await auth();
  if (!userId) return null;
  const c = await getClientByOwnerUserId(userId);
  if (!c || c.type !== 'grocery') return null;
  return c;
}

export async function GET() {
  const c = await getCtx();
  if (!c) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ zones: await listZones(c.client_id) });
}

export async function POST(req: NextRequest) {
  const c = await getCtx();
  if (!c) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const b = await req.json();
  if (!b?.label) return NextResponse.json({ error: 'label required' }, { status: 400 });
  const z = await createZone({
    client_id: c.client_id,
    label: String(b.label),
    pincode: b.pincode ?? null,
    area_keywords: Array.isArray(b.area_keywords) ? b.area_keywords.map(String) : [],
    delivery_fee: Number(b.delivery_fee) || 0,
    min_order_for_free_delivery:
      b.min_order_for_free_delivery == null ? null : Number(b.min_order_for_free_delivery),
    min_order: b.min_order == null ? null : Number(b.min_order),
  });
  return NextResponse.json({ zone: z });
}
