// ─── Neon-backed clients store ───
//
// Drop-in replacement for the client-related functions previously exported
// from lib/google-sheets.ts. Same signatures, same return shapes — the 23
// importer files don't care that the bytes now live in Postgres instead of
// a spreadsheet.
//
// Conversion notes:
// - Postgres `timestamp` returns a Date object; the legacy ClientRow shape
//   (lib/types.ts) declares `created_at: string`, so we ISO-stringify on read.
// - Postgres nullable text columns can return `null`; the legacy code paths
//   read them as `string`, so we coerce nulls to '' on the boundary.

import { eq } from 'drizzle-orm';
import { db } from './index';
import { clients as clientsTable, conversations as conversationsTable, analytics as analyticsTable } from './schema';
import type { ClientRow } from '../types';

// Re-export so the legacy import surface is unchanged.
export class DuplicateBotError extends Error {
  readonly code = 'DUPLICATE_BOT' as const;
  constructor(public field: 'whatsapp_number' | 'phone_number_id', public value: string) {
    super(`A bot with ${field}="${value}" already exists.`);
    this.name = 'DuplicateBotError';
  }
}

// ─── helpers ────────────────────────────────────────────────────────────

type DbClientRow = typeof clientsTable.$inferSelect;

function dbRowToClient(row: DbClientRow): ClientRow {
  return {
    client_id: row.client_id,
    business_name: row.business_name,
    type: row.type as ClientRow['type'],
    owner_name: row.owner_name,
    whatsapp_number: row.whatsapp_number,
    phone_number_id: row.phone_number_id ?? '',
    city: row.city ?? '',
    system_prompt: row.system_prompt ?? '',
    knowledge_base_json: row.knowledge_base_json ?? '',
    status: row.status as ClientRow['status'],
    created_at: row.created_at ? row.created_at.toISOString() : '',
    owner_user_id: row.owner_user_id,
    upi_id: row.upi_id ?? '',
    upi_name: row.upi_name ?? '',
    existing_system: row.existing_system ?? '',
    export_format: (row.export_format === 'json' ? 'json' : 'csv') as 'csv' | 'json',
    contact_number: row.contact_number ?? '',
    opt_in_accepted: row.opt_in_accepted,
    stale_booking_minutes: row.stale_booking_minutes,
    slug: row.slug ?? '',
    service_pincodes: row.service_pincodes ?? '[]',
    storefront_enabled: row.storefront_enabled ?? false,
    // Default TRUE so legacy rows on environments that haven't run the
    // 0006 migration yet still get the safer behaviour. Once the column
    // is in place, row.allergen_strict_mode is the source of truth.
    allergen_strict_mode: row.allergen_strict_mode ?? true,
  };
}

// ─── reads ──────────────────────────────────────────────────────────────

export async function getAllClients(): Promise<ClientRow[]> {
  const rows = await db.select().from(clientsTable);
  return rows.map(dbRowToClient);
}

export async function getClientById(clientId: string): Promise<ClientRow | null> {
  const rows = await db.select().from(clientsTable).where(eq(clientsTable.client_id, clientId)).limit(1);
  return rows[0] ? dbRowToClient(rows[0]) : null;
}

export async function getClientByOwnerUserId(userId: string): Promise<ClientRow | null> {
  if (!userId) return null;
  const rows = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.owner_user_id, userId))
    .limit(1);
  return rows[0] ? dbRowToClient(rows[0]) : null;
}

export async function getClientByPhoneNumberId(phoneNumberId: string): Promise<ClientRow | null> {
  if (!phoneNumberId) return null;
  const rows = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.phone_number_id, phoneNumberId))
    .limit(1);
  return rows[0] ? dbRowToClient(rows[0]) : null;
}

// Storefront subdomain lookup. The middleware extracts `<slug>` from a host
// like `bigchillicafe.zaptext.shop` and the public ordering page calls this
// helper to resolve it to a client row. Normalises the input to lowercase
// since DNS labels are case-insensitive but our slug column is stored
// lowercase by convention (enforced at the settings API boundary).
export async function getClientBySlug(slug: string): Promise<ClientRow | null> {
  const s = (slug || '').trim().toLowerCase();
  if (!s) return null;
  const rows = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.slug, s))
    .limit(1);
  return rows[0] ? dbRowToClient(rows[0]) : null;
}

// Convenience for routes that receive a path segment which may be either the
// opaque `client_id` (legacy /m links sent by the bot) or the human-readable
// `slug` (storefront subdomain rewrites). Tries id first because that's the
// hot path for existing chat-triggered links; falls back to slug for fresh
// storefront traffic. Order matters: client_ids are UUID-ish and won't
// collide with slugs in practice, but if a slug ever did equal a client_id,
// the id wins (consistent with legacy behaviour).
export async function getClientByIdOrSlug(idOrSlug: string): Promise<ClientRow | null> {
  if (!idOrSlug) return null;
  const byId = await getClientById(idOrSlug);
  if (byId) return byId;
  return getClientBySlug(idOrSlug);
}

// ─── writes ─────────────────────────────────────────────────────────────

