// ─── Admin-only display-name validator endpoint ─────────────────────────
//
// Thin HTTP wrapper around lib/whatsapp-naming.validateDisplayName so admin
// tools can lint a proposed name without bundling the validator into client
// JS. Used by future admin UIs to pre-flight names before sending to Meta.
//
// Request:  POST { name: string }
// Response: { valid, errors[], warnings[], suggestions[], normalized }

import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { validateDisplayName } from '@/lib/whatsapp-naming';

export async function POST(req: NextRequest) {
  const user = await getUserRole();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = (body as { name?: unknown })?.name;
  if (typeof name !== 'string') {
    return NextResponse.json({ error: 'Missing "name" string in body' }, { status: 400 });
  }

  return NextResponse.json(validateDisplayName(name));
}
