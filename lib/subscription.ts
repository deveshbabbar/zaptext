import { google } from 'googleapis';
import { getISTTimestamp } from './utils';
import { PLANS, type PlanKey } from './plans';

// Re-export plan definitions for backward compatibility
export { PLANS, type PlanKey };

export interface SubscriptionRecord {
  userId: string;
  plan: PlanKey;
  status: 'active' | 'expired' | 'cancelled';
  razorpayPaymentId: string;
  razorpayOrderId: string;
  amount: number;
  startDate: string;
  endDate: string;
  createdAt: string;
}

// ─── Google Sheets Helpers ───

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function getSheets() {
  return google.sheets({ version: 'v4', auth: getAuth() });
}

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

// ─── Subscription Functions ───

export async function getActiveSubscription(
  userId: string
): Promise<SubscriptionRecord | null> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'subscriptions!A2:I',
  });
  const rows = res.data.values || [];
  const now = new Date();

  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (row[0] === userId && row[2] === 'active') {
      const endDate = new Date(row[7]);
      if (endDate > now) {
        return {
          userId: row[0],
          plan: row[1] as PlanKey,
          status: 'active',
          razorpayPaymentId: row[3],
          razorpayOrderId: row[4],
          amount: parseInt(row[5] || '0', 10),
          startDate: row[6],
          endDate: row[7],
          createdAt: row[8],
        };
      }
    }
  }
  return null;
}

export async function createSubscription(
  record: SubscriptionRecord
): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'subscriptions!A:I',
    valueInputOption: 'RAW',
    requestBody: {
      values: [
        [
          record.userId,
          record.plan,
          record.status,
          record.razorpayPaymentId,
          record.razorpayOrderId,
          record.amount,
          record.startDate,
          record.endDate,
          record.createdAt,
        ],
      ],
    },
  });
}

export async function getSubscriptionHistory(
  userId: string
): Promise<SubscriptionRecord[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'subscriptions!A2:I',
  });
  const rows = res.data.values || [];

  return rows
    .filter((row) => row[0] === userId)
    .map((row) => ({
      userId: row[0],
      plan: row[1] as PlanKey,
      status: row[2] as SubscriptionRecord['status'],
      razorpayPaymentId: row[3],
      razorpayOrderId: row[4],
      amount: parseInt(row[5] || '0', 10),
      startDate: row[6],
      endDate: row[7],
      createdAt: row[8],
    }))
    .reverse();
}
