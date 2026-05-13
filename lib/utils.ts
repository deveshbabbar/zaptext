import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
  if (!cleaned.startsWith('91') && cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return '+' + cleaned;
}

// Returns an ISO-8601 UTC timestamp. Name is historical ("IST") but the
// callers ALL pipe this into DB `timestamptz` columns or into `new Date()`
// constructors — both of which need an ISO-parseable string.
//
// We previously returned `toLocaleString('en-IN', ...)` which produced
// `13/05/2026, 12:56:40` (DD/MM/YYYY). JavaScript's Date parser does NOT
// understand that format → `new Date(...)` returned Invalid Date → Drizzle's
// `mapToDriverValue` then threw `RangeError: Invalid time value` on every
// webhook insert, which silently 500'd the bot. Vercel's Node 24 ICU data
// was strict enough to expose this; older Node versions were more lenient.
//
// IST display formatting is handled separately by display-layer helpers —
// see lib/utils:getISTDate / display components — so changing this to ISO
// has no UI effect.
export function getISTTimestamp(): string {
  return new Date().toISOString();
}

export function getISTDate(): string {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Kolkata',
  });
}

export function generateId(): string {
  return crypto.randomUUID();
}
