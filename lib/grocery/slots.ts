// lib/grocery/slots.ts
//
// Pure logic for "what slots can a customer pick right now" given the
// configured slots and the current IST date/time. The DB query lives in
// lib/db/grocery-slots.ts; the wrapper availableSlots() loads then calls
// availableSlotsFor() so the latter stays pure and testable.

import { activeSlots } from '../db/grocery-slots';
import { todayIsoIST, dayOfWeekIST, nowHHMMIST } from './date-utils';
import type { GrocerySlot } from './types';

export interface AvailableSlot {
  slot_id: string;
  label: string;
  slot_date: string; // YYYY-MM-DD
  start_time: string;
  end_time: string;
}

const MAX_OFFERED = 3;
const LOOK_AHEAD_DAYS = 7;

export function availableSlotsFor(
  slots: GrocerySlot[],
  todayDate: string,
  todayDow: number,
  nowHHMM: string
): AvailableSlot[] {
  const active = slots.filter((s) => s.is_active);
  if (active.length === 0) return [];

  const out: AvailableSlot[] = [];
  // For each slot template, find its earliest valid delivery date (offset >= 1)
  // and emit one offering. Cap total emitted at MAX_OFFERED.
  for (const s of active) {
    for (let offset = 1; offset <= LOOK_AHEAD_DAYS; offset++) {
      const dow = (todayDow + offset) % 7;
      if (!s.days_of_week.includes(dow)) continue;
      // Cutoff is on the previous day. For offset=1, that's today; for offset=2,
      // that's tomorrow — but for now we only enforce cutoff when delivering
      // tomorrow (offset=1). Day-after-tomorrow always passes.
      if (offset === 1 && nowHHMM >= s.cutoff_time) continue;
      const date = addDays(todayDate, offset);
      out.push({
        slot_id: s.id,
        label: s.label,
        slot_date: date,
        start_time: s.start_time,
        end_time: s.end_time,
      });
      break; // one offering per slot template
    }
    if (out.length >= MAX_OFFERED) break;
  }
  return out;
}

function addDays(yyyymmdd: string, days: number): string {
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// Convenience wrapper for the webhook — loads + computes.
export async function availableSlotsForClient(client_id: string): Promise<AvailableSlot[]> {
  const slots = await activeSlots(client_id);
  return availableSlotsFor(slots, todayIsoIST(), dayOfWeekIST(), nowHHMMIST());
}
