import { google } from 'googleapis';

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

// ─── Types ───

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
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show';
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

// ─── Date Helpers ───

export function getTodayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function getCurrentTimeIST(): string {
  return new Date().toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function getDayOfWeek(date: string): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[new Date(date).getDay()];
}

export function getDateOffset(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
}

// ─── Weekly Schedule ───

export async function getWeeklySchedule(clientId: string, dayOfWeek?: string): Promise<WeeklySlot[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'weekly_schedule!A2:G',
  });
  const rows = res.data.values || [];
  return rows
    .map((row) => ({
      client_id: row[0] || '',
      day_of_week: row[1] || '',
      start_time: row[2] || '',
      end_time: row[3] || '',
      slot_duration_minutes: parseInt(row[4] || '30', 10),
      is_active: row[5] === 'TRUE',
      service_type: row[6] || 'general',
    }))
    .filter((s) => s.client_id === clientId && s.is_active && (!dayOfWeek || s.day_of_week === dayOfWeek));
}

export async function setWeeklySchedule(clientId: string, slots: WeeklySlot[]): Promise<void> {
  const sheets = getSheets();
  // Get all rows, remove this client's rows, add new ones
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'weekly_schedule!A2:G',
  });
  const existingRows = (res.data.values || []).filter((row) => row[0] !== clientId);
  const newRows = slots.map((s) => [
    s.client_id, s.day_of_week, s.start_time, s.end_time,
    String(s.slot_duration_minutes), s.is_active ? 'TRUE' : 'FALSE', s.service_type,
  ]);
  const allRows = [...existingRows, ...newRows];

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `weekly_schedule!A2:G${allRows.length + 1}`,
    valueInputOption: 'RAW',
    requestBody: { values: allRows },
  });
  // Clear any leftover rows
  const clearStart = allRows.length + 2;
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `weekly_schedule!A${clearStart}:G${clearStart + 100}`,
  });
}

// ─── Date Overrides ───

export async function getDateOverride(clientId: string, date: string): Promise<DateOverride | null> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'date_overrides!A2:F',
  });
  const rows = res.data.values || [];
  const match = rows.find((row) => row[0] === clientId && row[1] === date);
  if (!match) return null;
  return {
    client_id: match[0],
    date: match[1],
    override_type: match[2] as 'blocked' | 'custom',
    custom_start: match[3] || '',
    custom_end: match[4] || '',
    reason: match[5] || '',
  };
}

export async function addDateOverride(override: DateOverride): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'date_overrides!A:F',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        override.client_id, override.date, override.override_type,
        override.custom_start, override.custom_end, override.reason,
      ]],
    },
  });
}

export async function getDateOverrides(clientId: string): Promise<DateOverride[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'date_overrides!A2:F',
  });
  const rows = res.data.values || [];
  return rows
    .filter((row) => row[0] === clientId)
    .map((row) => ({
      client_id: row[0],
      date: row[1],
      override_type: row[2] as 'blocked' | 'custom',
      custom_start: row[3] || '',
      custom_end: row[4] || '',
      reason: row[5] || '',
    }));
}

// ─── Bookings ───

export async function getBookingsForDate(clientId: string, date: string): Promise<Booking[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'bookings!A2:M',
  });
  const rows = res.data.values || [];
  return rows
    .map(rowToBooking)
    .filter((b) => b.client_id === clientId && b.date === date);
}

export async function getBookingsByClient(clientId: string, status?: string): Promise<Booking[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'bookings!A2:M',
  });
  const rows = res.data.values || [];
  return rows
    .map(rowToBooking)
    .filter((b) => b.client_id === clientId && (!status || b.status === status));
}

export async function getBookingsByCustomer(clientId: string, customerPhone: string): Promise<Booking[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'bookings!A2:M',
  });
  const rows = res.data.values || [];
  return rows
    .map(rowToBooking)
    .filter((b) => b.client_id === clientId && b.customer_phone === customerPhone);
}

function rowToBooking(row: string[]): Booking {
  return {
    booking_id: row[0] || '',
    client_id: row[1] || '',
    customer_phone: row[2] || '',
    customer_name: row[3] || '',
    date: row[4] || '',
    time_slot: row[5] || '',
    end_time: row[6] || '',
    service: row[7] || '',
    status: (row[8] || 'confirmed') as Booking['status'],
    notes: row[9] || '',
    created_at: row[10] || '',
    reminded: row[11] === 'TRUE',
    owner_notified: row[12] === 'TRUE',
  };
}

// ─── Core: Get Available Slots ───

