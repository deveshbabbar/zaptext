// ─── Neon-backed bookings + slots + date overrides store ───
//
// Drop-in replacement for the DB-touching functions previously exported
// from lib/booking.ts. The three Sheets tabs (bookings, weekly_schedule,
// date_overrides) all become Neon tables — placed in one module because
// getAvailableSlots() composes reads across all three. Pure date helpers
// (getTodayIST, calculateEndTime, etc.) and the generateDefaultSchedule
// orchestrator stay in lib/booking.ts.

import { v4 as uuid } from 'uuid';
import { and, asc, eq, inArray, lt } from 'drizzle-orm';
import { db } from './index';
import {
  bookings as bookingsTable,
  slots as slotsTable,
  date_overrides as dateOverridesTable,
  clients as clientsTable,
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
  // null = generic gym/business slot. Non-null = booked with this specific
  // trainer/staff member; conflict checks and per-trainer calendar use it.
  staff_id: string | null;
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
    staff_id: row.staff_id ?? null,
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

// Used by cron/auto-cancel-stale — finds pending_approval bookings older than
// `maxAgeMinutes` so the cron can cancel them and free up the slot. Without
// this safety net, a trainer who never sees / never responds to the booking
// notification leaves the customer hanging indefinitely AND blocks the slot
// from being booked by anyone else (per-trainer slot conflict logic treats
// pending_approval rows as "taken").
export async function getStalePendingBookings(maxAgeMinutes: number): Promise<Booking[]> {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  const rows = await db
    .select()
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.status, 'pending_approval'),
        lt(bookingsTable.created_at, cutoff)
      )
    )
    .orderBy(asc(bookingsTable.created_at));
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
  // same time while a trainer is reviewing. Only count GENERIC bookings
  // (staff_id IS NULL) here — per-trainer bookings live in their own
  // availability map computed by getAvailableSlotsForStaff() and must not
  // block the gym-wide slot grid (otherwise booking trainer A at 4 PM would
  // block trainer B at 4 PM).
  const existingBookings = await getBookingsForDate(clientId, date);
  const bookedTimes = existingBookings
    .filter((b) => (b.status === 'confirmed' || b.status === 'pending_approval') && b.staff_id == null)
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

// ─── Per-trainer availability ───────────────────────────────────────────
//
// When a booking is for a SPECIFIC trainer (staff_id non-null), we use the
// trainer's own availability JSON (stored on staff.availability) — NOT the
// gym-wide weekly_schedule. That way:
//   - A new gym with no weekly_schedule still allows trainer bookings
//     (was the cause of the spurious "Sorry, yeh slot abhi kisi ne le liya"
//     reply when the gym hadn't manually configured /client/schedule yet).
//   - Trainers control their own hours via /client/staff or by texting
//     "avail mon-fri 9am-6pm" to the bot.
//   - Conflict checks only count bookings WITH the SAME staff_id, so two
//     customers can book different trainers at the same hour.
//
// Slot duration defaults to 30 min. We synthesize start times in 30-min
// steps inside each availability block — same granularity as the gym-wide
// generator. The weekly_schedule table is bypassed entirely for staff bookings.

interface StaffLikeForAvailability {
  availability: Record<string, Array<{ start: string; end: string }>>;
}

function generateStaffSlots(
  staff: StaffLikeForAvailability,
  date: string,
  slotDurationMinutes = 30
): TimeSlot[] {
  const day = getDayOfWeek(date);
  const blocks = staff.availability?.[day] || [];
  const out: TimeSlot[] = [];
  for (const b of blocks) {
    if (!b?.start || !b?.end) continue;
    const [sh, sm] = b.start.split(':').map((n) => parseInt(n, 10));
    const [eh, em] = b.end.split(':').map((n) => parseInt(n, 10));
    if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) continue;
    let cursor = sh * 60 + sm;
    const end = eh * 60 + em;
    while (cursor + slotDurationMinutes <= end) {
      const startH = Math.floor(cursor / 60);
      const startM = cursor % 60;
      const finishMin = cursor + slotDurationMinutes;
      const finishH = Math.floor(finishMin / 60);
      const finishM = finishMin % 60;
      out.push({
        start_time: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
        end_time: `${String(finishH).padStart(2, '0')}:${String(finishM).padStart(2, '0')}`,
        slot_duration_minutes: slotDurationMinutes,
        service_type: 'staff',
      });
      cursor += slotDurationMinutes;
    }
  }
  return out;
}

export async function getAvailableSlotsForStaff(
  clientId: string,
  staffId: string,
  date: string,
  slotDurationMinutes = 30
): Promise<TimeSlot[]> {
  // Block out the date if the gym set an "all-day blocked" override (e.g.
  // gym closed for Holi). Custom-hours overrides only narrow the gym-wide
  // window, not a trainer's personal hours, so we don't apply them here —
  // a trainer can still take a slot inside their own availability even on
  // a gym custom-hours day.
  const override = await getDateOverride(clientId, date);
  if (override?.override_type === 'blocked') return [];

  // Lazy-load the staff row to avoid a circular import. lib/db/staff also
  // imports from lib/utils, so going through the index keeps this clean.
  const { getStaffById } = await import('./staff');
  const member = await getStaffById(staffId);
  if (!member || member.client_id !== clientId || !member.is_active) return [];

  let slots = generateStaffSlots(
    { availability: member.availability as unknown as Record<string, Array<{ start: string; end: string }>> },
    date,
    slotDurationMinutes
  );

  // Drop slots already taken by THIS trainer (other trainers don't matter).
  const taken = await db
    .select()
    .from(bookingsTable)
    .where(and(eq(bookingsTable.staff_id, staffId), eq(bookingsTable.date, date)));
  const blockedTimes = taken
    .filter((b) => b.status === 'confirmed' || b.status === 'pending_approval')
    .map((b) => b.time_slot);
  slots = slots.filter((s) => !blockedTimes.includes(s.start_time));

  // Hide past slots when looking at today.
  if (date === getTodayIST()) {
    const currentTime = getCurrentTimeIST();
    slots = slots.filter((s) => s.start_time > currentTime);
  }
  return slots;
}