export async function addClient(client: ClientRow): Promise<void> {
  // Duplicate guards. The REAL routing conflict is on phone_number_id —
  // Meta routes incoming WhatsApp messages by that ID, so two bots with
  // the same phone_number_id would race. The display `whatsapp_number`
  // (+91…) is intentionally allowed to repeat across bots: the seeded
  // demo bots all share the owner's primary number with empty
  // phone_number_id (UI showcase only) while the LIVE bot for that same
  // number carries a real phone_number_id and actually receives traffic.
  //
  // So whatsapp_number is only treated as a conflict when an existing
  // bot ALREADY uses that number AND has a non-empty phone_number_id
  // AND the new bot also tries to take a (different) non-empty
  // phone_number_id — in practice that's never legal because Meta only
  // gives one ID per number.
  const normalizedPhone = (client.whatsapp_number || '').replace(/\D/g, '');
  if (normalizedPhone && client.phone_number_id) {
    const sameNumber = await db
      .select({ id: clientsTable.client_id, w: clientsTable.whatsapp_number, pn: clientsTable.phone_number_id })
      .from(clientsTable);
    const conflict = sameNumber.find(
      (c) =>
        (c.w || '').replace(/\D/g, '') === normalizedPhone &&
        (c.pn || '') !== '' &&
        (c.pn || '') !== client.phone_number_id
    );
    if (conflict) throw new DuplicateBotError('whatsapp_number', client.whatsapp_number);
  }
  if (client.phone_number_id) {
    const dup = await db
      .select({ id: clientsTable.client_id })
      .from(clientsTable)
      .where(eq(clientsTable.phone_number_id, client.phone_number_id))
      .limit(1);
    if (dup.length > 0) throw new DuplicateBotError('phone_number_id', client.phone_number_id);
  }

  await db.insert(clientsTable).values({
    client_id: client.client_id,
    business_name: client.business_name,
    type: client.type,
    owner_name: client.owner_name,
    whatsapp_number: client.whatsapp_number,
    phone_number_id: client.phone_number_id || '',
    city: client.city || '',
    system_prompt: client.system_prompt || '',
    knowledge_base_json: client.knowledge_base_json || '',
    status: client.status,
    created_at: client.created_at ? new Date(client.created_at) : new Date(),
    owner_user_id: client.owner_user_id,
    upi_id: client.upi_id || '',
    upi_name: client.upi_name || '',
    existing_system: client.existing_system || '',
    export_format: client.export_format || 'csv',
    contact_number: client.contact_number || '',
    opt_in_accepted: !!client.opt_in_accepted,
  });
}

export async function deleteClient(clientId: string): Promise<boolean> {
  // Drop the row + its conversations + analytics rows so the dashboard
  // doesn't show ghost history.
  await db.delete(conversationsTable).where(eq(conversationsTable.client_id, clientId));
  await db.delete(analyticsTable).where(eq(analyticsTable.client_id, clientId));
  const res = await db
    .delete(clientsTable)
    .where(eq(clientsTable.client_id, clientId))
    .returning({ id: clientsTable.client_id });
  return res.length > 0;
}

export async function updateClientStatus(clientId: string, status: ClientRow['status']): Promise<void> {
  await db.update(clientsTable).set({ status }).where(eq(clientsTable.client_id, clientId));
}

// Allowlist of fields that can be patched. Matches the legacy CLIENT_FIELD_TO_COL
// mapping plus `type` (which lib/google-sheets.ts also added). Any other field
// is silently ignored — same behavior as the legacy `updateClientFields` filter.
const PATCHABLE_FIELDS = new Set([
  'business_name',
  'type',
  'owner_name',
  'whatsapp_number',
  'phone_number_id',
  'city',
  'system_prompt',
  'knowledge_base_json',
  'status',
  'upi_id',
  'upi_name',
  'existing_system',
  'export_format',
  'contact_number',
  'opt_in_accepted',
]);

export async function updateClientFields(clientId: string, fields: Record<string, string>): Promise<void> {
  const set: Record<string, string | boolean> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (!PATCHABLE_FIELDS.has(k) || typeof v !== 'string') continue;
    if (k === 'opt_in_accepted') {
      set[k] = v.toUpperCase() === 'TRUE';
    } else {
      set[k] = v;
    }
  }
  if (Object.keys(set).length === 0) return;
  await db.update(clientsTable).set(set).where(eq(clientsTable.client_id, clientId));
}

export async function updateClientField(clientId: string, field: string, value: string): Promise<void> {
  await updateClientFields(clientId, { [field]: value });
}

// FSSAI allergen-safety toggle (Work Item 4). Boolean column updates can't
// go through updateClientFields() because that helper's PATCHABLE_FIELDS
// allowlist is string-typed. Separate function keeps the type signature
// honest.
export async function updateClientAllergenStrictMode(
  clientId: string,
  value: boolean
): Promise<void> {
  await db
    .update(clientsTable)
    .set({ allergen_strict_mode: value })
    .where(eq(clientsTable.client_id, clientId));
}

// Storefront settings update. Separate from updateClientFields because the
// latter only accepts string values via its PATCHABLE_FIELDS allowlist;
// storefront_enabled is a real boolean and service_pincodes goes in as a
// JSON-encoded text array. Every field is optional — only present keys are
// applied so the settings UI can do partial saves (e.g. toggle the enable
// flag without re-sending the slug). Slug uniqueness is enforced by the
// clients_slug_unique partial index — a duplicate insert will throw and
// the API layer translates that into a 409.
export async function updateClientStorefrontSettings(
  clientId: string,
  patch: { slug?: string; service_pincodes?: string; storefront_enabled?: boolean }
): Promise<void> {
  const set: Record<string, string | boolean> = {};
  if (typeof patch.slug === 'string') set.slug = patch.slug.trim().toLowerCase();
  if (typeof patch.service_pincodes === 'string') set.service_pincodes = patch.service_pincodes;
  if (typeof patch.storefront_enabled === 'boolean') set.storefront_enabled = patch.storefront_enabled;
  if (Object.keys(set).length === 0) return;
  await db.update(clientsTable).set(set).where(eq(clientsTable.client_id, clientId));
}
