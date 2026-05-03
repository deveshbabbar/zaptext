// ─── Neon-backed staff store ───
//
// Drop-in replacement for the DB-touching functions previously exported
// from lib/staff.ts. Pure helpers (formatAvailabilityForBot,
// parseAvailabilityCommand, emptyAvailability, DAYS) stay in lib/staff.ts
// and use these functions.
//
// Conversion notes:
// - StaffAvailability (the {monday: [{start,end}], …} shape) is stored as
//   a JSON string in the `availability` column — same layout as the old
//   Sheets column-I — so parseAvailability() in lib/staff.ts keeps working.
// - whatsapp_phone is always digits-only (matches the legacy Sheets writer
//   which strips non-digits on every write).

import { and, eq } from 'drizzle-orm';
import { db } from './index';
import { staff as staffTable } from './schema';
import type { StaffMember, StaffAvailability, StaffAvailabilityBlock } from '../types';
import { generateId } from '../utils';

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const;

function emptyAvailability(): StaffAvailability {
  return { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] };
}

function parseAvailability(raw: string | null | undefined): StaffAvailability {
  if (!raw) return emptyAvailability();
  try {
    const parsed = JSON.parse(raw);
    const result = emptyAvailability();
    for (const day of DAYS) {
      if (Array.isArray(parsed[day])) {
        result[day] = (parsed[day] as unknown[]).filter(
          (b): b is StaffAvailabilityBlock =>
            !!b && typeof b === 'object' && 'start' in b && 'end' in b
        );
      }
    }
    return result;
  } catch {
    return emptyAvailability();
  }
}

type DbStaffRow = typeof staffTable.$inferSelect;

function dbRowToMember(row: DbStaffRow): StaffMember {
  return {
    staff_id: row.staff_id,
    client_id: row.client_id,
    name: row.name,
    specialty: row.specialty ?? '',
    price: typeof row.price === 'string' ? parseFloat(row.price) : (row.price ?? 0),
    whatsapp_phone: (row.whatsapp_phone ?? '').replace(/\D/g, ''),
    bio: row.bio ?? '',
    is_active: row.is_active,
    availability: parseAvailability(row.availability),
    created_at: row.created_at ? row.created_at.toISOString() : '',
  };
}

// ─── reads ──────────────────────────────────────────────────────────────

export async function getStaff(clientId: string): Promise<StaffMember[]> {
  const rows = await db.select().from(staffTable).where(eq(staffTable.client_id, clientId));
  return rows.map(dbRowToMember);
}

export async function getActiveStaff(clientId: string): Promise<StaffMember[]> {
  const rows = await db
    .select()
    .from(staffTable)
    .where(and(eq(staffTable.client_id, clientId), eq(staffTable.is_active, true)));
  return rows.map(dbRowToMember);
}

export async function getStaffById(staffId: string): Promise<StaffMember | null> {
  const rows = await db.select().from(staffTable).where(eq(staffTable.staff_id, staffId)).limit(1);
  return rows[0] ? dbRowToMember(rows[0]) : null;
}

// Look up an active staff member by their personal WhatsApp number across
// all clients. Used when an owner-side message comes in from a known staff
// phone (e.g. "approve BK_xxx" coming from a trainer's number).
export async function getStaffByPhoneAny(phone: string): Promise<StaffMember | null> {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  const rows = await db
    .select()
    .from(staffTable)
    .where(and(eq(staffTable.whatsapp_phone, digits), eq(staffTable.is_active, true)))
    .limit(1);
  return rows[0] ? dbRowToMember(rows[0]) : null;
}

// ─── writes ─────────────────────────────────────────────────────────────

export async function upsertStaff(
  input: Partial<StaffMember> & { client_id: string; name: string }
): Promise<StaffMember> {
  const existing = input.staff_id ? await getStaffById(input.staff_id) : null;

  const member: StaffMember = {
    staff_id: existing?.staff_id || input.staff_id || generateId(),
    client_id: input.client_id,
    name: input.name.trim(),
    specialty: typeof input.specialty === 'string' ? input.specialty.trim() : existing?.specialty || '',
    price: typeof input.price === 'number' ? input.price : existing?.price ?? 0,
    whatsapp_phone:
      typeof input.whatsapp_phone === 'string'
        ? input.whatsapp_phone.replace(/\D/g, '')
        : existing?.whatsapp_phone || '',
    bio: typeof input.bio === 'string' ? input.bio.trim() : existing?.bio || '',
    is_active: typeof input.is_active === 'boolean' ? input.is_active : existing?.is_active ?? true,
    availability: input.availability || existing?.availability || emptyAvailability(),
    created_at: existing?.created_at || new Date().toISOString(),
  };

  await db
    .insert(staffTable)
    .values({
      staff_id: member.staff_id,
      client_id: member.client_id,
      name: member.name,
      specialty: member.specialty,
      price: String(member.price),
      whatsapp_phone: member.whatsapp_phone,
      bio: member.bio,
      is_active: member.is_active,
      availability: JSON.stringify(member.availability),
      created_at: new Date(member.created_at),
    })
    .onConflictDoUpdate({
      target: staffTable.staff_id,
      set: {
        client_id: member.client_id,
        name: member.name,
        specialty: member.specialty,
        price: String(member.price),
        whatsapp_phone: member.whatsapp_phone,
        bio: member.bio,
        is_active: member.is_active,
        availability: JSON.stringify(member.availability),
      },
    });

  return member;
}

export async function deleteStaff(staffId: string): Promise<boolean> {
  const member = await getStaffById(staffId);
  if (!member) return false;
  // Soft-delete via is_active=false to match legacy semantic.
  await upsertStaff({ ...member, is_active: false });
  return true;
}

export async function updateStaffAvailability(
  staffId: string,
  availability: StaffAvailability
): Promise<StaffMember | null> {
  const member = await getStaffById(staffId);
  if (!member) return null;
  return upsertStaff({ ...member, availability });
}
