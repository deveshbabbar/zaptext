// app/api/grocery/products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getClientByOwnerUserId } from '@/lib/db/clients';
import { listProducts, createProduct } from '@/lib/db/grocery-products';
import { safeImageUrl } from '@/lib/url-safety';

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
  // Validate image_url (defends against stored XSS / SSRF if an owner
  // pastes javascript:/data:/private-host URLs into the product
  // thumbnail field).
  let imageUrl: string | null = null;
  if (typeof body.image_url === 'string' && body.image_url.trim()) {
    const safe = safeImageUrl(body.image_url);
    if (!safe) {
      return NextResponse.json(
        { error: 'image_url must be a public https:// URL' },
        { status: 400 }
      );
    }
    imageUrl = safe;
  }
  const p = await createProduct({
    client_id: c.client_id,
    name: String(body.name),
    name_aliases: Array.isArray(body.name_aliases) ? body.name_aliases.map(String) : [],
    unit: body.unit,
    image_url: imageUrl,
  });
  return NextResponse.json({ product: p });
}
