// Work Item 1 — workingHours auto-seed for the `slots` table.
//
// The onboarding form collects `workingHours` as a free-text string ("Mon-Sun:
// 11 AM to 11 PM"). The webhook's availabilityContext block reads structured
// slots from the `slots` table. Without this seeder, the table is empty after
// onboarding and the bot replies "no slots available" on the very first
// booking question — the single biggest week-1 churn surface.
//
// This module:
//   1. Parses common Indian workingHours formats into ParsedDayBlock[]
//   2. Slices each block into fixed-duration slots
//   3. Returns WeeklySlot[] ready for setWeeklySchedule()
//
// Failure mode: returns [] if nothing parseable. Caller MUST treat seeder
// errors as non-fatal — onboarding completion is never blocked by a parser
// failure.

import type { WeeklySlot } from '@/lib/db/bookings';
import { calculateEndTime } from '@/lib/booking';

const DAY_KEYS = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
] as const;
type DayKey = (typeof DAY_KEYS)[number];

const DAY_ABBREV: Record<string, DayKey> = {
  mon: 'monday', monday: 'monday',
  tue: 'tuesday', tues: 'tuesday', tuesday: 'tuesday',
  wed: 'wednesday', weds: 'wednesday', wednesday: 'wednesday',
  thu: 'thursday', thur: 'thursday', thurs: 'thursday', thursday: 'thursday',
  fri: 'friday', friday: 'friday',
  sat: 'saturday', saturday: 'saturday',
  sun: 'sunday', sunday: 'sunday',
};

// Parse a time token like "11 am", "11pm", "23:00", "12 noon", "12 midnight"
// into 24-hour "HH:MM". Returns null if unparseable.
export function parseTime(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/\./g, '');
  if (!s) return null;

  // Special words first (must check before HH:MM regex so "12 noon" doesn't
  // get caught by the 12-hour branch).
  if (/^12\s*noon$/.test(s)) return '12:00';
  if (/^noon$/.test(s)) return '12:00';
  if (/^12\s*midnight$/.test(s)) return '00:00';
  if (/^midnight$/.test(s)) return '00:00';

  // 24-hour HH:MM (must come before 12-hour since "23:00" has no am/pm)
  const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    const h = parseInt(m24[1], 10);
    const m = parseInt(m24[2], 10);
    if (h <= 23 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    return null;
  }

  // 12-hour: "11", "11:30", optional am/pm
  const m12 = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const m = m12[2] ? parseInt(m12[2], 10) : 0;
    const ampm = m12[3];
    if (h > 23 || m > 59) return null;
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  return null;
}

// Parse a day specifier (range / list / keyword) into an ordered DayKey[].
// Returns [] if unparseable.
export function parseDays(raw: string): DayKey[] {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/\bto\b|\bthrough\b/g, '-')
    .replace(/[.\s]+/g, '');

  if (!s) return [];
  if (s === 'daily' || s === 'everyday' || s === 'alldays' || s === 'all' || s === 'all7days') {
    return [...DAY_KEYS];
  }
  if (s === 'weekday' || s === 'weekdays') {
    return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  }
  if (s === 'weekend' || s === 'weekends') return ['saturday', 'sunday'];

  // Range "mon-sun" (also handles wrap-around "fri-mon")
  const rangeMatch = s.match(/^([a-z]+)-([a-z]+)$/);
  if (rangeMatch) {
    const a = DAY_ABBREV[rangeMatch[1]];
    const b = DAY_ABBREV[rangeMatch[2]];
    if (a && b) {
      const ai = DAY_KEYS.indexOf(a);
      const bi = DAY_KEYS.indexOf(b);
      if (ai !== -1 && bi !== -1) {
        if (ai <= bi) return DAY_KEYS.slice(ai, bi + 1) as DayKey[];
        return [...DAY_KEYS.slice(ai), ...DAY_KEYS.slice(0, bi + 1)] as DayKey[];
      }
    }
  }

  // Single day or comma/slash-separated list ("mon,wed,fri" / "mon/wed/fri")
  const parts = s.split(/[,/]/).map((p) => DAY_ABBREV[p]).filter(Boolean) as DayKey[];
  return parts;
}

export interface ParsedDayBlock {
  day: DayKey;
  start: string;
  end: string;
}

