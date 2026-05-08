// app/api/grocery/products/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getClientByOwnerUserId } from '@/lib/db/clients';
import {
  getProduct,
  updateProduct,
  deleteProduct,
} from '@/lib/db/grocery-products';

async function authorizeProduct(id: string) {
  const { userId } = await auth();
  if (!userId) return null;
  const c = await getClientByOwnerUserId(userId);
  if (!c || c.type !== 'grocery') return null;
  const p = await getProduct(id);
  if (!p || p.client_id !== c.client_id) return null;
  return { client: c, product: p };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await authorizeProduct(id);
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json();
  await updateProduct(id, {
    name: body.name,
    name_aliases: Array.isArray(body.name_aliases)
      ? body.name_aliases.map(String)
      : undefined,
    unit: body.unit,
    image_url: body.image_url,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await authorizeProduct(id);
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  await deleteProduct(id);
  return NextResponse.json({ ok: true });
}
