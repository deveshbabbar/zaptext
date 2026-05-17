// Restaurant dine-in webhook intercept.
//
// Called BEFORE the generic AI bot flow on incoming messages. Returns
// handled=true with a reply string when it has fully handled the message
// (token validation, session open, menu link sent, manager commands).
// Returns handled=false when nothing dine-in matched and the webhook
// should fall through to the normal AI flow.
//
// Every customer-facing string emits both an English and a Hinglish line
// so QR-scanning customers (who haven't messaged before) get a comprehensible
// greeting either way — bilingual by design.

import {
  parseDineInTrigger,
} from '@/lib/restaurant-qr';
import {
  getTable,
  openOrJoinSession,
  getOpenSessionForPhone,
  closeSession,
  touchSession,
  closeStaleSessions,
} from '@/lib/db/restaurant-dine-in';
import { canUse } from '@/lib/feature-gates';
import { getActiveSubscription } from '@/lib/db/subscriptions';
import { getClientById } from '@/lib/db/clients';

// Resolves whether the OWNER of this client has the dine_in feature.
// Dine-in is a Growth+ feature (₹1,499/mo). On Trial / Starter we
// surface a friendly upgrade prompt instead of opening a session.
export async function isDineInEnabledForClient(clientId: string): Promise<boolean> {
  try {
    const client = await getClientById(clientId);
    if (!client?.owner_user_id) return false;
    const sub = await getActiveSubscription(client.owner_user_id);
    return canUse(sub?.plan, 'dine_in').allowed;
  } catch (err) {
    console.error('[dine-in] feature gate lookup failed', err);
    return false;
  }
}

export interface DineInIncoming {
  client_id: string;
  client_type: string;
  business_name: string;
  customer_phone: string;
  message: string;
  /** Optional knowledge-base hint. If `['English']`, replies skip the
   *  Hinglish half. Defaults to bilingual when undefined / multi. */
  languages?: string[];
  /** Storefront slug (e.g. "tandoortadka"). When present, the menu link
   *  uses the branded subdomain (`tandoortadka.zaptext.shop/<table>/<session>`)
   *  instead of the opaque clientId path. Empty/undefined → falls back
   *  to the legacy `zaptext.shop/m/<clientId>/<table>/<session>`. */
  slug?: string;
}

// All dine-in helper replies below are authored as bilingual blocks
// (English block, blank line, Hinglish block) for source convenience.
// At send time we collapse to ONE language. ENGLISH IS THE DEFAULT.
// Hinglish only when the bot is explicitly Hindi-flavour AND has no
// English in its languages list — matches the same logic used for
// order confirmations in /api/menu/submit.
//
// Bot language config decision table:
//   - languages = []                  → English (strip Hinglish half)
//   - languages = ['English']         → English
//   - languages = ['English','Hindi'] → English
//   - languages = ['Hindi']           → Hinglish (strip English half)
//   - languages = ['Hinglish']        → Hinglish
//   - languages = ['Tamil']           → English (no Hindi flavour)
//   - undefined                       → English
function pickLanguageHalf(reply: string, languages?: string[]): string {
  const langs = (languages || []).map((l) => l.trim().toLowerCase());
  const hasEnglish = langs.includes('english');
  const hasHindiFlavour = langs.includes('hindi') || langs.includes('hinglish');
  const useEnglish = hasEnglish || !hasHindiFlavour;

  const idx = reply.indexOf('\n\n');
  if (idx === -1) return reply;
  // English block is BEFORE the blank line; Hinglish block AFTER.
  return useEnglish ? reply.slice(0, idx) : reply.slice(idx + 2);
}

// Legacy alias — internal call sites use maybeStripHinglish; renaming
// every call site has no benefit, but the underlying behaviour is now
// English-default rather than bilingual-default.
const maybeStripHinglish = pickLanguageHalf;

export interface DineInResult {
  handled: boolean;
  reply?: string;
  suppressAi?: boolean;
  sessionId?: string;
}

