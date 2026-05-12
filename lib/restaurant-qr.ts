// Restaurant QR-code helper.
//
// Format of the WhatsApp URL embedded in each QR:
//   https://wa.me/<bot-phone>?text=Order%20Table%20<N>%20<TOKEN>
//
// Token = 12-char base64url, opaque, rotates per shift via a cron sweep.
// "Order Table 9 ABCD1234EFGH" is what the customer's WhatsApp client
// pre-fills. The webhook regex picks the table + token out.

import crypto from 'node:crypto';
import QRCode from 'qrcode';

const WHATSAPP_TEXT_PATTERN = /^Order\s+Table\s+([\w-]+)\s+([A-Za-z0-9_-]{8,})$/i;

export function generateQrToken(): string {
  return crypto.randomBytes(9).toString('base64url').slice(0, 12);
}

function waPhone(raw: string): string {
  return (raw || '').replace(/\D/g, '');
}

export function buildWaTextForTable(tableNumber: string, qrToken: string): string {
  return `Order Table ${tableNumber} ${qrToken}`;
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
  return { tableNumber: m[1], token: m[2] };
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