export async function getAvailableSlots(
  clientId: string,
  date: string,
  serviceType?: string
): Promise<TimeSlot[]> {
  // Step 1: Check if date is fully blocked
  const override = await getDateOverride(clientId, date);
  if (override?.override_type === 'blocked') return [];

  // Step 2: Get day of week
  const dayOfWeek = getDayOfWeek(date);

  // Step 3: Get weekly schedule for this day
  let slots = await getWeeklySchedule(clientId, dayOfWeek);

  // Step 4: If custom override, filter to custom hours
  if (override?.override_type === 'custom') {
    slots = slots.filter(
      (s) => s.start_time >= override.custom_start && s.end_time <= override.custom_end
    );
  }

  // Step 5: Filter by service type if provided
  if (serviceType) {
    slots = slots.filter((s) => s.service_type === serviceType || s.service_type === 'general');
  }

  // Step 6: Remove already booked slots
  const existingBookings = await getBookingsForDate(clientId, date);
  const bookedTimes = existingBookings
    .filter((b) => b.status === 'confirmed')
    .map((b) => b.time_slot);
  slots = slots.filter((s) => !bookedTimes.includes(s.start_time));

  // Step 7: If today, remove past time slots
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

// ─── Core: Create Booking ───

export async function createBooking(params: {
  clientId: string;
  customerPhone: string;
  customerName: string;
  date: string;
  timeSlot: string;
  endTime: string;
  service?: string;
  notes?: string;
}): Promise<Booking> {
  // Double-check slot is still available
  const available = await getAvailableSlots(params.clientId, params.date);
  const slotExists = available.find((s) => s.start_time === params.timeSlot);
  if (!slotExists) {
    throw new Error('SLOT_TAKEN');
  }

  const booking: Booking = {
    booking_id: `BK_${Date.now()}`,
    client_id: params.clientId,
    customer_phone: params.customerPhone,
    customer_name: params.customerName,
    date: params.date,
    time_slot: params.timeSlot,
    end_time: params.endTime,
    service: params.service || '',
    status: 'confirmed',
    notes: params.notes || '',
    created_at: new Date().toISOString(),
    reminded: false,
    owner_notified: false,
  };

  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'bookings!A:M',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        booking.booking_id, booking.client_id, booking.customer_phone,
        booking.customer_name, booking.date, booking.time_slot, booking.end_time,
        booking.service, booking.status, booking.notes, booking.created_at,
        'FALSE', 'FALSE',
      ]],
    },
  });

  return booking;
}

// ─── Cancel Booking ───

export async function cancelBooking(bookingId: string): Promise<boolean> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'bookings!A:A',
  });
  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((row) => row[0] === bookingId);
  if (rowIndex === -1) return false;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `bookings!I${rowIndex + 1}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['cancelled']] },
  });
  return true;
}

// ─── Get upcoming bookings for reminders ───

export async function getBookingsForTomorrow(date: string): Promise<Booking[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'bookings!A2:M',
  });
  const rows = res.data.values || [];
  return rows
    .map(rowToBooking)
    .filter((b) => b.date === date && b.status === 'confirmed');
}

// ─── Initialize booking sheets ───

export async function initializeBookingSheets(): Promise<void> {
  const sheets = getSheets();
  const sheetHeaders: Record<string, string[][]> = {
    'weekly_schedule!A1:G1': [['client_id', 'day_of_week', 'start_time', 'end_time', 'slot_duration_minutes', 'is_active', 'service_type']],
    'date_overrides!A1:F1': [['client_id', 'date', 'override_type', 'custom_start', 'custom_end', 'reason']],
    'bookings!A1:M1': [['booking_id', 'client_id', 'customer_phone', 'customer_name', 'date', 'time_slot', 'end_time', 'service', 'status', 'notes', 'created_at', 'reminded', 'owner_notified']],
  };

  for (const [range, values] of Object.entries(sheetHeaders)) {
    try {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
      if (!res.data.values || res.data.values.length === 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID, range, valueInputOption: 'RAW',
          requestBody: { values },
        });
      }
    } catch {
      // Sheet might not exist
    }
  }
}

// ─── Generate default weekly schedule for a new client ───

export async function generateDefaultSchedule(
  clientId: string,
  workingHours: string,
  slotDuration: number = 30
): Promise<void> {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const slots: WeeklySlot[] = [];

  // Default: Mon-Sat 10:00-13:00 and 14:00-17:00
  for (const day of days) {
    // Morning slots
    for (let hour = 10; hour < 13; hour++) {
      for (let min = 0; min < 60; min += slotDuration) {
        const start = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
        const end = calculateEndTime(start, slotDuration);
        slots.push({
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
        slots.push({
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

  await setWeeklySchedule(clientId, slots);
}
