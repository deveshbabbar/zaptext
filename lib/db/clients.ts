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

// ─── writes ─────────────────────────────────────────────────────────────

export async function addClient(client: ClientRow): Promise<void> {
  // Duplicate guards: matches the legacy Sheets implementation. We could
  // rely on the unique index on phone_number_id, but the friendlier
  // DuplicateBotError surfaces a clear field name to the caller.
  const normalizedPhone = (client.whatsapp_number || '').replace(/\D/g, '');
  if (normalizedPhone) {
    const existing = await db.select({ w: clientsTable.whatsapp_number }).from(clientsTable);
    const dup = existing.find((c) => (c.w || '').replace(/\D/g, '') === normalizedPhone);
    if (dup) throw new DuplicateBotError('whatsapp_number', client.whatsapp_number);
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
