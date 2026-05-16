// GET / PATCH /api/client/restaurant/storefront
//
// Owner-only settings for the public storefront at <slug>.zaptext.shop.
// Three fields live behind this endpoint:
//   - slug                (DNS label, globally unique, lowercase a-z0-9-)
//   - service_pincodes    (JSON array of 6-digit Indian pincodes)
//   - storefront_enabled  (master on/off switch; the subdomain rewrites
//                          serve a 404 when this is false)
//
// Slug uniqueness is enforced two ways:
//   1. Pre-check via getClientBySlug — gives a nice 409 in the common case
//      and avoids leaking a Postgres error to the UI.
//   2. The partial-unique index `clients_slug_unique` on the DB catches
//      any race that slips past the pre-check.
//
// PATCH is partial — only the keys present in the body are written, so the
// settings page can do per-field saves (e.g. flip the enable toggle without
// re-sending the slug).

import { NextRequest, NextResponse } from 'next/server';
import { requireClientWithBots } from '@/lib/auth';
import {
  getClientById,
  getClientBySlug,
  updateClientStorefrontSettings,
} from '@/lib/db/clients';
import {
  APP_DOMAIN,
  isValidSlug,
  slugIsReserved,
  storefrontUrlFor,
  suggestSlug,
} from '@/lib/storefront-slug';

// 6-digit Indian pincode, first digit 1-8 (postal regions). Mirrors the
// pattern used by the existing dine-in submit endpoint.
const PINCODE_REGEX = /^[1-8]\d{5}$/;
const MAX_PINCODES = 200;

function parsePincodes(raw: string): string[] {
  try {
    const arr = JSON.parse(raw || '[]');
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is string => typeof x === 'string' && PINCODE_REGEX.test(x));
  } catch {
    return [];
  }
}

interface StorefrontResponse {
  ok: true;
  businessName: string;
  slug: string;
  suggestedSlug: string;
  servicePincodes: string[];
  storefrontEnabled: boolean;
  publicUrl: string;
  appDomain: string;
}

async function loadCurrent(clientId: string, businessName: string): Promise<StorefrontResponse> {
  const c = await getClientById(clientId);
  const slug = c?.slug || '';
  return {
    ok: true,
    businessName,
    slug,
    suggestedSlug: suggestSlug(businessName) || 'my-store',
    servicePincodes: parsePincodes(c?.service_pincodes || '[]'),
    storefrontEnabled: Boolean(c?.storefront_enabled),
    publicUrl: slug ? storefrontUrlFor(slug) : '',
    appDomain: APP_DOMAIN,
  };
}

export async function GET() {
  const user = await requireClientWithBots().catch(() => null);
  if (!user || !user.activeBot || user.activeBot.type !== 'restaurant') {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const data = await loadCurrent(user.activeBot.client_id, user.activeBot.business_name);
  return NextResponse.json(data);
}

interface PatchInput {
  slug?: string;
  service_pincodes?: string[];
  storefront_enabled?: boolean;
}

export async function PATCH(request: NextRequest) {
  const user = await requireClientWithBots().catch(() => null);
  if (!user || !user.activeBot || user.activeBot.type !== 'restaurant') {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const clientId = user.activeBot.client_id;

  let body: PatchInput;
  try {
    body = (await request.json()) as PatchInput;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const patch: { slug?: string; service_pincodes?: string; storefront_enabled?: boolean } = {};

  // --- Slug validation + uniqueness pre-check -----------------------------
  if (typeof body.slug === 'string') {
    const newSlug = body.slug.trim().toLowerCase();
    if (!isValidSlug(newSlug)) {
      return NextResponse.json(
        { ok: false, error: 'INVALID_SLUG', message: 'Use 1-63 chars: lowercase letters, digits, hyphens. Must start with a letter or digit.' },
        { status: 400 }
      );
    }
    if (slugIsReserved(newSlug)) {
      return NextResponse.json(
        { ok: false, error: 'RESERVED_SLUG', message: 'That subdomain is reserved by the platform. Try a different one.' },
        { status: 400 }
      );
    }
    const existing = await getClientBySlug(newSlug).catch(() => null);
    if (existing && existing.client_id !== clientId) {
      return NextResponse.json(
        { ok: false, error: 'SLUG_TAKEN', message: 'That subdomain is already in use by another restaurant.' },
        { status: 409 }
      );
    }
    patch.slug = newSlug;
  }

  // --- Pincodes ------------------------------------------------------------
  if (Array.isArray(body.service_pincodes)) {
    const valid = body.service_pincodes
      .map((p) => (typeof p === 'string' ? p.trim() : ''))
      .filter((p) => PINCODE_REGEX.test(p))
      // De-duplicate while preserving the owner's input order.
      .filter((p, i, arr) => arr.indexOf(p) === i)
      .slice(0, MAX_PINCODES);
    patch.service_pincodes = JSON.stringify(valid);
  }

  // --- Enable toggle -------------------------------------------------------
  if (typeof body.storefront_enabled === 'boolean') {
    // Refuse to enable without a slug — half-configured storefront would
    // 404 anyway, so block it at the API instead of giving a broken link.
    if (body.storefront_enabled) {
      const target = patch.slug ?? (await getClientById(clientId))?.slug ?? '';
      if (!target) {
        return NextResponse.json(
          { ok: false, error: 'SLUG_REQUIRED', message: 'Set a subdomain before enabling the storefront.' },
          { status: 400 }
        );
      }
    }
    patch.storefront_enabled = body.storefront_enabled;
  }

  // Last-ditch race guard: the DB partial-unique index catches a duplicate
  // slug that slipped past the pre-check (two owners hitting save at the
  // same time). Translate the driver error into the same 409 response.
  try {
    await updateClientStorefrontSettings(clientId, patch);
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    if (msg.includes('clients_slug_unique') || msg.includes('duplicate key')) {
      return NextResponse.json(
        { ok: false, error: 'SLUG_TAKEN', message: 'That subdomain was just taken by another restaurant. Pick a different one.' },
        { status: 409 }
      );
    }
    console.error('[storefront PATCH] update failed:', e);
    return NextResponse.json({ ok: false, error: 'INTERNAL' }, { status: 500 });
  }

  const data = await loadCurrent(clientId, user.activeBot.business_name);
  return NextResponse.json(data);
}