// Parse free-text working hours into per-day open blocks. Handles common
// formats seen in Indian SMB onboarding inputs:
//   "Mon-Sun: 11 AM to 11 PM"
//   "Mon-Sat 10 am - 10:30 pm; Sun closed"
//   "Daily 12-3 PM, 7-11 PM"
//   "Mon-Fri 9-5, Sat 10-2, Sun closed"
//   "11:00-23:00"  (no day prefix → daily)
//   "24x7" / "24/7"
export function parseWorkingHours(raw: string): ParsedDayBlock[] {
  if (!raw || typeof raw !== 'string') return [];

  const out: ParsedDayBlock[] = [];

  // 24×7 special case → open every day 00:00–23:59 (we cap at 23:30 for the
  // 30-min slot generator; bookable hours past midnight are vanishingly rare
  // for SMB restaurants).
  if (/\b24\s*[x×*/]\s*7\b/i.test(raw) || /\b24\s*hours?\b/i.test(raw)) {
    for (const day of DAY_KEYS) {
      out.push({ day, start: '00:00', end: '23:30' });
    }
    return out;
  }

  // Split on ; or newline — different day-rules.
  const rules = raw.split(/[;\n]/);
  for (const ruleRaw of rules) {
    const rule = ruleRaw.trim();
    if (!rule) continue;

    // "closed" / "off" — skip silently (the day was already excluded by NOT
    // having a time block for it).
    if (/\b(closed|off|holiday)\b/i.test(rule)) continue;

    // Try to find a leading day token (range / list / keyword) followed by
    // colon, space, or dash, then the time portion.
    //
    // We match the day-token up to the first digit (or `:`-then-digit) that
    // starts the time portion.
    const dayThenTimeMatch = rule.match(/^\s*([a-zA-Z][a-zA-Z\s\-,/]*?)(?:[:\s])\s*(\d.+)$/);
    if (dayThenTimeMatch) {
      const days = parseDays(dayThenTimeMatch[1]);
      const timeText = dayThenTimeMatch[2];
      if (days.length > 0) {
        addTimeBlocksFor(days, timeText, out);
        continue;
      }
    }

    // Pure time-only rule like "11 AM to 11 PM" → apply to every day.
    if (/\d/.test(rule)) {
      addTimeBlocksFor([...DAY_KEYS], rule, out);
    }
  }

  return out;
}

function addTimeBlocksFor(days: DayKey[], timeText: string, out: ParsedDayBlock[]): void {
  // Multiple time blocks per day are comma-separated ("11-3, 6-11").
  const chunks = timeText.split(',').map((c) => c.trim()).filter(Boolean);
  for (const chunk of chunks) {
    // Match "A to B" / "A - B" / "A – B" / "A — B".
    const m = chunk.match(/^(.+?)\s*(?:-|–|—|to)\s*(.+?)$/i);
    if (!m) continue;
    let startRaw = m[1].trim();
    let endRaw = m[2].trim();

    // Indian-restaurant idiom: "7-11 PM" means BOTH 7 PM and 11 PM (not 7
    // AM to 11 PM). If one side has am/pm and the other doesn't, propagate
    // the marker to the bare side. Same for "7-11 AM" → both AM.
    const startHasMarker = /\b(am|pm|a\.?m\.?|p\.?m\.?|noon|midnight)\b/i.test(startRaw);
    const endHasMarker = /\b(am|pm|a\.?m\.?|p\.?m\.?|noon|midnight)\b/i.test(endRaw);
    if (!startHasMarker && endHasMarker) {
      const marker = endRaw.match(/\b(am|pm|a\.?m\.?|p\.?m\.?)\b/i)?.[0];
      if (marker) startRaw = `${startRaw} ${marker}`;
    } else if (startHasMarker && !endHasMarker) {
      const marker = startRaw.match(/\b(am|pm|a\.?m\.?|p\.?m\.?)\b/i)?.[0];
      if (marker) endRaw = `${endRaw} ${marker}`;
    }

    const start = parseTime(startRaw);
    const end = parseTime(endRaw);
    if (!start || !end) continue;
    if (start === end) continue;
    for (const day of days) {
      out.push({ day, start, end });
    }
  }
}

// Convert parsed blocks into slot rows of duration `slotDurationMinutes`.
// Drops blocks that wrap past midnight — bookable past-midnight slots are
// unusual for SMB restaurants and the bot's booking flow doesn't model them.
export function blocksToSlots(
  clientId: string,
  blocks: ParsedDayBlock[],
  slotDurationMinutes: number = 30
): WeeklySlot[] {
  const slots: WeeklySlot[] = [];
  for (const b of blocks) {
    if (b.end <= b.start) continue;
    let cursor = b.start;
    while (cursor < b.end) {
      const next = calculateEndTime(cursor, slotDurationMinutes);
      if (next > b.end) break;
      slots.push({
        client_id: clientId,
        day_of_week: b.day,
        start_time: cursor,
        end_time: next,
        slot_duration_minutes: slotDurationMinutes,
        is_active: true,
        service_type: 'general',
      });
      cursor = next;
    }
  }
  return slots;
}

// One-shot convenience: parse + slice.
export function buildSlotsFromHours(
  clientId: string,
  workingHours: string,
  slotDurationMinutes: number = 30
): WeeklySlot[] {
  const blocks = parseWorkingHours(workingHours);
  return blocksToSlots(clientId, blocks, slotDurationMinutes);
}
