// POST /api/webhook/clerk
//
// Clerk webhook receiver. Today we listen for `user.created` and
// `session.created` events to flip team_members rows from 'invited'
// to 'active' the first time an invited outlet manager actually
// logs in (Phase 3M).
//
// CONFIGURING IN CLERK DASHBOARD:
//   1. Dashboard → Webhooks → Add Endpoint
//   2. URL: https://zaptext.shop/api/webhook/clerk
//   3. Events: user.created, session.created
//   4. Copy the Signing Secret (starts with "whsec_") → set
//      CLERK_WEBHOOK_SECRET env var on Vercel.
//
// SIGNATURE VERIFICATION:
// Clerk webhooks use the svix signing convention. The headers are
//   svix-id: msg_xxx
//   svix-timestamp: unix-seconds
//   svix-signature: v1,<base64-hmac> v1,<base64-hmac> ...
// HMAC payload is "{id}.{timestamp}.{body}" using the base64-
// decoded secret. We do the verification inline with Web Crypto
// so this route stays dep-free (no svix package).
//
// The webhook path is already public via middleware.ts
// (`/api/webhook(.*)`), so no auth gate fires before us. We MUST
// verify the signature ourselves before trusting anything in the
// body.

import { NextRequest, NextResponse } from 'next/server';
import { findActiveMembershipForEmail, markMemberAccepted } from '@/lib/db/team-members';

const TOLERANCE_SECONDS = 5 * 60; // accept timestamps within ±5 minutes

async function verifySvixSignature(input: {
  rawBody: string;
  svixId: string;
  svixTimestamp: string;
  svixSignature: string;
  secret: string;
}): Promise<boolean> {
  // secret format: "whsec_<base64>"
  const base64 = input.secret.startsWith('whsec_') ? input.secret.slice(6) : input.secret;
  let keyBytes: ArrayBuffer;
  try {
    const decoded = atob(base64);
    const buf = new ArrayBuffer(decoded.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < decoded.length; i++) view[i] = decoded.charCodeAt(i);
    keyBytes = buf;
  } catch {
    return false;
  }

  // Timestamp must be within tolerance to prevent replay.
  const tsSec = parseInt(input.svixTimestamp, 10);
  if (!Number.isFinite(tsSec)) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - tsSec) > TOLERANCE_SECONDS) return false;

  const toSign = `${input.svixId}.${input.svixTimestamp}.${input.rawBody}`;
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(toSign));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));

  // svix-signature header is space-separated; each token is "v1,<base64sig>".
  // We accept the request if ANY token matches our expected — supports key
  // rotation (Clerk emits multiple v1 sigs during a rotation window).
  //
  // Compare in constant time. Plain `sig === expected` short-circuits at
  // the first differing byte, leaking a timing oracle that lets an
  // attacker brute-force the HMAC byte-by-byte over many calibrated
  // requests. The other webhook verifiers in this codebase
  // (Razorpay / Meta WhatsApp) already use timing-safe compares.
  const tokens = input.svixSignature.split(/\s+/);
  for (const tok of tokens) {
    const [scheme, sig] = tok.split(',');
    if (scheme !== 'v1' || !sig) continue;
    if (constantTimeEquals(sig, expected)) return true;
  }
  return false;
}

// Length-checked XOR-fold compare. Pure JS so it works on both edge
// and node runtimes (this route uses Web Crypto, not node:crypto).
// Constant-time over equal-length inputs; an early length mismatch
// only leaks the expected length, which is fixed per algorithm
// (HMAC-SHA-256 → 32 bytes → 44-char base64) and therefore not a
// secret.
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

interface ClerkEmailAddress { email_address?: string; verification?: { status?: string } }
interface ClerkEventData {
  email_addresses?: ClerkEmailAddress[];
  primary_email_address_id?: string;
  user_id?: string;
}
interface ClerkEvent {
  type: string;
  data?: ClerkEventData & {
    // session.created shape — has a user_id; we look up via Clerk API
    // OR via the included user object (sometimes Clerk inlines it).
    user?: ClerkEventData;
  };
}

function collectEmailsFromEvent(evt: ClerkEvent): string[] {
  const out = new Set<string>();
  const sources: ClerkEmailAddress[] = [];
  if (Array.isArray(evt.data?.email_addresses)) sources.push(...(evt.data!.email_addresses!));
  if (Array.isArray(evt.data?.user?.email_addresses)) sources.push(...(evt.data!.user!.email_addresses!));
  for (const e of sources) {
    const addr = (e.email_address || '').trim().toLowerCase();
    if (addr) out.add(addr);
  }
  return [...out];
}

export async function POST(request: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[clerk-webhook] CLERK_WEBHOOK_SECRET not set — refusing to accept');
    return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 503 });
  }

  const svixId = request.headers.get('svix-id') || '';
  const svixTimestamp = request.headers.get('svix-timestamp') || '';
  const svixSignature = request.headers.get('svix-signature') || '';
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ ok: false, error: 'missing_signature_headers' }, { status: 400 });
  }

  const rawBody = await request.text();
  const ok = await verifySvixSignature({
    rawBody, svixId, svixTimestamp, svixSignature, secret,
  });
  if (!ok) {
    return NextResponse.json({ ok: false, error: 'signature_invalid' }, { status: 401 });
  }

  let evt: ClerkEvent;
  try {
    evt = JSON.parse(rawBody) as ClerkEvent;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  // We only care about events that carry user emails. user.created
  // fires on first signup; session.created fires every login (helps
  // catch managers who were invited but signed in via Clerk's own
  // forgot-password flow, where user.created had fired pre-invite).
  // Anything else is fine to silently 200 — Clerk webhooks expect 2xx
  // to mark delivered.
  if (evt.type !== 'user.created' && evt.type !== 'session.created') {
    return NextResponse.json({ ok: true, ignored: evt.type });
  }

  const emails = collectEmailsFromEvent(evt);
  let flipped = 0;
  for (const email of emails) {
    try {
      const memberships = await findActiveMembershipForEmail(email);
      for (const m of memberships) {
        if (m.status === 'invited') {
          await markMemberAccepted(m.id);
          flipped += 1;
        }
      }
    } catch (err) {
      // Fail open on per-email errors — a bad row shouldn't block the
      // rest of the batch. Surface to logs for SRE.
      console.error('[clerk-webhook] membership flip failed', { email, err });
    }
  }

  return NextResponse.json({ ok: true, flipped, emails: emails.length });
}
