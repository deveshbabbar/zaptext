// Restaurant QR-code helper.
//
// Format of the WhatsApp URL embedded in each QR:
//   https://wa.me/<bot-phone>?text=Order%20Table%20<N>
//
// What the customer sees when they scan: "Order Table 9". Clean — no
// opaque token leaking into the chat. We previously appended a random
// 12-char token to the text for anti-replay protection, but customers
// found "Order Table 9 ABCD1234EFGH" confusing and asked us to drop it.
//
// Tokens are still GENERATED + stored per row (so the auto-rotate cron
// keeps working as a "regenerate QR" feature when the owner wants), but
// they're no longer required to match the inbound message. The handler
// accepts any "Order Table N" coming in from a customer phone and links
// it to the current active table.
//
// Trade-off: someone could text "Order Table 5" without being physically
// at table 5. Since orders only become real food when the kitchen serves
// them at that table, the practical abuse surface is minimal. Owners who
// want stronger anti-replay can still rotate tokens (the URL changes →
// printed QRs become invalid even though the visible text is the same).

import crypto from 'node:crypto';
import QRCode from 'qrcode';

// Matches "Order Table N" plus zero-or-more optional trailing slots:
//   • outlet slug — written as "@SLUG" (2-12 alphanumeric/underscore)
//     so the webhook can route the customer to the right outlet
//     without asking. Skipped entirely for single-outlet kitchens.
//   • legacy token — 8+ alphanumeric chars (older printed QRs still
//     emit this; ignored at handler level since 2026-04 but parsed
//     so the message doesn't fall through to AI).
//
// Examples that parse:
//   "Order Table 9"                     → single-outlet, no token
//   "Order Table 9 @SAK"                → multi-outlet, no token
//   "Order Table 9 ABCD1234EFGH"        → legacy single-outlet w/ token
//   "Order Table 9 @SAK ABCD1234EFGH"   → multi-outlet w/ token
//   "Order Table 9 ABCD1234EFGH @SAK"   → reversed order also OK
const WHATSAPP_TEXT_PATTERN = /^Order\s+Table\s+([\w-]+)((?:\s+(?:@[A-Za-z0-9_]{2,12}|[A-Za-z0-9_-]{8,}))*)$/i;
const OUTLET_SLUG_PATTERN = /@([A-Za-z0-9_]{2,12})/;
const LEGACY_TOKEN_PATTERN = /\b([A-Za-z0-9_-]{8,})\b/;

export function generateQrToken(): string {
  return crypto.randomBytes(9).toString('base64url').slice(0, 12);
}

function waPhone(raw: string): string {
  return (raw || '').replace(/\D/g, '');
}

export function buildWaTextForTable(
  tableNumber: string,
  _qrToken: string,
  outletSlug?: string
): string {
  // _qrToken is kept in the signature for callers that pass it but is
  // intentionally NOT included in the customer-facing text. The token is
  // still stored DB-side for QR rotation purposes.
  const slugPart = outletSlug && outletSlug.trim()
    ? ` @${outletSlug.trim().toUpperCase()}`
    : '';
  return `Order Table ${tableNumber}${slugPart}`;
}

export function buildWaUrlForTable(input: {
  botPhone: string;
  tableNumber: string;
  qrToken: string;
  /** Optional outlet code (e.g. 'SAK') — embedded in the QR text so
   *  the webhook auto-detects the right outlet on scan without asking
   *  the customer. Omit for single-outlet kitchens. */
  outletSlug?: string;
}): string {
  const phone = waPhone(input.botPhone);
  if (!phone) throw new Error('buildWaUrlForTable: bot phone is empty');
  const text = buildWaTextForTable(input.tableNumber, input.qrToken, input.outletSlug);
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export function parseDineInTrigger(
  message: string
): { tableNumber: string; token: string; outletSlug: string } | null {
  const trimmed = (message || '').trim();
  const m = WHATSAPP_TEXT_PATTERN.exec(trimmed);
  if (!m) return null;
  const trailing = m[2] || '';
  const outletMatch = OUTLET_SLUG_PATTERN.exec(trailing);
  // Strip the outlet match out before token detection so a slug like
  // "ABCDEFGHIJK" (≥8 chars) can't be mistaken for a legacy token.
  const tokenSearchSpace = outletMatch ? trailing.replace(outletMatch[0], ' ') : trailing;
  const tokenMatch = LEGACY_TOKEN_PATTERN.exec(tokenSearchSpace);
  return {
    tableNumber: m[1],
    token: tokenMatch ? tokenMatch[1] : '',
    outletSlug: outletMatch ? outletMatch[1].toUpperCase() : '',
  };
}

export async function generateQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 512,
    color: { dark: '#000000', light: '#ffffff' },
  });
}

export async function generateQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 512,
    color: { dark: '#000000', light: '#ffffff' },
  });
}
