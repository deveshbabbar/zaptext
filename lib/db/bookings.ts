// ─── Neon-backed bookings + slots + date overrides store ───
//
// Drop-in replacement for the DB-touching functions previously exported
// from lib/booking.ts. The three Sheets tabs (bookings, weekly_schedule,
// date_overrides) all become Neon tables — placed in one module because
// getAvailableSlots() composes reads across all three. Pure date helpers
// (getTodayIST, calculateEndTime, etc.) and the generateDefaultSchedule
// orchestrator stay in lib/booking.ts.

import { v4 as uuid } from 'uuid';
import { and, asc, eq } from 'drizzle-orm';
import { db } from './index';
import {
  bookings as bookingsTable,
  slots as slotsTable,
  date_overrides as dateOverridesTable,
} from './schema';

// ─── Public types (preserved 1:1 with legacy lib/booking.ts) ───────────

export interface TimeSlot {
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  service_type: string;
}

export interface DateOverride {
  client_id: string;
  date: string;
  override_type: 'blocked' | 'custom';
  custom_start: string;
  custom_end: string;
  reason: string;
}

export interface Booking {
  booking_id: string;
  client_id: string;
  customer_phone: string;
  customer_name: string;
  date: string;
  time_slot: string;
  end_time: string;
  service: string;
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'pending_approval';
  notes: string;
  created_at: string;
  reminded: boolean;
  owner_notified: boolean;
}

export interface WeeklySlot {
  client_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  is_active: boolean;
  service_type: string;
}

// ─── Date helpers used internally ───────────────────────────────────────

function getTodayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function getCurrentTimeIST(): string {
  return new Date().toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function getDayOfWeek(date: string): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const [year, month, day] = date.split('-').map(Number);
  return days[new Date(year, month - 1, day).getDay()];
}

// ─── Converters ─────────────────────────────────────────────────────────

type DbBookingRow = typeof bookingsTable.$inferSelect;

function dbRowToBooking(row: DbBookingRow): Booking {
  return {
    booking_id: row.booking_id,
    client_id: row.client_id,
    customer_phone: row.customer_phone,
    customer_name: row.customer_name ?? '',
    date: row.date,
    time_slot: row.time_slot,
    end_time: row.end_time ?? '',
    service: row.service ?? '',
    status: row.status as Booking['status'],
    notes: row.notes ?? '',
    created_at: row.created_at ? row.created_at.toISOString() : '',
    reminded: row.reminded,
    owner_notified: row.owner_notified,
  };
}

// ─── Weekly schedule (slots table) ──────────────────────────────────────

export async function getWeeklySchedule(
  clientId: string,
  dayOfWeek?: string
): Promise<WeeklySlot[]> {
  const where = dayOfWeek
    ? and(eq(slotsTable.client_id, clientId), eq(slotsTable.day_of_week, dayOfWeek))
    : eq(slotsTable.client_id, clientId);
  const rows = await db.select().from(slotsTable).where(where).orderBy(asc(slotsTable.start_time));
  return rows.map((r) => ({
    client_id: r.client_id,
    day_of_week: r.day_of_week,
    start_time: r.start_time,
    end_time: r.end_time,
    slot_duration_minutes: r.slot_duration_minutes,
    is_active: r.is_active,
    service_type: r.service_type ?? '',
  }));
}

// Replaces all rows for this client with the provided list — matches the
// legacy "delete client's rows, insert fresh" pattern.
export async function setWeeklySchedule(clientId: string, schedule: WeeklySlot[]): Promise<void> {
  await db.delete(slotsTable).where(eq(slotsTable.client_id, clientId));
  if (schedule.length === 0) return;
  await db.insert(slotsTable).values(
    schedule.map((s) => ({
      id: uuid(),
      client_id: s.client_id,
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      slot_duration_minutes: s.slot_duration_minutes,
      is_active: s.is_active,
      service_type: s.service_type || '',
    }))
  );
}

// ─── Date overrides ─────────────────────────────────────────────────────

