// Staff: pure utilities + Neon-backed DB layer.
// DB-touching functions live in lib/db/staff.ts and are re-exported here.
// Pure helpers (DAYS, emptyAvailability, formatAvailabilityForBot, parseAvailabilityCommand) stay here.

import type {
  StaffMember,
  StaffAvailability,
  StaffAvailabilityBlock,
} from './types';

// Re-export the DB-touching functions.
export {
  getStaff,
  getActiveStaff,
  getStaffById,
  getStaffByPhoneAny,
  upsertStaff,
  deleteStaff,
  updateStaffAvailability,
} from './db/staff';

// ─── Day constants ──────────────────────────────────────────────────────

export const DAYS = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
] as const;
type Day = typeof DAYS[number];

export function emptyAvailability(): StaffAvailability {
  return {
    monday: [], tuesday: [], wednesday: [], thursday: [],
    friday: [], saturday: [], sunday: [],
  };
}

// ─── Availability display (used in bot prompt) ──────────────────────────

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

// ─── Availability command parser ───────────────────────────────────────
//
// Lets staff text their bot something like:
//   "Available Mon-Fri 10am-6pm, Saturday 11-3"
// and have the parser turn that into a StaffAvailability object.

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
  const dayPart = lower
    .replace(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*[-–to]+\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi, '')
    .trim();

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
    if (day) {
      availability[day] = [...timeMatches];
      found = true;
    }
  }
  return found ? availability : null;
}
