// ─── One-off data migration: Google Sheets → Neon Postgres ───
//
// Reads the three migrated tabs (clients, conversations, analytics) from
// the existing spreadsheet and bulk-inserts each row into the matching
// Neon table. Idempotent for clients + analytics — re-running is safe;
// existing rows are left alone via ON CONFLICT DO NOTHING. Conversations
// are NOT idempotent (synthetic UUID), so run this script once and verify
// counts in Neon Studio (`npm run db:studio`).
//
// Run after `npm run db:push` (which creates the tables) and AFTER
// DATABASE_URL is set in .env.local. Both Sheets credentials AND
// DATABASE_URL must be configured for this script to work.
//
// Usage:
//   npm run db:seed-from-sheets

// Env loading: the npm script passes `--env-file=.env.local` to tsx
// (Node 20.6+ native flag) so DATABASE_URL is set BEFORE any module
// loads — that's the ordering that lets lib/db/index.ts see the real
// connection string at import time. Requires Node ≥ 20.6.
import { google } from 'googleapis';
import { v4 as uuid } from 'uuid';
import { db } from '../lib/db';
import { clients, conversations, analytics, subscriptions } from '../lib/db/schema';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
if (!SPREADSHEET_ID) {
  console.error('SPREADSHEET_ID is not set. Add it to .env.local.');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Add it to .env.local.');
  process.exit(1);
}
if (!process.env.GOOGLE_SHEETS_CLIENT_EMAIL || !process.env.GOOGLE_SHEETS_PRIVATE_KEY) {
  console.error('GOOGLE_SHEETS_* credentials are not set. Need read access to the existing spreadsheet.');
  process.exit(1);
}

function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

const VALID_BIZ_TYPES = ['restaurant', 'coaching', 'realestate', 'salon', 'd2c', 'gym'];
const VALID_STATUSES = ['active', 'pending', 'paused', 'rejected', 'error'];

function safeBool(s: string | undefined): boolean {
  return String(s || '').toUpperCase() === 'TRUE';
}

function safeDate(s: string | undefined): Date {
  if (!s) return new Date();
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

async function migrateClients() {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'clients!A2:R',
  });
  const rows = res.data.values || [];
  console.log(`[clients] ${rows.length} rows in Sheet`);

  let inserted = 0;
  let skipped = 0;
  for (const row of rows) {
    const clientId = row[0];
    if (!clientId) {
      skipped++;
      continue;
    }
    const rawType = row[2] || '';
    const type = VALID_BIZ_TYPES.includes(rawType) ? rawType : 'restaurant';
    const rawStatus = row[9] || 'active';
    const status = VALID_STATUSES.includes(rawStatus) ? rawStatus : 'error';
    const exportFormat = row[15] === 'json' ? 'json' : 'csv';

    const result = await db
      .insert(clients)
      .values({
        client_id: clientId,
        business_name: row[1] || '',
        type,
        owner_name: row[3] || '',
        whatsapp_number: row[4] || '',
        phone_number_id: row[5] || '',
        city: row[6] || '',
        system_prompt: row[7] || '',
        knowledge_base_json: row[8] || '',
        status,
        created_at: safeDate(row[10]),
        owner_user_id: row[11] || '',
        upi_id: row[12] || '',
        upi_name: row[13] || '',
        existing_system: row[14] || '',
        export_format: exportFormat,
        contact_number: row[16] || '',
        opt_in_accepted: safeBool(row[17]),
      })
      .onConflictDoNothing({ target: clients.client_id })
      .returning({ id: clients.client_id });

    if (result.length > 0) inserted++;
    else skipped++;
  }
  console.log(`[clients] inserted=${inserted} skipped=${skipped} (already in Neon)`);
}

async function migrateConversations() {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'conversations!A2:F',
  });
  const rows = res.data.values || [];
  console.log(`[conversations] ${rows.length} rows in Sheet`);

  let inserted = 0;
  for (const row of rows) {
    const clientId = row[1];
    if (!clientId) continue;
    const rawDir = row[3] || '';
    const direction = rawDir === 'incoming' || rawDir === 'outgoing' ? rawDir : 'incoming';

    await db.insert(conversations).values({
      id: uuid(),
      timestamp: safeDate(row[0]),
      client_id: clientId,
      customer_phone: row[2] || '',
      direction,
      message: row[4] || '',
      message_type: row[5] || 'text',
    });
    inserted++;
  }
  console.log(`[conversations] inserted=${inserted}`);
}

async function migrateAnalytics() {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'analytics!A2:D',
  });
  const rows = res.data.values || [];
  console.log(`[analytics] ${rows.length} rows in Sheet`);

  let inserted = 0;
  let skipped = 0;
  for (const row of rows) {
    const date = row[0];
    const clientId = row[1];
    if (!date || !clientId) {
      skipped++;
      continue;
    }
    const result = await db
      .insert(analytics)
      .values({
        date,
        client_id: clientId,
        total_messages: parseInt(row[2] || '0', 10),
        unique_customers: parseInt(row[3] || '0', 10),
      })
      .onConflictDoNothing({ target: [analytics.date, analytics.client_id] })
      .returning({ d: analytics.date });
    if (result.length > 0) inserted++;
    else skipped++;
  }
  console.log(`[analytics] inserted=${inserted} skipped=${skipped} (already in Neon)`);
}

async function migrateSubscriptions() {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'subscriptions!A2:I',
  });
  const rows = res.data.values || [];
  console.log(`[subscriptions] ${rows.length} rows in Sheet`);

  let inserted = 0;
  let skipped = 0;
  for (const row of rows) {
    const userId = row[0];
    if (!userId) {
      skipped++;
      continue;
    }
    const result = await db
      .insert(subscriptions)
      .values({
        id: uuid(),
        user_id: userId,
        plan: row[1] || 'trial',
        status: row[2] || 'active',
        razorpay_payment_id: row[3] || '',
        razorpay_order_id: row[4] || '',
        amount: String(row[5] || '0'),
        start_date: safeDate(row[6]),
        end_date: safeDate(row[7]),
        created_at: safeDate(row[8]),
      })
      // Two trial subscriptions for the same user both have empty
      // razorpay_payment_id; the unique index on payment_id would block
      // them. Skip the conflict guard for empty payment ids by treating
      // those rows as always-insert.
      .onConflictDoNothing({ target: subscriptions.razorpay_payment_id })
      .returning({ id: subscriptions.id });
    if (result.length > 0) inserted++;
    else skipped++;
  }
  console.log(`[subscriptions] inserted=${inserted} skipped=${skipped} (already in Neon)`);
}

async function main() {
  console.log('Starting Sheets → Neon migration…');
  console.log(`Spreadsheet: ${SPREADSHEET_ID}`);

  await migrateClients();
  await migrateConversations();
  await migrateAnalytics();
  await migrateSubscriptions();

  console.log('\n✓ Migration complete.');
  console.log('Spot-check counts in Neon Studio: npm run db:studio');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
