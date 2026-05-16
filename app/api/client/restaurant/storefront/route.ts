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
  updateClientFields,
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

// --- Branding ---------------------------------------------------------------
// Branding fields live inside knowledge_base_json (where brandLogoUrl,
// brandColor, tagline already lived for the bot prompt + the existing
// /m page header). We surface them through the storefront API so the
// owner can edit them in one place alongside the public-URL settings.

interface Branding {
  coverImageUrl: string;
  brandLogoUrl: string;
  brandColor: string;
  tagline: string;
  /** One of the 5 storefront palettes (sage / forest / olive / charcoal
   *  / terracotta). Empty string = use the default sage at render time. */
  palette: string;
}

const EMPTY_BRANDING: Branding = {
  coverImageUrl: '', brandLogoUrl: '', brandColor: '', tagline: '', palette: '',
};

// Allowed palette names — matches PALETTES keys in lib/storefront-ui/atoms.tsx.
// Keep these two lists in sync; if the design adds a sixth palette, add it
// in both places. Empty string is also accepted (= clears to sage default).
const ALLOWED_PALETTES = new Set(['sage', 'forest', 'olive', 'charcoal', 'terracotta']);

// Hex colour shapes accepted: #RGB / #RRGGBB / #RRGGBBAA. We lowercase
// before validation since the input element may emit uppercase.
const HEX_COLOR_REGEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/;

function isHttpUrl(v: string): boolean {
  if (!v) return false;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function parseKb(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function brandingFromKb(kb: Record<string, unknown>): Branding {
  const rawPalette = typeof kb.palette === 'string' ? kb.palette.trim().toLowerCase() : '';
  return {
    coverImageUrl: typeof kb.coverImageUrl === 'string' ? kb.coverImageUrl : '',
    brandLogoUrl: typeof kb.brandLogoUrl === 'string' ? kb.brandLogoUrl : '',
    brandColor: typeof kb.brandColor === 'string' ? kb.brandColor : '',
    tagline: typeof kb.tagline === 'string' ? kb.tagline : '',
    // Only surface a palette name if it's one we recognise — protects the
    // UI from stale / typo values that might have made it into kb.
    palette: ALLOWED_PALETTES.has(rawPalette) ? rawPalette : '',
  };
}

// Sanitise + validate a partial Branding update from the request body.
// Returns the cleaned slice ready to merge into kb; throws Error with
// a user-facing message if any field is malformed (caller turns it into a 400).
function sanitizeBranding(input: Partial<Record<keyof Branding, unknown>>): Partial<Branding> {
  const out: Partial<Branding> = {};
  if ('coverImageUrl' in input) {
    const v = typeof input.coverImageUrl === 'string' ? input.coverImageUrl.trim() : '';
    if (v && !isHttpUrl(v)) throw new Error('Cover image must be an http(s) URL');
    if (v.length > 500) throw new Error('Cover image URL is too long (max 500 chars)');
    out.coverImageUrl = v;
  }
  if ('brandLogoUrl' in input) {
    const v = typeof input.brandLogoUrl === 'string' ? input.brandLogoUrl.trim() : '';
    if (v && !isHttpUrl(v)) throw new Error('Logo must be an http(s) URL');
    if (v.length > 500) throw new Error('Logo URL is too long (max 500 chars)');
    out.brandLogoUrl = v;
  }
  if ('brandColor' in input) {
    const v = typeof input.brandColor === 'string' ? input.brandColor.trim().toLowerCase() : '';
    if (v && !HEX_COLOR_REGEX.test(v)) throw new Error('Brand color must be a hex code like #b8336a');
    out.brandColor = v;
  }
  if ('tagline' in input) {
    const v = typeof input.tagline === 'string' ? input.tagline.trim() : '';
    if (v.length > 120) throw new Error('Tagline is too long (max 120 chars)');
    out.tagline = v;
  }
  if ('palette' in input) {
    const v = typeof input.palette === 'string' ? input.palette.trim().toLowerCase() : '';
    // Empty string is allowed (= clear to default sage). Anything else
    // must be one of the 5 known palette names.
    if (v && !ALLOWED_PALETTES.has(v)) {
      throw new Error('Palette must be one of: sage, forest, olive, charcoal, terracotta');
    }
    out.palette = v;
  }
  return out;
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
  branding: Branding;
}

async function loadCurrent(clientId: string, businessName: string): Promise<StorefrontResponse> {
  const c = await getClientById(clientId);
  const slug = c?.slug || '';
  const kb = parseKb(c?.knowledge_base_json || '');
  return {
    ok: true,
    businessName,
    slug,
    suggestedSlug: suggestSlug(businessName) || 'my-store',
    servicePincodes: parsePincodes(c?.service_pincodes || '[]'),
    storefrontEnabled: Boolean(c?.storefront_enabled),
    publicUrl: slug ? storefrontUrlFor(slug) : '',
    appDomain: APP_DOMAIN,
    branding: c ? brandingFromKb(kb) : EMPTY_BRANDING,
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
  branding?: Partial<Branding>;
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

  // --- Branding (merges into knowledge_base_json) -------------------------
  // Brand fields share kb storage with the existing bot-prompt config
  // (the prompt generator reads brandColor / brandLogoUrl / tagline too).
  // We merge instead of overwriting kb so any unrelated bot config the
  // owner has set elsewhere stays intact.
  let brandingPatch: Partial<Branding> | null = null;
  if (body.branding && typeof body.branding === 'object' && !Array.isArray(body.branding)) {
    try {
      brandingPatch = sanitizeBranding(body.branding as Partial<Record<keyof Branding, unknown>>);
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: 'INVALID_BRANDING', message: e instanceof Error ? e.message : 'Invalid branding field' },
        { status: 400 }
      );
    }
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

  // Apply branding AFTER the slug write so a partial failure (slug saved
  // but branding rejected) is unlikely — though if it ever happens, the
  // 400 below leaves the slug already persisted, which is harmless.
  if (brandingPatch && Object.keys(brandingPatch).length > 0) {
    try {
      const current = await getClientById(clientId);
      const kb = parseKb(current?.knowledge_base_json || '');
      const nextKb = { ...kb, ...brandingPatch };
      await updateClientFields(clientId, { knowledge_base_json: JSON.stringify(nextKb) });
    } catch (e) {
      console.error('[storefront PATCH] branding update failed:', e);
      return NextResponse.json({ ok: false, error: 'INTERNAL' }, { status: 500 });
    }
  }

  const data = await loadCurrent(clientId, user.activeBot.business_name);
  return NextResponse.json(data);
}
