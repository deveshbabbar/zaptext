// ─── CSV migration parser ───
//
// Used by /api/client/migrate-contacts to ingest contact lists exported
// from Wati or AiSensy (or generic CSV) when a bot owner switches to
// ZapText. Pure functions — no I/O, no state. Returns a normalised
// contact list the caller can persist however it wants.
//
// Why we don't use a CSV npm dep: we don't need full RFC 4180. WhatsApp
// BSP exports are simple — one row per contact, no embedded newlines.
// The lightweight quote-aware splitter below handles real-world Wati /
// AiSensy CSVs and saves us a runtime dependency.
//
// Format detection heuristics:
//   - "Phone Number" + "Name" + "Tags|Attribute" header → Wati
//   - "phone_number" + "traits|segment"                  → AiSensy
//   - "phone" or "mobile"                                → Generic
// Falls back to first-column-is-phone heuristic if headers are absent.

export type CsvSource = 'wati' | 'aisensy' | 'generic' | 'auto';

export interface ParsedContact {
  phone: string;            // E.164 digits, no '+' (e.g. '919876543210')
  name: string;
  tags: string[];           // freeform tags from source CSV (Wati: tags col, AiSensy: traits)
  source: 'wati' | 'aisensy' | 'generic';
}

export interface ParseResult {
  contacts: ParsedContact[];
  detectedSource: 'wati' | 'aisensy' | 'generic';
  warnings: string[];
  rowsRead: number;
  rowsAccepted: number;
  rowsSkipped: number;
}

// ─── public ─────────────────────────────────────────────────────────────

export function parseContactsCSV(csv: string, source: CsvSource = 'auto'): ParseResult {
  const lines = splitLines(csv);
  if (lines.length < 2) {
    return {
      contacts: [],
      detectedSource: 'generic',
      warnings: ['CSV is empty or only contains a header'],
      rowsRead: lines.length,
      rowsAccepted: 0,
      rowsSkipped: lines.length,
    };
  }
  const header = parseRow(lines[0]).map((h) => h.trim());
  const lower = header.map((h) => h.toLowerCase());

  const detected: ParsedContact['source'] =
    source !== 'auto' && source !== 'generic'
      ? source
      : detectSource(lower);

  // Locate columns of interest. We accept several common variants per
  // BSP — Wati exports have shifted between "Phone Number" and "Phone
  // number" over the years, AiSensy uses lowercase "phone_number".
  const phoneIdx = findIdx(lower, [
    'phone number',
    'phone',
    'phone_number',
    'mobile',
    'whatsapp',
    'whatsapp number',
    'contact',
  ]);
  const nameIdx = findIdx(lower, ['name', 'full name', 'customer name', 'contact name']);
  const tagsIdx = findIdx(lower, ['tags', 'tag', 'traits', 'attributes', 'segment']);

  if (phoneIdx === -1) {
    return {
      contacts: [],
      detectedSource: detected,
      warnings: [
        `Could not find a phone column. Looked for: phone, phone number, mobile, whatsapp, contact. Got headers: ${header.join(', ')}`,
      ],
      rowsRead: lines.length - 1,
      rowsAccepted: 0,
      rowsSkipped: lines.length - 1,
    };
  }

  const seen = new Set<string>();
  const contacts: ParsedContact[] = [];
  const warnings: string[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const row = parseRow(raw);
    const rawPhone = (row[phoneIdx] || '').trim();
    const phone = normalizePhone(rawPhone);
    if (!phone) {
      skipped++;
      continue;
    }
    if (seen.has(phone)) {
      skipped++;
      continue;
    }
    seen.add(phone);
    const name = nameIdx >= 0 ? (row[nameIdx] || '').trim() : '';
    const rawTags = tagsIdx >= 0 ? (row[tagsIdx] || '').trim() : '';
    const tags = rawTags
      ? rawTags
          .split(/[;,|]/)
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 10)
      : [];
    contacts.push({ phone, name: name.slice(0, 200), tags, source: detected });
  }

  if (warnings.length === 0 && contacts.length === 0) {
    warnings.push('No valid contacts found — every row had an unparseable or duplicate phone.');
  }

  return {
    contacts,
    detectedSource: detected,
    warnings,
    rowsRead: lines.length - 1,
    rowsAccepted: contacts.length,
    rowsSkipped: skipped,
  };
}

// ─── helpers ────────────────────────────────────────────────────────────

function detectSource(lowerHeaders: string[]): ParsedContact['source'] {
  const has = (s: string) => lowerHeaders.some((h) => h === s || h.includes(s));
  if (has('phone number') && has('name') && (has('tags') || has('attribute'))) return 'wati';
  if (has('phone_number') && (has('traits') || has('segment'))) return 'aisensy';
  return 'generic';
}

function findIdx(lower: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = lower.indexOf(c);
    if (idx !== -1) return idx;
  }
  // Loose match — any header that contains the candidate token.
  for (const c of candidates) {
    const idx = lower.findIndex((h) => h.includes(c));
    if (idx !== -1) return idx;
  }
  return -1;
}

export function normalizePhone(input: string): string {
  if (!input) return '';
  // Strip everything except digits.
  let digits = input.replace(/\D/g, '');
  if (!digits) return '';
  // Indian short-form (10 digits, no country code) → assume India.
  if (digits.length === 10) digits = '91' + digits;
  // Already country-coded → keep first 15 digits (E.164 max).
  if (digits.length < 11 || digits.length > 15) return '';
  return digits;
}

// Split into logical lines, ignoring CRLF differences. Doesn't handle
// CSVs with literal newlines inside quoted fields — we accept this
// limitation because Wati/AiSensy exports never include them in
// practice.
function splitLines(s: string): string[] {
  return s.replace(/\r\n?/g, '\n').split('\n');
}

// Quote-aware row splitter. Handles escaped quotes ("") inside quoted
// fields. Sufficient for Wati/AiSensy outputs.
function parseRow(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === ',') {
        out.push(cur);
        cur = '';
      } else if (ch === '"' && cur === '') {
        inQuotes = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}
