// ─── Booking: pure date helpers + Neon-backed DB layer ───
//
// Phase 2B step 4 (final) of the Neon migration. The DB-touching functions
// live in lib/db/bookings.ts and are re-exported from here so the 9
// existing callers (webhook, cron/reminders, cron/morning-summary,
// cron/evening-summary, booking/cancel, client/stats, client/date-overrides,
// client/schedule, client/bookings) don't change their imports.
// Pure date helpers and generateDefaultSchedule stay here because they
// don't need DB access.

import { setWeeklySchedule } from './db/bookings';
import type { WeeklySlot } from './db/bookings';

// Re-export public types and DB functions.
export type {
  TimeSlot,
  DateOverride,
  Booking,
  WeeklySlot,
} from './db/bookings';

export {
  getWeeklySchedule,
  setWeeklySchedule,
  getDateOverride,
  addDateOverride,
  getDateOverrides,
  getBookingsForDate,
  getBookingsByClient,
  getBookingsByCustomer,
  getBookingById,
  getBookingsForTomorrow,
  getAvailableSlots,
  createBooking,
  approveBooking,
  cancelBooking,
} from './db/bookings';

// ─── Pure date helpers (no I/O) ─────────────────────────────────────────

export function getTodayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function getCurrentTimeIST(): string {
  return new Date().toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

export function getDayOfWeek(date: string): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  // Parse as local date to avoid UTC day-of-week shift
  const [year, month, day] = date.split('-').map(Number);
  return days[new Date(year, month - 1, day).getDay()];
}

export function getDateOffset(date: string, days: number): string {
  // Parse as local date to avoid UTC shift
  const [year, month, day] = date.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
}

// ─── Default-schedule generator (orchestrates setWeeklySchedule) ────────
//
// Default: Mon–Sat 10:00–13:00 + 14:00–17:00 in `slotDuration`-minute slots.
// Called when a new client is onboarded so they have a usable schedule
// without manual setup.

export async function generateDefaultSchedule(
  clientId: string,
  _workingHours: string,
  slotDuration: number = 30
): Promise<void> {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const schedule: WeeklySlot[] = [];

  for (const day of days) {
    // Morning slots
    for (let hour = 10; hour < 13; hour++) {
      for (let min = 0; min < 60; min += slotDuration) {
        const start = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
        const end = calculateEndTime(start, slotDuration);
        schedule.push({
          client_id: clientId,
          day_of_week: day,
          start_time: start,
          end_time: end,
          slot_duration_minutes: slotDuration,
          is_active: true,
          service_type: 'general',
        });
      }
    }
    // Afternoon slots
    for (let hour = 14; hour < 17; hour++) {
      for (let min = 0; min < 60; min += slotDuration) {
        const start = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
        const end = calculateEndTime(start, slotDuration);
        schedule.push({
          client_id: clientId,
          day_of_week: day,
          start_time: start,
          end_time: end,
          slot_duration_minutes: slotDuration,
          is_active: true,
          service_type: 'general',
        });
      }
    }
  }

  await setWeeklySchedule(clientId, schedule);
}