export async function getBookingsForStaff(
  staffId: string,
  date?: string
): Promise<Booking[]> {
  const where = date
    ? and(eq(bookingsTable.staff_id, staffId), eq(bookingsTable.date, date))
    : eq(bookingsTable.staff_id, staffId);
  const rows = await db
    .select()
    .from(bookingsTable)
    .where(where)
    .orderBy(asc(bookingsTable.date), asc(bookingsTable.time_slot));
  return rows.map(dbRowToBooking);
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
  // When set, validate against the trainer's personal availability
  // (getAvailableSlotsForStaff) and tag the booking with this staff_id.
  // When unset, fall back to gym-wide weekly_schedule (legacy behavior).
  staffId?: string | null;
  // Skip reservation-slot validation. Food orders / takeaway / dine-in
  // orders reuse this table but don't live on the weekly_schedule grid —
  // their time_slot is just the wall-clock minute the order arrived.
  // Set true from the webhook order pipeline to bypass both the
  // slot-existence check and the race-detect (which compares time_slot).
  skipSlotValidation?: boolean;
}): Promise<Booking> {
  // Double-check slot is still available — per-trainer if staffId, else gym-wide.
  // Skipped entirely for food orders (skipSlotValidation=true) since their
  // time_slot is wall-clock and doesn't map to the reservation grid.
  if (!params.skipSlotValidation) {
    const available = params.staffId
      ? await getAvailableSlotsForStaff(params.clientId, params.staffId, params.date)
      : await getAvailableSlots(params.clientId, params.date);
    const slotExists = available.find((s) => s.start_time === params.timeSlot);
    if (!slotExists) throw new Error('SLOT_TAKEN');
  }

  const booking: Booking = {
    booking_id: `BK_${uuid()}`,
    client_id: params.clientId,
    customer_phone: params.customerPhone,
    customer_name: params.customerName,
    date: params.date,
    time_slot: params.timeSlot,
    end_time: params.endTime,
    service: params.service || '',
    staff_id: params.staffId ?? null,
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
    staff_id: booking.staff_id,
    status: booking.status,
    notes: booking.notes,
    created_at: new Date(booking.created_at),
    reminded: false,
    owner_notified: false,
  });

  // Race-detect: two requests that both passed availability can both
  // insert. Per-trainer races only count rows with THE SAME staff_id;
  // generic races only count rows with NULL staff_id. Food orders bypass
  // this entirely — two customers ordering at the same minute is normal,
  // not a slot collision.
  if (params.skipSlotValidation) return booking;
  try {
    const sameSlot = (await getBookingsForDate(params.clientId, params.date))
      .filter(
        (b) =>
          b.time_slot === params.timeSlot &&
          (b.status === 'confirmed' || b.status === 'pending_approval') &&
          ((params.staffId && b.staff_id === params.staffId) ||
            (!params.staffId && b.staff_id == null))
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

// Cascade-cancel every pending_approval booking owned by this Clerk user.
// Used when a Razorpay refund (or other subscription-revoke event) drops
// the user's plan: confirmed bookings stay (the customer is supposed to
// attend) but pending_approval ones can never get approved (feature gates
// strip the trainer's [APPROVE:] tag downstream), so we free those slots
// proactively. Returns the count of cancelled rows.
export async function cancelPendingBookingsForOwner(
  ownerUserId: string,
  reason: string
): Promise<number> {
  if (!ownerUserId) return 0;

  // Step 1: enumerate the owner's bots so we can scope the booking update.
  // Using a separate read keeps the UPDATE simple (Drizzle doesn't model
  // cross-table UPDATE ... FROM ... WHERE cleanly across all dialects).
  const ownerClients = await db
    .select({ client_id: clientsTable.client_id })
    .from(clientsTable)
    .where(eq(clientsTable.owner_user_id, ownerUserId));
  if (ownerClients.length === 0) return 0;
  const clientIds = ownerClients.map((c) => c.client_id);

  // Step 2: pull the rows we're about to cancel so we can tag notes
  // properly (preserving any existing notes via the same | join the
  // single-booking cancel uses).
  const pending = await db
    .select()
    .from(bookingsTable)
    .where(
      and(
        inArray(bookingsTable.client_id, clientIds),
        eq(bookingsTable.status, 'pending_approval')
      )
    );
  if (pending.length === 0) return 0;

  const tag = `[CANCELLED: ${reason.trim().slice(0, 120)}]`;
  let cancelled = 0;
  for (const row of pending) {
    const newNotes = row.notes ? `${row.notes} | ${tag}` : tag;
    await db
      .update(bookingsTable)
      .set({ status: 'cancelled', notes: newNotes })
      .where(eq(bookingsTable.booking_id, row.booking_id));
    cancelled += 1;
  }
  return cancelled;
}
