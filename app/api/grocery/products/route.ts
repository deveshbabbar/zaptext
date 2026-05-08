// app/api/grocery/products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getClientByOwnerUserId } from '@/lib/db/clients';
import { listProducts, createProduct } from '@/lib/db/grocery-products';

async function requireGroceryClient() {
  const { userId } = await auth();
  if (!userId) return null;
  const c = await getClientByOwnerUserId(userId);
  if (!c || c.type !== 'grocery') return null;
  return c;
}

export async function GET() {
  const c = await requireGroceryClient();
  if (!c) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const products = await listProducts(c.client_id);
  return NextResponse.json({ products });
}

export async function POST(req: NextRequest) {
  const c = await requireGroceryClient();
  if (!c) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json();
  if (!body?.name || !body?.unit) {
    return NextResponse.json({ error: 'name and unit required' }, { status: 400 });
  }
  const p = await createProduct({
    client_id: c.client_id,
    name: String(body.name),
    name_aliases: Array.isArray(body.name_aliases) ? body.name_aliases.map(String) : [],
    unit: body.unit,
    image_url: body.image_url ?? null,
  });
  return NextResponse.json({ product: p });
}