export async function getDateOverride(
  clientId: string,
  date: string
): Promise<DateOverride | null> {
  const rows = await db
    .select()
    .from(dateOverridesTable)
    .where(and(eq(dateOverridesTable.client_id, clientId), eq(dateOverridesTable.date, date)))
    .limit(1);
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    client_id: r.client_id,
    date: r.date,
    override_type: r.override_type as DateOverride['override_type'],
    custom_start: r.custom_start ?? '',
    custom_end: r.custom_end ?? '',
    reason: r.reason ?? '',
  };
}

// Upsert via composite-unique (client_id, date) — same client+date can't
// have two override rows.
export async function addDateOverride(override: DateOverride): Promise<void> {
  await db
    .insert(dateOverridesTable)
    .values({
      id: uuid(),
      client_id: override.client_id,
      date: override.date,
      override_type: override.override_type,
      custom_start: override.custom_start || '',
      custom_end: override.custom_end || '',
      reason: override.reason || '',
    })
    .onConflictDoUpdate({
      target: [dateOverridesTable.client_id, dateOverridesTable.date],
      set: {
        override_type: override.override_type,
        custom_start: override.custom_start || '',
        custom_end: override.custom_end || '',
        reason: override.reason || '',
      },
    });
}

export async function getDateOverrides(clientId: string): Promise<DateOverride[]> {
  const rows = await db
    .select()
    .from(dateOverridesTable)
    .where(eq(dateOverridesTable.client_id, clientId))
    .orderBy(asc(dateOverridesTable.date));
  return rows.map((r) => ({
    client_id: r.client_id,
    date: r.date,
    override_type: r.override_type as DateOverride['override_type'],
    custom_start: r.custom_start ?? '',
    custom_end: r.custom_end ?? '',
    reason: r.reason ?? '',
  }));
}

// ─── Bookings: simple reads ─────────────────────────────────────────────

export async function getBookingsForDate(clientId: string, date: string): Promise<Booking[]> {
  const rows = await db
    .select()
    .from(bookingsTable)
    .where(and(eq(bookingsTable.client_id, clientId), eq(bookingsTable.date, date)))
    .orderBy(asc(bookingsTable.time_slot));
  return rows.map(dbRowToBooking);
}

export async function getBookingsByClient(clientId: string, status?: string): Promise<Booking[]> {
  const where = status
    ? and(eq(bookingsTable.client_id, clientId), eq(bookingsTable.status, status))
    : eq(bookingsTable.client_id, clientId);
  const rows = await db.select().from(bookingsTable).where(where);
  return rows.map(dbRowToBooking);
}

export async function getBookingsByCustomer(
  clientId: string,
  customerPhone: string
): Promise<Booking[]> {
  const rows = await db
    .select()
    .from(bookingsTable)
    .where(and(eq(bookingsTable.client_id, clientId), eq(bookingsTable.customer_phone, customerPhone)));
  return rows.map(dbRowToBooking);
}

export async function getBookingById(bookingId: string): Promise<Booking | null> {
  const rows = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.booking_id, bookingId))
    .limit(1);
  return rows[0] ? dbRowToBooking(rows[0]) : null;
}

// Used by cron/reminders — every booking on the given date with confirmed status.
export async function getBookingsForTomorrow(date: string): Promise<Booking[]> {
  const rows = await db
    .select()
    .from(bookingsTable)
    .where(and(eq(bookingsTable.date, date), eq(bookingsTable.status, 'confirmed')));
  return rows.map(dbRowToBooking);
}

// ─── Available slots (composes weekly schedule + override + bookings) ───

export async function getAvailableSlots(
  clientId: string,
  date: string,
  serviceType?: string
): Promise<TimeSlot[]> {
  const override = await getDateOverride(clientId, date);
  if (override?.override_type === 'blocked') return [];

  const dayOfWeek = getDayOfWeek(date);
  let slots = await getWeeklySchedule(clientId, dayOfWeek);

  if (override?.override_type === 'custom') {
    slots = slots.filter(
      (s) => s.start_time >= override.custom_start && s.end_time <= override.custom_end
    );
  }

  if (serviceType) {
    slots = slots.filter((s) => s.service_type === serviceType || s.service_type === 'general');
  }

  // pending_approval blocks the slot too — two customers can't grab the
  // same time while a trainer is reviewing.
  const existingBookings = await getBookingsForDate(clientId, date);
  const bookedTimes = existingBookings
    .filter((b) => b.status === 'confirmed' || b.status === 'pending_approval')
    .map((b) => b.time_slot);
  slots = slots.filter((s) => !bookedTimes.includes(s.start_time));

  if (date === getTodayIST()) {
    const currentTime = getCurrentTimeIST();
    slots = slots.filter((s) => s.start_time > currentTime);
  }

  return slots.map((s) => ({
    start_time: s.start_time,
    end_time: s.end_time,
    slot_duration_minutes: s.slot_duration_minutes,
    service_type: s.service_type,
  }));
}

