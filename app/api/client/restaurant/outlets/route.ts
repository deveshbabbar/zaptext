// GET / POST /api/client/restaurant/outlets
//
// Owner-only CRUD for the active restaurant bot's outlets[] array.
// Stored inside clients.knowledge_base_json — see lib/db/outlets.ts
// for the schema rationale.
//
// GET returns the synthesised list (single-outlet kitchens get one
// "main" entry derived from chain-level config so the UI can render
// the same component regardless of mode).
//
// POST replaces the outlets array. Slug uniqueness + length is
// validated server-side. Existing ids are preserved by the UI; this
// endpoint trusts the caller to maintain id stability across saves.

import { NextRequest, NextResponse } from 'next/server';
import { requireClientWithBots } from '@/lib/auth';
import {
  getOutletsForClient,
  setOutletsForClient,
  isMultiOutletEnabled,
  type Outlet,
} from '@/lib/db/outlets';

export async function GET() {
  const user = await requireClientWithBots().catch(() => null);
  if (!user || !user.activeBot || user.activeBot.type !== 'restaurant') {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const clientId = user.activeBot.client_id;
  const [outlets, multi] = await Promise.all([
    getOutletsForClient(clientId),
    isMultiOutletEnabled(clientId),
  ]);
  return NextResponse.json({ ok: true, outlets, multiOutletEnabled: multi });
}

interface OutletInput {
  id?: string;
  slug?: string;
  name?: string;
  address?: string;
  city?: string;
  pincode?: string;
  latitude?: number | string;
  longitude?: number | string;
  deliveryRadiusKm?: number | string;
  fssaiLicenseNumber?: string;
  fssaiExpiryDate?: string;
  gstin?: string;
  managerEmail?: string;
  openingHours?: string;
  brandColor?: string;
  isActive?: boolean;
  whatsappNumber?: string;
}

function newOutletId(): string {
  return `o_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function toNum(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export async function POST(request: NextRequest) {
  const user = await requireClientWithBots().catch(() => null);
  if (!user || !user.activeBot || user.activeBot.type !== 'restaurant') {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const clientId = user.activeBot.client_id;

  let body: { outlets?: OutletInput[] };
  try {
    body = (await request.json()) as { outlets?: OutletInput[] };
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const incoming = Array.isArray(body.outlets) ? body.outlets : [];
  if (incoming.length === 0) {
    return NextResponse.json({ ok: false, error: 'At least one outlet is required' }, { status: 400 });
  }
  if (incoming.length > 50) {
    return NextResponse.json({ ok: false, error: 'Too many outlets (max 50)' }, { status: 413 });
  }

  // Server-side normalisation: assign ids to new outlets, coerce types,
  // strip lengths. Slug uniqueness is enforced inside setOutletsForClient
  // which throws on duplicates.
  const sanitised: Outlet[] = [];
  for (const o of incoming) {
    const name = String(o.name || '').trim().slice(0, 80);
    const slug = String(o.slug || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 12);
    if (!name) {
      return NextResponse.json({ ok: false, error: 'Every outlet needs a name' }, { status: 400 });
    }
    if (!slug || slug.length < 2) {
      return NextResponse.json({ ok: false, error: `Outlet "${name}" needs a 2-12 character slug (letters/digits)` }, { status: 400 });
    }
    const lat = toNum(o.latitude);
    const lng = toNum(o.longitude);
    const radius = toNum(o.deliveryRadiusKm);
    sanitised.push({
      id: typeof o.id === 'string' && o.id.length > 0 ? o.id : newOutletId(),
      slug,
      name,
      address: String(o.address || '').trim().slice(0, 200),
      city: o.city ? String(o.city).trim().slice(0, 80) : undefined,
      pincode: o.pincode ? String(o.pincode).trim().slice(0, 12) : undefined,
      latitude: lat,
      longitude: lng,
      deliveryRadiusKm: radius,
      fssaiLicenseNumber: o.fssaiLicenseNumber ? String(o.fssaiLicenseNumber).replace(/\D/g, '').slice(0, 14) : undefined,
      fssaiExpiryDate: o.fssaiExpiryDate ? String(o.fssaiExpiryDate).trim() : undefined,
      gstin: o.gstin ? String(o.gstin).trim().toUpperCase().slice(0, 15) : undefined,
      managerEmail: o.managerEmail ? String(o.managerEmail).trim().toLowerCase().slice(0, 200) : undefined,
      openingHours: o.openingHours ? String(o.openingHours).trim().slice(0, 80) : undefined,
      brandColor: o.brandColor && /^#[0-9a-fA-F]{3,8}$/.test(String(o.brandColor)) ? String(o.brandColor) : undefined,
      isActive: o.isActive !== false,
      whatsappNumber: o.whatsappNumber ? String(o.whatsappNumber).replace(/\D/g, '').slice(0, 16) : undefined,
    });
  }

  try {
    await setOutletsForClient(clientId, sanitised);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Save failed' },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true, count: sanitised.length });
}
