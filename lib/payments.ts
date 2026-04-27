import { GoogleGenerativeAI } from '@google/generative-ai';

// ─── UPI deep-link builder ───

export interface UpiLinkParams {
  upiId: string;
  name: string;
  amount: number;
  note?: string;
}

export function buildUpiLink({ upiId, name, amount, note }: UpiLinkParams): string {
  const params = new URLSearchParams();
  params.set('pa', upiId.trim());
  params.set('pn', name.trim());
  params.set('am', amount.toFixed(2));
  params.set('cu', 'INR');
  if (note) params.set('tn', note.slice(0, 60));
  return `upi://pay?${params.toString()}`;
}

export function isValidUpiId(upi: string): boolean {
  // Format: handle@provider (e.g., name@ybl, 98xxx@upi, business@okaxis)
  return /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/.test(upi.trim());
}

// ─── WhatsApp media download ───

const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0';

export async function downloadWhatsAppMedia(mediaId: string): Promise<{
  base64: string;
  mimeType: string;
} | null> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const metaRes = await fetch(`${WHATSAPP_API_URL}/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metaRes.ok) return null;
    const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
    if (!meta.url) return null;

    const binRes = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!binRes.ok) return null;
    const buf = Buffer.from(await binRes.arrayBuffer());
    return { base64: buf.toString('base64'), mimeType: meta.mime_type || 'image/jpeg' };
  } catch (err) {
    console.error('downloadWhatsAppMedia error:', err);
    return null;
  }
}

// ─── Gemini screenshot verification ───

export interface ScreenshotCheck {
  looksLikePayment: boolean;
  upiIdDetected: string | null;
  amountDetected: number | null;
  txnIdDetected: string | null;
  matchesExpected: boolean;
  reasons: string[];
}

export interface ExpectedPayment {
  upiId: string;
  amount: number;
}

export async function verifyPaymentScreenshot(
  imageBase64: string,
  mimeType: string,
  expected: ExpectedPayment
): Promise<ScreenshotCheck> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      looksLikePayment: false,
      upiIdDetected: null,
      amountDetected: null,
      txnIdDetected: null,
      matchesExpected: false,
      reasons: ['GEMINI_API_KEY not configured'],
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `You are checking a UPI payment screenshot from an Indian user.
Return STRICT JSON only with these keys (no markdown, no prose):
{
  "looksLikePayment": boolean,
  "upiIdDetected": string | null,
  "amountDetected": number | null,
  "txnIdDetected": string | null,
  "reasonsIfFishy": string[]
}

Look for:
- Transaction success indicators (green tick, "Paid", "Success", ₹ amount, UPI ID of receiver)
- Receiver UPI ID (looks like name@bank, e.g. "rohit@ybl")
- Amount paid (in ₹ or rupees)
- Transaction reference (UTR / Txn ID / 12-digit number)
- Fishy signals: obvious photoshop, mismatched fonts, "demo" watermark, PENDING status, timestamp from distant past

Respond with JSON only.`;

    const result = await model.generateContent([
      { inlineData: { data: imageBase64, mimeType } },
      { text: prompt },
    ]);
    const text = result.response.text().trim();

    const json = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
    const parsed = JSON.parse(json) as {
      looksLikePayment: boolean;
      upiIdDetected: string | null;
      amountDetected: number | null;
      txnIdDetected: string | null;
      reasonsIfFishy: string[];
    };

    const reasons = [...(parsed.reasonsIfFishy || [])];
    const normalizedExpectedUpi = expected.upiId.trim().toLowerCase();
    const normalizedDetectedUpi = (parsed.upiIdDetected || '').trim().toLowerCase();
    const upiMatch = normalizedDetectedUpi && normalizedDetectedUpi === normalizedExpectedUpi;
    const amountMatch =
      parsed.amountDetected !== null && Math.abs(parsed.amountDetected - expected.amount) < 0.5;

    if (!upiMatch && parsed.upiIdDetected) {
      reasons.push(`UPI mismatch: detected "${parsed.upiIdDetected}" vs expected "${expected.upiId}"`);
    }
    if (!amountMatch && parsed.amountDetected !== null) {
      reasons.push(`Amount mismatch: detected ₹${parsed.amountDetected} vs expected ₹${expected.amount}`);
    }
    if (!parsed.looksLikePayment) {
      reasons.push('Does not look like a completed payment screenshot');
    }

    return {
      looksLikePayment: parsed.looksLikePayment,
      upiIdDetected: parsed.upiIdDetected,
      amountDetected: parsed.amountDetected,
      txnIdDetected: parsed.txnIdDetected,
      matchesExpected: Boolean(parsed.looksLikePayment && upiMatch && amountMatch),
      reasons,
    };
  } catch (err) {
    console.error('verifyPaymentScreenshot error:', err);
    return {
      looksLikePayment: false,
      upiIdDetected: null,
      amountDetected: null,
      txnIdDetected: null,
      matchesExpected: false,
      reasons: [`Verification failed: ${String(err).slice(0, 200)}`],
    };
  }
}

// ─── Pending payment tracker (Sheets-backed, per client + customer) ───
// Why Sheets and not memory: Vercel/Next.js serverless cold-starts spawn fresh
// lambdas per webhook hit, and the in-memory Map didn't survive across them —
// so a [PAY:] tag set in one invocation was never visible to the screenshot
// handler in the next, and auto-verification silently broke.
//
// Sheet `pending_payments` columns:
//   A=client_id, B=customer_phone, C=amount, D=note, E=expires_at (ISO)

import { google } from 'googleapis';

const PENDING_TTL_MS = 30 * 60 * 1000;
const PENDING_RANGE = 'pending_payments!A2:E';
const PENDING_APPEND = 'pending_payments!A:E';

function getPendingSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

async function fetchPendingRows(): Promise<Array<{ rowIndex: number; client_id: string; phone: string; amount: number; note: string; expires_at: string }>> {
  try {
    const sheets = getPendingSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID!,
      range: PENDING_RANGE,
    });
    const rows = res.data.values || [];
    return rows.map((row, i) => ({
      rowIndex: i + 2,
      client_id: row[0] || '',
      phone: normalizePhone(row[1] || ''),
      amount: parseFloat(row[2] || '0') || 0,
      note: row[3] || '',
      expires_at: row[4] || '',
    }));
  } catch {
    // Sheet may not exist yet — caller treats as "no pending payment".
    return [];
  }
}

export async function setPendingPayment(clientId: string, customerPhone: string, amount: number, note: string): Promise<void> {
  const phone = normalizePhone(customerPhone);
  const expiresAt = new Date(Date.now() + PENDING_TTL_MS).toISOString();
  const sheets = getPendingSheets();

  // Replace any existing row for this (client, phone) pair so we don't accumulate
  // stale entries when a customer asks about price multiple times.
  const all = await fetchPendingRows();
  const existing = all.find((r) => r.client_id === clientId && r.phone === phone);
  if (existing) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SPREADSHEET_ID!,
      range: `pending_payments!A${existing.rowIndex}:E${existing.rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[clientId, phone, amount.toString(), note, expiresAt]] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID!,
      range: PENDING_APPEND,
      valueInputOption: 'RAW',
      requestBody: { values: [[clientId, phone, amount.toString(), note, expiresAt]] },
    });
  }
}

export async function getPendingPayment(clientId: string, customerPhone: string): Promise<{ amount: number; note: string } | null> {
  const phone = normalizePhone(customerPhone);
  const all = await fetchPendingRows();
  const entry = all.find((r) => r.client_id === clientId && r.phone === phone);
  if (!entry) return null;
  const expiresMs = entry.expires_at ? new Date(entry.expires_at).getTime() : 0;
  if (!expiresMs || expiresMs < Date.now()) {
    // Best-effort cleanup of expired row; safe to ignore failure.
    await clearPendingPayment(clientId, customerPhone).catch(() => {});
    return null;
  }
  return { amount: entry.amount, note: entry.note };
}

export async function clearPendingPayment(clientId: string, customerPhone: string): Promise<void> {
  const phone = normalizePhone(customerPhone);
  const all = await fetchPendingRows();
  const entry = all.find((r) => r.client_id === clientId && r.phone === phone);
  if (!entry) return;

  // Blank the row in place — avoids the row-shift hazard of deleteDimension
  // when other concurrent writes are in flight.
  const sheets = getPendingSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.SPREADSHEET_ID!,
    range: `pending_payments!A${entry.rowIndex}:E${entry.rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['', '', '', '', '']] },
  });
}