// ─── Create / approve / cancel ──────────────────────────────────────────

export async function createBooking(params: {
  clientId: string;
  customerPhone: string;
  customerName: string;
  date: string;
  timeSlot: string;
  endTime: string;
  service?: string;
  notes?: string;
  status?: Booking['status'];
}): Promise<Booking> {
  // Double-check slot is still available
  const available = await getAvailableSlots(params.clientId, params.date);
  const slotExists = available.find((s) => s.start_time === params.timeSlot);
  if (!slotExists) throw new Error('SLOT_TAKEN');

  const booking: Booking = {
    booking_id: `BK_${uuid()}`,
    client_id: params.clientId,
    customer_phone: params.customerPhone,
    customer_name: params.customerName,
    date: params.date,
    time_slot: params.timeSlot,
    end_time: params.endTime,
    service: params.service || '',
    status: params.status || 'confirmed',
    notes: params.notes || '',
    created_at: new Date().toISOString(),
    reminded: false,
    owner_notified: false,
  };

  await db.insert(bookingsTable).values({
    booking_id: booking.booking_id,
    client_id: booking.client_id,
    customer_phone: booking.customer_phone,
    customer_name: booking.customer_name,
    date: booking.date,
    time_slot: booking.time_slot,
    end_time: booking.end_time,
    service: booking.service,
    status: booking.status,
    notes: booking.notes,
    created_at: new Date(booking.created_at),
    reminded: false,
    owner_notified: false,
  });

  // Race-detect: two requests that both passed availability can both
  // insert. Re-read the same slot, keep the earliest by created_at, mark
  // the rest cancelled. Same logic as legacy lib/booking.ts.
  try {
    const sameSlot = (await getBookingsForDate(params.clientId, params.date))
      .filter(
        (b) =>
          b.time_slot === params.timeSlot &&
          (b.status === 'confirmed' || b.status === 'pending_approval')
      )
      .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    if (sameSlot.length > 1) {
      const winner = sameSlot[0];
      if (winner.booking_id !== booking.booking_id) {
        await cancelBooking(booking.booking_id, '[RACE-LOST] Slot taken by earlier booking');
        throw new Error('SLOT_TAKEN');
      }
    }
  } catch (e) {
    if (e instanceof Error && e.message === 'SLOT_TAKEN') throw e;
    console.error('[createBooking] race-check failed (non-fatal):', e);
  }

  return booking;
}

export async function approveBooking(bookingId: string): Promise<Booking | null> {
  const current = await getBookingById(bookingId);
  if (!current) return null;
  if (current.status !== 'pending_approval' && current.status !== 'confirmed') return current;
  if (current.status === 'pending_approval') {
    await db
      .update(bookingsTable)
      .set({ status: 'confirmed' })
      .where(eq(bookingsTable.booking_id, bookingId));
  }
  return { ...current, status: 'confirmed' };
}

export async function cancelBooking(bookingId: string, reason?: string): Promise<boolean> {
  const current = await getBookingById(bookingId);
  if (!current) return false;
  const updates: { status: 'cancelled'; notes?: string } = { status: 'cancelled' };
  if (reason && reason.trim()) {
    const tag = `[CANCELLED: ${reason.trim().slice(0, 120)}]`;
    updates.notes = current.notes ? `${current.notes} | ${tag}` : tag;
  }
  await db.update(bookingsTable).set(updates).where(eq(bookingsTable.booking_id, bookingId));
  return true;
}
