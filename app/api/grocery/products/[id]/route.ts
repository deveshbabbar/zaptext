// app/api/grocery/products/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getClientByOwnerUserId } from '@/lib/db/clients';
import {
  getProduct,
  updateProduct,
  deleteProduct,
} from '@/lib/db/grocery-products';
import { safeImageUrl } from '@/lib/url-safety';

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
  // image_url validation: an owner (or compromised owner account)
  // could previously paste any URL — javascript:/data:/internal-host
  // — which would land in <img src> on storefront pages (stored XSS
  // / content injection) or in any future server-side fetcher (SSRF).
  // Explicit-null and undefined both pass through; non-empty strings
  // must validate.
  let imageUrl: string | null | undefined = undefined;
  if (body.image_url === null) {
    imageUrl = null;
  } else if (typeof body.image_url === 'string' && body.image_url.trim()) {
    const safe = safeImageUrl(body.image_url);
    if (!safe) {
      return NextResponse.json(
        { error: 'image_url must be a public https:// URL' },
        { status: 400 }
      );
    }
    imageUrl = safe;
  }
  await updateProduct(id, {
    name: body.name,
    name_aliases: Array.isArray(body.name_aliases)
      ? body.name_aliases.map(String)
      : undefined,
    unit: body.unit,
    image_url: imageUrl,
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
