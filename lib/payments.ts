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

// ─── Pending payment tracker (Neon-backed) ────────────────────────────────
// Real implementation lives in lib/db/payments.ts; re-exported here so the
// existing webhook imports keep working unchanged. Used to be Sheets-backed —
// migrated as part of the Google Sheets removal so Google Cloud credentials
// can be rotated/deleted without breaking the [PAY:] flow.

export { setPendingPayment, getPendingPayment, clearPendingPayment } from './db/payments';