function tablePublicMenuUrl(
  clientId: string,
  tableNumber: string,
  sessionId: string,
  slug?: string,
): string {
  // NEXT_PUBLIC_APP_URL is baked at build time. If the build was made
  // before the env var was set on Vercel, it'll be undefined here and
  // we'd emit a RELATIVE path like "/m/abc/1/xyz" — WhatsApp doesn't
  // auto-link relative paths, so the menu link arrives as un-tappable
  // text and the customer can't open the menu. Hard fallback to the
  // production origin matches the pattern in app/api/webhook/route.ts.
  const base = (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://zaptext.shop').toLowerCase();
  // When the owner has set a storefront slug, prefer the branded
  // subdomain (`tandoortadka.zaptext.shop/<table>/<session>`) over the
  // legacy clientId path — much friendlier link preview on WhatsApp.
  // The storefront middleware rewrites <slug>.<root>/* to /m/<slug>/*,
  // so the path stays consistent.
  const trimmedSlug = (slug || '').trim().toLowerCase();
  if (trimmedSlug) {
    // Extract the root domain ("zaptext.shop") from NEXT_PUBLIC_APP_URL
    // so localhost / preview-deploy URLs don't accidentally get a slug
    // prepended (slugs only resolve via DNS to the production root).
    const m = base.match(/^https?:\/\/(?:www\.)?(.+)$/);
    const host = m ? m[1] : 'zaptext.shop';
    // Only use the slug subdomain on the production root domain.
    if (host === 'zaptext.shop' || host.endsWith('.zaptext.shop')) {
      return `https://${trimmedSlug}.zaptext.shop/${encodeURIComponent(tableNumber)}/${sessionId}`;
    }
  }
  return `${base}/m/${clientId}/${encodeURIComponent(tableNumber)}/${sessionId}`;
}

function welcomeReply(businessName: string, tableNumber: string, menuUrl: string): string {
  return [
    `Welcome to ${businessName}! 🙏`,
    `You're ordering for Table ${tableNumber}. Tap the link below to view the menu, add items, and place your order.`,
    `Menu: ${menuUrl}`,
    `Tip: you can also just type what you want and we'll add it to your table.`,
    ``,
    `${businessName} mein swagat hai! 🙏`,
    `Aap Table ${tableNumber} ke liye order kar rahe hain. Neeche link kholiye, menu se items chuniye, aur order place kariye.`,
    `Menu: ${menuUrl}`,
    `Tip: aap seedha type bhi kar sakte hain — jo bhi chahiye, hum table ke order mein add kar denge.`,
  ].join('\n');
}

function invalidTokenReply(): string {
  return [
    `This QR code looks expired. Please scan the latest QR at your table, or ask the staff to refresh it.`,
    ``,
    `Yeh QR purana lag raha hai. Apne table ka latest QR scan kariye, ya staff se naya QR maangiye.`,
  ].join('\n');
}

function planLockedReply(businessName: string): string {
  return [
    `${businessName}: dine-in table ordering isn't enabled on this bot yet. Please ask staff to take your order at the counter.`,
    ``,
    `${businessName}: yahan ka dine-in QR ordering abhi enable nahi hai. Counter par staff se order kar lijiye.`,
  ].join('\n');
}

function unknownTableReply(tableNumber: string): string {
  return [
    `We couldn't find Table ${tableNumber} for this restaurant. Please ask the staff to check the QR.`,
    ``,
    `Table ${tableNumber} hamare paas registered nahi hai. Staff se QR check karwa lijiye.`,
  ].join('\n');
}

function sessionClosedAck(tableNumber: string): string {
  return [
    `Got it. Your Table ${tableNumber} order is closed. For home delivery, just message us with what you'd like.`,
    ``,
    `Done. Table ${tableNumber} ka order band ho gaya. Home delivery ke liye, jo chahiye woh seedha message kar dijiye.`,
  ].join('\n');
}

function confirmHomeVsTableReply(tableNumber: string): string {
  return [
    `Quick check — you're currently at Table ${tableNumber}. What would you like?`,
    `  1) Add this to my table order (just type the items)`,
    `  2) CLOSE TABLE — finish here, then I'll take a home delivery order`,
    `  3) PARCEL — pack this for takeaway from the table`,
    ``,
    `Ek baat confirm — aap abhi Table ${tableNumber} par hain. Kya karna hai?`,
    `  1) Yeh items isi table ke order mein add karein (bas items type kariye)`,
    `  2) CLOSE TABLE — yahaan finish karein, phir ghar ka order shuru karein`,
    `  3) PARCEL — yeh table par hi pack karein le jaane ke liye`,
  ].join('\n');
}

const HOME_DELIVERY_HINT = /\b(home\s*delivery|deliver(y)?|ghar\s*(pe|par|pr|me|mein)|home\s*pe|home\s*par|deliver\s*karo|deliver\s*kr|bhej\s*do|bhejdo|send\s*to\s*home|parcel\s*home|delivery\s*chahiye)\b/i;
const PARCEL_HINT = /\b(parcel|takeaway|take\s*away|pack\s*karo|pack\s*kr|packed|le\s*jaana|le\s*jana)\b/i;
const CLOSE_HINT = /^\s*(close\s*table|table\s*close|finish\s*table|end\s*table|band\s*karo\s*table|bill\s*do|bill\s*please|pay\s*and\s*close)\s*$/i;

export async function handleDineInIncoming(input: DineInIncoming): Promise<DineInResult> {
  if (input.client_type !== 'restaurant') return { handled: false };

  // Opportunistic stale-session sweep so demos don't depend on the cron tick.
  await closeStaleSessions().catch((err) => {
    console.error('[dine-in] closeStaleSessions failed', err);
  });

  // 1. Did the customer just scan a QR? "Order Table 9 ABCD1234EFGH"
  const trigger = parseDineInTrigger(input.message);
  if (trigger) {
    // Plan gate: dine-in is Growth+. If the owner is on Trial / Starter,
    // tell the customer to ask staff instead — no session opens.
    const enabled = await isDineInEnabledForClient(input.client_id);
    if (!enabled) {
      return { handled: true, reply: maybeStripHinglish(planLockedReply(input.business_name), input.languages), suppressAi: true };
    }
    const table = await getTable(input.client_id, trigger.tableNumber).catch((err) => {
      console.error('[dine-in] getTable failed', { clientId: input.client_id, tableNumber: trigger.tableNumber, err });
      return null;
    });
    if (!table || !table.is_active) {
      return { handled: true, reply: maybeStripHinglish(unknownTableReply(trigger.tableNumber), input.languages), suppressAi: true };
    }
    // Token mismatch only blocks if the message INCLUDES a token (legacy
    // QR format). New QRs ship without a visible token — the message is
    // just "Order Table N" — so trigger.token is empty and we accept by
    // table number alone. See lib/restaurant-qr.ts header for the
    // trade-off rationale.
    if (trigger.token && table.qr_token !== trigger.token) {
      return { handled: true, reply: maybeStripHinglish(invalidTokenReply(), input.languages), suppressAi: true };
    }
    // Multi-outlet outlet-binding cross-check. When the QR text
    // carries "@SLUG", validate it matches the table's stored
    // outlet_id (resolved via the slug → id lookup in lib/db/outlets).
    // Mismatch = the printed QR is stale (the owner re-assigned this
    // table to a different outlet after print) — refuse and tell the
    // customer to ask staff for a fresh QR. Single-outlet kitchens
    // emit no slug, so this entire block is a no-op for them.
    if (trigger.outletSlug) {
      try {
        const { getOutletById } = await import('@/lib/db/outlets');
        const claimedOutlet = await getOutletById(input.client_id, trigger.outletSlug);
        // If the slug doesn't resolve OR the resolved outlet's id
        // doesn't match the table's bound outlet, reject — the QR is
        // for a different outlet's table.
        if (!claimedOutlet || claimedOutlet.id !== table.outlet_id) {
          return {
            handled: true,
            reply: maybeStripHinglish(unknownTableReply(trigger.tableNumber), input.languages),
            suppressAi: true,
          };
        }
      } catch (err) {
        // Lookup error → fail open (accept the scan). The session
        // still opens against the table's stored outlet_id, which is
        // authoritative.
        console.error('[dine-in] outlet cross-check failed (failing open)', err);
      }
    }
    const session = await openOrJoinSession({
      client_id: input.client_id,
      table_number: table.table_number,
      customer_phone: input.customer_phone,
    });
    const menuUrl = tablePublicMenuUrl(input.client_id, table.table_number, session.id, input.slug);
    return {
      handled: true,
      reply: maybeStripHinglish(welcomeReply(input.business_name, table.table_number, menuUrl), input.languages),
      suppressAi: true,
      sessionId: session.id,
    };
  }

  // 2. Customer already has an open session. Detect commands + intent.
  const session = await getOpenSessionForPhone(input.client_id, input.customer_phone).catch(() => null);
  if (!session) {
    return { handled: false };
  }

  if (CLOSE_HINT.test(input.message)) {
    await closeSession(session.id, 'manager');
    return {
      handled: true,
      reply: maybeStripHinglish(sessionClosedAck(session.table_number), input.languages),
      suppressAi: true,
      sessionId: session.id,
    };
  }

  if (HOME_DELIVERY_HINT.test(input.message) && !PARCEL_HINT.test(input.message)) {
    await touchSession(session.id);
    return {
      handled: true,
      reply: maybeStripHinglish(confirmHomeVsTableReply(session.table_number), input.languages),
      suppressAi: true,
      sessionId: session.id,
    };
  }

  await touchSession(session.id);
  return { handled: false, sessionId: session.id };
}

export async function describeActiveSession(
  clientId: string,
  customerPhone: string
): Promise<{ tableNumber: string; sessionId: string } | null> {
  const session = await getOpenSessionForPhone(clientId, customerPhone).catch(() => null);
  if (!session) return null;
  return { tableNumber: session.table_number, sessionId: session.id };
}
