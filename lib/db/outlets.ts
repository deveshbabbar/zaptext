// Outlet config helper.
//
// Multi-outlet config lives inside `clients.knowledge_base_json` under
// the `outlets` array — same place as menuCategories. We don't move
// it to a separate table because (a) outlets are slow-changing
// metadata that get rendered into the AI prompt anyway, and (b)
// keeping it in KB means existing snapshot/restore flows pick it up
// for free.
//
// Single-outlet kitchens (the default for newly-onboarded restaurants
// when they answer "Just one location" on the form) have an empty
// outlets array AND the `multiOutletEnabled` flag set to false.
// They still get a synthetic 'main' outlet at the application layer
// — invisible to the user.

import { getClientById } from '@/lib/db/clients';
import { updateClientFields } from '@/lib/google-sheets';

export interface Outlet {
  /** Stable internal id (uuid or ulid). Used as foreign key in
   *  dine_in_orders.outlet_id, restaurant_tables.outlet_id, etc. */
  id: string;
  /** Short user-facing code embedded in QR text (e.g. 'SAK', 'CP').
   *  Uppercase, 2-12 chars, no spaces. */
  slug: string;
  name: string;
  address: string;
  city?: string;
  pincode?: string;
  /** Optional center of delivery zone — used by haversine zone math.
   *  Both must be set for zone assignment to work. */
  latitude?: number;
  longitude?: number;
  /** Simple circular delivery zone radius. Phase L3 may swap this
   *  for a polygon; until then we use radius. */
  deliveryRadiusKm?: number;
  /** Per-outlet FSSAI licence — chains often have separate licences
   *  per outlet location. Falls back to the chain-level number when
   *  the outlet doesn't have its own. */
  fssaiLicenseNumber?: string;
  fssaiExpiryDate?: string; // ISO date
  /** Per-outlet GSTIN — separate when the chain has multiple legal
   *  entities (rare but real). Falls back to chain GSTIN. */
  gstin?: string;
  /** Email of the outlet manager — used to look up team_members row +
   *  route per-outlet WhatsApp/email notifications. Display only;
   *  authoritative copy is in team_members table. */
  managerEmail?: string;
  /** Free-text per-outlet hours, e.g. "11:00 - 23:00". Optional —
   *  inherits chain-level hours when absent. */
  openingHours?: string;
  /** Brand color override per outlet — useful for cloud-kitchen
   *  multi-brand scenarios where each outlet IS a brand. Hex. */
  brandColor?: string;
  /** Is this outlet currently accepting orders? Owner can pause an
   *  outlet without deleting (kitchen renovation, staffing issue). */
  isActive: boolean;
  /** Optional per-outlet WhatsApp number — distinct from the chain
   *  WABA. Almost always empty (single WABA = the whole point). */
  whatsappNumber?: string;
}

const SYNTHETIC_MAIN_OUTLET_ID = 'main';

/**
 * Reads the outlets array from a client's KB. Falls back to a single
 * synthetic 'main' outlet derived from the chain-level config when the
 * kitchen hasn't enabled multi-outlet yet. Callers can treat the
 * return value as authoritative — they never need to know whether
 * the kitchen is single- or multi-outlet.
 */
export async function getOutletsForClient(clientId: string): Promise<Outlet[]> {
  const client = await getClientById(clientId);
  if (!client) return [];

  let kb: Record<string, unknown> = {};
  try {
    if (client.knowledge_base_json) kb = JSON.parse(client.knowledge_base_json);
  } catch { /* ignore */ }

  const multiEnabled = kb.multiOutletEnabled === true;
  const stored = Array.isArray(kb.outlets) ? (kb.outlets as Outlet[]) : [];

  if (multiEnabled && stored.length > 0) {
    return stored.filter((o) => o && typeof o.id === 'string' && o.id.length > 0);
  }

  // Single-outlet kitchen — synthesise one outlet from chain-level
  // config so downstream code (zone math, dashboard scoping) doesn't
  // need to branch on multiEnabled.
  return [{
    id: SYNTHETIC_MAIN_OUTLET_ID,
    slug: 'MAIN',
    name: client.business_name,
    address: `${(kb.address as string) || ''}${kb.city ? `, ${kb.city}` : ''}`.replace(/^, /, ''),
    city: typeof kb.city === 'string' ? kb.city : undefined,
    fssaiLicenseNumber: typeof kb.fssaiLicenseNumber === 'string' ? kb.fssaiLicenseNumber : undefined,
    fssaiExpiryDate: typeof kb.fssaiExpiryDate === 'string' ? kb.fssaiExpiryDate : undefined,
    gstin: typeof kb.gstin === 'string' ? kb.gstin : undefined,
    openingHours: typeof kb.workingHours === 'string' ? kb.workingHours : undefined,
    isActive: true,
  }];
}

