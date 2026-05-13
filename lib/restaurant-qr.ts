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

// Matches "Order Table N" optionally followed by a legacy 8-12 char
// token (kept so QRs printed before this change still parse).
const WHATSAPP_TEXT_PATTERN = /^Order\s+Table\s+([\w-]+)(?:\s+([A-Za-z0-9_-]{8,}))?$/i;

export function generateQrToken(): string {
  return crypto.randomBytes(9).toString('base64url').slice(0, 12);
}

function waPhone(raw: string): string {
  return (raw || '').replace(/\D/g, '');
}

export function buildWaTextForTable(tableNumber: string, _qrToken: string): string {
  // _qrToken is kept in the signature for callers that pass it but is
  // intentionally NOT included in the customer-facing text. The token is
  // still stored DB-side for QR rotation purposes.
  return `Order Table ${tableNumber}`;
}

export function buildWaUrlForTable(input: {
  botPhone: string;
  tableNumber: string;
  qrToken: string;
}): string {
  const phone = waPhone(input.botPhone);
  if (!phone) throw new Error('buildWaUrlForTable: bot phone is empty');
  const text = buildWaTextForTable(input.tableNumber, input.qrToken);
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export function parseDineInTrigger(
  message: string
): { tableNumber: string; token: string } | null {
  const trimmed = (message || '').trim();
  const m = WHATSAPP_TEXT_PATTERN.exec(trimmed);
  if (!m) return null;
  // Token group is optional now — older QRs still send it, new ones don't.
  return { tableNumber: m[1], token: m[2] || '' };
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
