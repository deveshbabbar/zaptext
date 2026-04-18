import { google } from 'googleapis';
import { StaffMember, StaffAvailability, StaffAvailabilityBlock } from './types';
import { generateId } from './utils';

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}
function getSheets() {
  return google.sheets({ version: 'v4', auth: getAuth() });
}
const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

export const DAYS = [
  'monday','tuesday','wednesday','thursday','friday','saturday','sunday',
] as const;
type Day = typeof DAYS[number];

export function emptyAvailability(): StaffAvailability {
  return {
    monday: [], tuesday: [], wednesday: [], thursday: [],
    friday: [], saturday: [], sunday: [],
  };
}

function parseAvailability(raw: string): StaffAvailability {
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

function rowToMember(row: string[]): StaffMember {
  return {
    staff_id: row[0] || '',
    client_id: row[1] || '',
    name: row[2] || '',
    specialty: row[3] || '',
    price: parseFloat(row[4] || '0') || 0,
    whatsapp_phone: (row[5] || '').replace(/\D/g, ''),
    bio: row[6] || '',
    is_active: (row[7] || 'TRUE').toUpperCase() !== 'FALSE',
    availability: parseAvailability(row[8] || '{}'),
    created_at: row[9] || '',
  };
}

function memberToRow(m: StaffMember): string[] {
  return [
    m.staff_id, m.client_id, m.name, m.specialty,
    m.price.toString(), m.whatsapp_phone.replace(/\D/g, ''),
    m.bio, m.is_active ? 'TRUE' : 'FALSE',
    JSON.stringify(m.availability), m.created_at,
  ];
}

async function fetchAllRows(): Promise<{ rowIndex: number; member: StaffMember }[]> {
  const sheets = getSheets();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'staff!A2:J',
    });
    return (res.data.values || []).map((row, i) => ({ rowIndex: i + 2, member: rowToMember(row) }));
  } catch {
    return [];
  }
}

export async function getStaff(clientId: string): Promise<StaffMember[]> {
  const all = await fetchAllRows();
  return all.filter((x) => x.member.client_id === clientId).map((x) => x.member);
}

export async function getActiveStaff(clientId: string): Promise<StaffMember[]> {
  return (await getStaff(clientId)).filter((m) => m.is_active);
}

export async function getStaffById(staffId: string): Promise<StaffMember | null> {
  const all = await fetchAllRows();
  return all.find((x) => x.member.staff_id === staffId)?.member || null;
}

export async function getStaffByPhoneAny(phone: string): Promise<StaffMember | null> {
  const digits = phone.replace(/\D/g, '');
  const all = await fetchAllRows();
  return all.find((x) => x.member.is_active && x.member.whatsapp_phone === digits)?.member || null;
}

export async function upsertStaff(
  input: Partial<StaffMember> & { client_id: string; name: string }
): Promise<StaffMember> {
  const sheets = getSheets();
  const all = await fetchAllRows();
  const existing = input.staff_id ? all.find((x) => x.member.staff_id === input.staff_id) : undefined;

  const member: StaffMember = {
    staff_id: existing?.member.staff_id || input.staff_id || generateId(),
    client_id: input.client_id,
    name: input.name.trim(),
    specialty: typeof input.specialty === 'string' ? input.specialty.trim() : existing?.member.specialty || '',
    price: typeof input.price === 'number' ? input.price : existing?.member.price ?? 0,
    whatsapp_phone: typeof input.whatsapp_phone === 'string' ? input.whatsapp_phone.replace(/\D/g, '') : existing?.member.whatsapp_phone || '',
    bio: typeof input.bio === 'string' ? input.bio.trim() : existing?.member.bio || '',
    is_active: typeof input.is_active === 'boolean' ? input.is_active : existing?.member.is_active ?? true,
    availability: input.availability || existing?.member.availability || emptyAvailability(),
    created_at: existing?.member.created_at || new Date().toISOString(),
  };

  if (existing) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `staff!A${existing.rowIndex}:J${existing.rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [memberToRow(member)] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'staff!A:J',
      valueInputOption: 'RAW',
      requestBody: { values: [memberToRow(member)] },
    });
  }
  return member;
}

export async function deleteStaff(staffId: string): Promise<boolean> {
  const member = await getStaffById(staffId);
  if (!member) return false;
  await upsertStaff({ ...member, is_active: false });
  return true;
}

export async function updateStaffAvailability(staffId: string, availability: StaffAvailability): Promise<StaffMember | null> {
  const member = await getStaffById(staffId);
  if (!member) return null;
  return upsertStaff({ ...member, availability });
}

// ─── Availability display ───

export function formatAvailabilityForBot(member: StaffMember): string {
  const parts: string[] = [];
  for (const day of DAYS) {
    const blocks = member.availability[day];
    if (blocks && blocks.length > 0) {
      const times = blocks.map((b) => `${b.start}–${b.end}`).join(', ');
      parts.push(`${day.charAt(0).toUpperCase() + day.slice(1)}: ${times}`);
    }
  }
  return parts.length > 0 ? parts.join(' | ') : 'Schedule: contact us';
}

// ─── Availability command parser ───

const DAY_ALIASES: Record<string, Day> = {
  mon: 'monday', monday: 'monday', tue: 'tuesday', tuesday: 'tuesday',
  wed: 'wednesday', wednesday: 'wednesday', thu: 'thursday', thursday: 'thursday',
  fri: 'friday', friday: 'friday', sat: 'saturday', saturday: 'saturday',
  sun: 'sunday', sunday: 'sunday',
};

function parse12h(raw: string): string {
  const m = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return '09:00';
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const period = (m[3] || '').toLowerCase();
  if (period === 'pm' && h < 12) h += 12;
  if (period === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function parseAvailabilityCommand(text: string): StaffAvailability | null {
  const lower = text.toLowerCase().trim();
  const timePattern = /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi;
  const timeMatches: StaffAvailabilityBlock[] = [];
  let m: RegExpExecArray | null;
  while ((m = timePattern.exec(lower)) !== null) {
    timeMatches.push({ start: parse12h(m[1]), end: parse12h(m[2]) });
  }
  if (timeMatches.length === 0) return null;

  const availability = emptyAvailability();
  const dayPart = lower.replace(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*[-–to]+\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi, '').trim();

  const rangeMatch = dayPart.match(/(\w{2,})\s*[-–]\s*(\w{2,})/);
  if (rangeMatch) {
    const fromDay = DAY_ALIASES[rangeMatch[1]];
    const toDay = DAY_ALIASES[rangeMatch[2]];
    if (fromDay && toDay) {
      let inRange = false;
      for (const d of DAYS) {
        if (d === fromDay) inRange = true;
        if (inRange) availability[d] = [...timeMatches];
        if (d === toDay) break;
      }
      return availability;
    }
  }

  const words = dayPart.split(/[\s,]+/);
  let found = false;
  for (const w of words) {
    const day = DAY_ALIASES[w.replace(/[^a-z]/g, '')];
    if (day) { availability[day] = [...timeMatches]; found = true; }
  }
  return found ? availability : null;
}
