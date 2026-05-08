// lib/grocery/date-utils.ts
//
// IST date helpers. Postgres stores dates as text (YYYY-MM-DD) for the
// catalog tables; we always interpret them in IST (Asia/Kolkata) since
// every client is in India. Don't use new Date() / .toISOString() for
// these — those are UTC and will roll over a day too early.

export function todayIsoIST(now: Date = new Date()): string {
  return formatIstDate(now);
}

export function yesterdayIsoIST(now: Date = new Date()): string {
  const ms = now.getTime() - 24 * 60 * 60 * 1000;
  return formatIstDate(new Date(ms));
}

export function formatIstDate(d: Date): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(d); // en-CA → YYYY-MM-DD
}

export function dayOfWeekIST(now: Date = new Date()): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
  });
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[fmt.format(now)] ?? 0;
}

export function nowHHMMIST(now: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return fmt.format(now);
}
