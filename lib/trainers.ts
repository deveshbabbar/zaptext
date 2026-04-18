import { google } from 'googleapis';
import { Trainer, TrainerAvailability, TrainerAvailabilityBlock } from './types';
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

export function emptyAvailability(): TrainerAvailability {
  return {
    monday: [], tuesday: [], wednesday: [], thursday: [],
    friday: [], saturday: [], sunday: [],
  };
}

function parseAvailability(raw: string): TrainerAvailability {
  try {
    const parsed = JSON.parse(raw);
    const result = emptyAvailability();
    for (const day of DAYS) {
      if (Array.isArray(parsed[day])) {
        result[day] = (parsed[day] as unknown[]).filter(
          (b): b is TrainerAvailabilityBlock =>
            !!b && typeof b === 'object' && 'start' in b && 'end' in b
        );
      }
    }
    return result;
  } catch {
    return emptyAvailability();
  }
}

function rowToTrainer(row: string[]): Trainer {
  return {
    trainer_id: row[0] || '',
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

function trainerToRow(t: Trainer): string[] {
  return [
    t.trainer_id,
    t.client_id,
    t.name,
    t.specialty,
    t.price.toString(),
    t.whatsapp_phone.replace(/\D/g, ''),
    t.bio,
    t.is_active ? 'TRUE' : 'FALSE',
    JSON.stringify(t.availability),
    t.created_at,
  ];
}

async function fetchAllRows(): Promise<{ rowIndex: number; trainer: Trainer }[]> {
  const sheets = getSheets();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'trainers!A2:J',
    });
    return (res.data.values || []).map((row, i) => ({
      rowIndex: i + 2,
      trainer: rowToTrainer(row),
    }));
  } catch {
    return [];
  }
}

export async function getTrainers(clientId: string): Promise<Trainer[]> {
  const all = await fetchAllRows();
  return all.filter((x) => x.trainer.client_id === clientId).map((x) => x.trainer);
}

export async function getActiveTrainers(clientId: string): Promise<Trainer[]> {
  return (await getTrainers(clientId)).filter((t) => t.is_active);
}

export async function getTrainerById(trainerId: string): Promise<Trainer | null> {
  const all = await fetchAllRows();
  return all.find((x) => x.trainer.trainer_id === trainerId)?.trainer || null;
}

export async function getTrainerByPhone(clientId: string, phone: string): Promise<Trainer | null> {
  const digits = phone.replace(/\D/g, '');
  const all = await fetchAllRows();
  return (
    all.find(
      (x) =>
        x.trainer.client_id === clientId &&
        x.trainer.whatsapp_phone === digits
    )?.trainer || null
  );
}

// Find trainer by phone across ALL clients (used in webhook before client lookup)
export async function getTrainerByPhoneAny(phone: string): Promise<Trainer | null> {
  const digits = phone.replace(/\D/g, '');
  const all = await fetchAllRows();
  return all.find((x) => x.trainer.is_active && x.trainer.whatsapp_phone === digits)?.trainer || null;
}

export async function upsertTrainer(
  input: Partial<Trainer> & { client_id: string; name: string }
): Promise<Trainer> {
  const sheets = getSheets();
  const all = await fetchAllRows();
  const existing = input.trainer_id
    ? all.find((x) => x.trainer.trainer_id === input.trainer_id)
    : undefined;

  const trainer: Trainer = {
    trainer_id: existing?.trainer.trainer_id || input.trainer_id || generateId(),
    client_id: input.client_id,
    name: input.name.trim(),
    specialty: typeof input.specialty === 'string' ? input.specialty.trim() : existing?.trainer.specialty || '',
    price: typeof input.price === 'number' ? input.price : existing?.trainer.price ?? 0,
    whatsapp_phone:
      typeof input.whatsapp_phone === 'string'
        ? input.whatsapp_phone.replace(/\D/g, '')
        : existing?.trainer.whatsapp_phone || '',
    bio: typeof input.bio === 'string' ? input.bio.trim() : existing?.trainer.bio || '',
    is_active: typeof input.is_active === 'boolean' ? input.is_active : existing?.trainer.is_active ?? true,
    availability: input.availability || existing?.trainer.availability || emptyAvailability(),
    created_at: existing?.trainer.created_at || new Date().toISOString(),
  };

  if (existing) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `trainers!A${existing.rowIndex}:J${existing.rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [trainerToRow(trainer)] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'trainers!A:J',
      valueInputOption: 'RAW',
      requestBody: { values: [trainerToRow(trainer)] },
    });
  }
  return trainer;
}

export async function deleteTrainer(trainerId: string): Promise<boolean> {
  const trainer = await getTrainerById(trainerId);
  if (!trainer) return false;
  await upsertTrainer({ ...trainer, is_active: false });
  return true;
}

export async function updateTrainerAvailability(
  trainerId: string,
  availability: TrainerAvailability
): Promise<Trainer | null> {
  const trainer = await getTrainerById(trainerId);
  if (!trainer) return null;
  return upsertTrainer({ ...trainer, availability });
}

// ─── Availability display helper ───

export function formatAvailabilityForBot(trainer: Trainer): string {
  const parts: string[] = [];
  for (const day of DAYS) {
    const blocks = trainer.availability[day];
    if (blocks && blocks.length > 0) {
      const times = blocks.map((b) => `${b.start}–${b.end}`).join(', ');
      parts.push(`${day.charAt(0).toUpperCase() + day.slice(1)}: ${times}`);
    }
  }
  return parts.length > 0 ? parts.join(' | ') : 'Schedule: contact gym';
}

// ─── Parse availability update command from trainer WhatsApp ───
// Examples: "avail mon-fri 9am-6pm"  "avail mon wed fri 9am-5pm"  "avail mon 9am-12pm 3pm-7pm"

const DAY_ALIASES: Record<string, Day> = {
  mon: 'monday', monday: 'monday',
  tue: 'tuesday', tuesday: 'tuesday',
  wed: 'wednesday', wednesday: 'wednesday',
  thu: 'thursday', thursday: 'thursday',
  fri: 'friday', friday: 'friday',
  sat: 'saturday', saturday: 'saturday',
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

export function parseAvailabilityCommand(text: string): TrainerAvailability | null {
  const lower = text.toLowerCase().trim();

  // Extract ALL time ranges "9am-6pm" / "09:00-18:00" / "3pm-7pm"
  const timePattern = /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi;
  const timeMatches: TrainerAvailabilityBlock[] = [];
  let m: RegExpExecArray | null;
  while ((m = timePattern.exec(lower)) !== null) {
    timeMatches.push({ start: parse12h(m[1]), end: parse12h(m[2]) });
  }
  if (timeMatches.length === 0) return null;

  const availability = emptyAvailability();
  // Day part: everything before the first digit
  const dayPart = lower.replace(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*[-–to]+\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi, '').trim();

  // Check for range "mon-fri"
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

  // Individual days "mon wed fri"
  const words = dayPart.split(/[\s,]+/);
  let found = false;
  for (const w of words) {
    const day = DAY_ALIASES[w.replace(/[^a-z]/g, '')];
    if (day) {
      availability[day] = [...timeMatches];
      found = true;
    }
  }
  return found ? availability : null;
}
