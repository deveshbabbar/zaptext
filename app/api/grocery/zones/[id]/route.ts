import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getClientByOwnerUserId } from '@/lib/db/clients';
import { getZone, updateZone, deleteZone } from '@/lib/db/grocery-zones';

async function authzZone(id: string) {
  const { userId } = await auth();
  if (!userId) return null;
  const c = await getClientByOwnerUserId(userId);
  if (!c || c.type !== 'grocery') return null;
  const z = await getZone(id);
  if (!z || z.client_id !== c.client_id) return null;
  return z;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const z = await authzZone(id);
  if (!z) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const b = await req.json();
  await updateZone(id, {
    label: b.label,
    pincode: b.pincode,
    area_keywords: Array.isArray(b.area_keywords) ? b.area_keywords.map(String) : undefined,
    delivery_fee: b.delivery_fee != null ? Number(b.delivery_fee) : undefined,
    min_order_for_free_delivery:
      b.min_order_for_free_delivery !== undefined
        ? b.min_order_for_free_delivery == null
          ? null
          : Number(b.min_order_for_free_delivery)
        : undefined,
    min_order:
      b.min_order !== undefined ? (b.min_order == null ? null : Number(b.min_order)) : undefined,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const z = await authzZone(id);
  if (!z) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  await deleteZone(id);
  return NextResponse.json({ ok: true });
}
