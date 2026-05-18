// ─── Wati/AiSensy contact migration endpoint ───
//
// POST /api/client/migrate-contacts
// body: { csv: string, source?: 'wati'|'aisensy'|'generic'|'auto', clientId: string }
//
// Lets a bot owner who is switching from Wati/AiSensy bring their
// contact list along. We don't have a dedicated `contacts` table — by
// design, the codebase treats customers as appearing implicitly via
// `conversations`. So we mirror imported contacts as stub inbound rows
// (one per phone) under the active bot. The owner sees them in the
// /client/conversations list immediately and can tag/filter from there.
//
// We do NOT auto-message imported contacts. Meta's policy still
// requires opt-in before any business-initiated message — that opt-in
// is the owner's responsibility to demonstrate, not ours to assume.
// The stub message is purely a record-keeping marker.

import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { getBotsByOwner } from '@/lib/owner-clients';
import { addConversationMessage } from '@/lib/db/conversations';
import { getISTTimestamp, redactPhone } from '@/lib/utils';
import { parseContactsCSV, CsvSource } from '@/lib/migrate-csv';
import { rateLimit, getClientKey } from '@/lib/rate-limit';

const MAX_CSV_BYTES = 5 * 1024 * 1024; // 5 MB — Wati/AiSensy exports rarely exceed 1 MB
const MAX_CONTACTS_PER_IMPORT = 25_000; // hard cap so a malicious upload can't exhaust the DB

export async function POST(request: NextRequest) {
  const rl = rateLimit(getClientKey(request, '/api/client/migrate-contacts'), 3, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many migration attempts. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': Math.ceil(rl.resetInMs / 1000).toString() } }
    );
  }

  const user = await getUserRole();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { csv?: string; source?: CsvSource; clientId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { csv, source = 'auto', clientId } = body;
  if (!csv || typeof csv !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid `csv` field' }, { status: 400 });
  }
  if (csv.length > MAX_CSV_BYTES) {
    return NextResponse.json(
      { error: `CSV too large (max ${MAX_CSV_BYTES} bytes)` },
      { status: 413 }
    );
  }
  if (!clientId || typeof clientId !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid `clientId`' }, { status: 400 });
  }

  // Verify the user owns this bot before importing into it.
  const ownedBots = await getBotsByOwner(user.userId);
  const targetBot = ownedBots.find((b) => b.client_id === clientId);
  if (!targetBot && user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — bot does not belong to you' }, { status: 403 });
  }

  const parsed = parseContactsCSV(csv, source);
  if (parsed.contacts.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        accepted: 0,
        skipped: parsed.rowsSkipped,
        detectedSource: parsed.detectedSource,
        warnings: parsed.warnings,
        message: 'No valid contacts to import. Check the CSV headers and phone format.',
      },
      { status: 400 }
    );
  }

  // Hard cap to avoid exhausting the DB on a malicious or accidental
  // upload. We import a prefix and report the truncation to the user.
  const toImport = parsed.contacts.slice(0, MAX_CONTACTS_PER_IMPORT);
  const truncated = parsed.contacts.length > toImport.length;

  const ts = getISTTimestamp();
  let written = 0;
  // Sequential `for...await` (the old behaviour) is ~1 round-trip per
  // insert. Against Neon HTTP that's ~20-40 ms each, so 25 000
  // contacts ran 8-16 minutes — well past Vercel's 30 s timeout.
  // Resolution: chunk into batches of 25 in parallel. Throughput
  // jumps ~25×; Neon's HTTP driver handles it without saturation
  // (it pools at the edge). Per-row errors stay isolated via the
  // inner try/catch.
  const CHUNK = 25;
  for (let i = 0; i < toImport.length; i += CHUNK) {
    const slice = toImport.slice(i, i + CHUNK);
    const results = await Promise.all(
      slice.map(async (c) => {
        const tagSuffix = c.tags.length > 0 ? ` · tags: ${c.tags.join(', ')}` : '';
        const nameBit = c.name ? ` · ${c.name}` : '';
        try {
          await addConversationMessage({
            timestamp: ts,
            client_id: clientId,
            customer_phone: c.phone,
            direction: 'incoming',
            message: `[migrated from ${c.source}]${nameBit}${tagSuffix}`,
            message_type: 'system',
          });
          return true;
        } catch (e) {
          // Don't fail the whole import if one row collides with an
          // existing conversation — log redacted phone and continue.
          // DPDPA: raw phones leak to Vercel logs / log shippers.
          console.error('[migrate-contacts] insert failed for', redactPhone(c.phone), e);
          return false;
        }
      })
    );
    written += results.filter(Boolean).length;
  }

  return NextResponse.json({
    ok: true,
    accepted: written,
    skipped: parsed.rowsSkipped + (parsed.contacts.length - toImport.length),
    detectedSource: parsed.detectedSource,
    warnings: parsed.warnings,
    truncated,
    truncatedAt: truncated ? MAX_CONTACTS_PER_IMPORT : undefined,
    note: 'Imported contacts are recorded but NOT messaged. Meta opt-in policy still applies — only message contacts who consented.',
  });
}