export async function getOutletById(clientId: string, outletId: string): Promise<Outlet | null> {
  const outlets = await getOutletsForClient(clientId);
  return outlets.find((o) => o.id === outletId || o.slug === outletId.toUpperCase()) || null;
}

/**
 * Replaces the outlets array. Caller is responsible for preserving
 * existing ids (only renames + active toggles should ever change an
 * outlet — never delete an outlet that has order history; archive
 * via isActive=false instead).
 */
export async function setOutletsForClient(clientId: string, outlets: Outlet[]): Promise<void> {
  const client = await getClientById(clientId);
  if (!client) throw new Error('Client not found');

  let kb: Record<string, unknown> = {};
  try {
    if (client.knowledge_base_json) kb = JSON.parse(client.knowledge_base_json);
  } catch { /* keep empty */ }

  // Validate slugs are unique within this client + uppercase
  const seenSlugs = new Set<string>();
  for (const o of outlets) {
    const slug = (o.slug || '').trim().toUpperCase();
    if (!slug) throw new Error(`Outlet "${o.name}" missing slug`);
    if (slug.length > 12) throw new Error(`Outlet slug "${slug}" too long (max 12 chars)`);
    if (seenSlugs.has(slug)) throw new Error(`Duplicate outlet slug "${slug}"`);
    seenSlugs.add(slug);
    o.slug = slug;
  }

  kb.outlets = outlets;
  kb.multiOutletEnabled = outlets.length > 1 || (outlets.length === 1 && outlets[0].id !== SYNTHETIC_MAIN_OUTLET_ID);

  await updateClientFields(clientId, {
    knowledge_base_json: JSON.stringify(kb),
  });
}

/** True iff this kitchen has opted in to multi-outlet mode. UI uses
 *  this to gate the outlet picker / Settings → Outlets visibility. */
export async function isMultiOutletEnabled(clientId: string): Promise<boolean> {
  const client = await getClientById(clientId);
  if (!client) return false;
  try {
    const kb = JSON.parse(client.knowledge_base_json || '{}');
    return kb.multiOutletEnabled === true && Array.isArray(kb.outlets) && kb.outlets.length > 0;
  } catch {
    return false;
  }
}

/**
 * Pure haversine distance — kilometres between two lat/lng points.
 * Used by the zone-assignment math (Phase 3K) to pick the right
 * outlet for a customer based on their shared location.
 */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius (km)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Picks the best outlet for a customer at a given lat/lng. Returns
 * { outlet, distanceKm, inZone } so callers can either honour the
 * pick (inZone=true) or fall through to "out of zone" handling.
 *
 * Algorithm:
 *   - For each active outlet with lat/lng + deliveryRadiusKm set,
 *     compute distance.
 *   - inZone outlets: pick the NEAREST one (handles overlapping zones).
 *   - No inZone outlet: pick the absolute nearest active outlet so
 *     the bot can say "Nearest outlet is X km away — outside our
 *     delivery zone, but you can do takeaway."
 *   - No outlets with coords configured: return null.
 */
export function assignOutletByLocation(
  outlets: Outlet[],
  customerLat: number,
  customerLng: number
): { outlet: Outlet; distanceKm: number; inZone: boolean } | null {
  const active = outlets.filter(
    (o) => o.isActive && typeof o.latitude === 'number' && typeof o.longitude === 'number'
  );
  if (active.length === 0) return null;

  const ranked = active
    .map((o) => ({
      outlet: o,
      distanceKm: haversineKm(customerLat, customerLng, o.latitude!, o.longitude!),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const inZoneRanked = ranked.filter(
    (r) => typeof r.outlet.deliveryRadiusKm === 'number' && r.distanceKm <= r.outlet.deliveryRadiusKm
  );

  if (inZoneRanked.length > 0) {
    return { outlet: inZoneRanked[0].outlet, distanceKm: inZoneRanked[0].distanceKm, inZone: true };
  }

  return { outlet: ranked[0].outlet, distanceKm: ranked[0].distanceKm, inZone: false };
}
