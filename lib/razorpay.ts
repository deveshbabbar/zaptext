import Razorpay from 'razorpay';
import crypto from 'crypto';

let _razorpay: Razorpay | null = null;

function getRazorpay(): Razorpay {
  if (!_razorpay) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay keys not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env.local');
    }
    _razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return _razorpay;
}

const razorpay = { get instance() { return getRazorpay(); } };

export async function createOrder(
  amount: number,
  currency: string = 'INR',
  receipt: string,
  notes?: Record<string, string>
) {
  // notes are echoed back on Razorpay's payment.captured webhook payload.
  // We use them to recover userId/plan/months when the browser callback
  // never runs (popup closed mid-flow) — see app/api/payment/webhook/route.ts.
  const order = await getRazorpay().orders.create({
    amount: amount * 100, // Razorpay expects paise
    currency,
    receipt,
    ...(notes && Object.keys(notes).length > 0 ? { notes } : {}),
  });
  return order;
}

// Fetch an order back from Razorpay to verify what was *actually* paid.
// The local /api/payment/verify route MUST cross-check the order amount
// and the `notes` payload (plan / months / userId) against the values
// the client sends in the verify body — otherwise a paid Starter user
// can replay the same signature with `plan: "scale", months: 12` and
// get a Scale subscription for the price of Starter.
export interface FetchedOrder {
  id: string;
  amountInPaise: number;
  amountInRupees: number;
  currency: string;
  status: string;
  notes: Record<string, string>;
}

export async function fetchOrder(orderId: string): Promise<FetchedOrder> {
  // The Razorpay SDK's Orders.fetch returns `amount` either as a number
  // or, in some lib versions, a string of paise. Normalise both.
  const raw = (await getRazorpay().orders.fetch(orderId)) as {
    id: string;
    amount: number | string;
    currency: string;
    status: string;
    notes?: Record<string, string | number>;
  };
  const paise = typeof raw.amount === 'string' ? Number.parseInt(raw.amount, 10) : raw.amount;
  const notes: Record<string, string> = {};
  if (raw.notes && typeof raw.notes === 'object') {
    for (const [k, v] of Object.entries(raw.notes)) notes[k] = String(v);
  }
  return {
    id: raw.id,
    amountInPaise: paise,
    amountInRupees: Math.round(paise / 100),
    currency: raw.currency,
    status: raw.status,
    notes,
  };
}

export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const body = orderId + '|' + paymentId;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest('hex');
  const a = Buffer.from(expectedSignature, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export { getRazorpay as razorpay };
