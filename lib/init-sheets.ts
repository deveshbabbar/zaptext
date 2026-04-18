import { google } from 'googleapis';

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

interface TabSpec {
  name: string;
  headerRange: string;
  headers: string[];
}

const TABS: TabSpec[] = [
  {
    name: 'clients',
    headerRange: 'clients!A1:Q1',
    headers: [
      'client_id', 'business_name', 'type', 'owner_name', 'whatsapp_number',
      'phone_number_id', 'city', 'system_prompt', 'knowledge_base_json', 'status',
      'created_at', 'owner_user_id', 'upi_id', 'upi_name', 'existing_system',
      'export_format', 'contact_number',
    ],
  },
  {
    name: 'conversations',
    headerRange: 'conversations!A1:F1',
    headers: ['timestamp', 'client_id', 'customer_phone', 'direction', 'message', 'message_type'],
  },
  {
    name: 'analytics',
    headerRange: 'analytics!A1:D1',
    headers: ['date', 'client_id', 'total_messages', 'unique_customers'],
  },
  {
    name: 'bookings',
    headerRange: 'bookings!A1:M1',
    headers: [
      'booking_id', 'client_id', 'customer_phone', 'customer_name', 'date',
      'time_slot', 'end_time', 'service', 'status', 'notes',
      'created_at', 'reminded', 'owner_notified',
    ],
  },
  {
    name: 'weekly_schedule',
    headerRange: 'weekly_schedule!A1:G1',
    headers: ['client_id', 'day_of_week', 'start_time', 'end_time', 'slot_duration_minutes', 'is_active', 'service_type'],
  },
  {
    name: 'date_overrides',
    headerRange: 'date_overrides!A1:F1',
    headers: ['client_id', 'date', 'override_type', 'custom_start', 'custom_end', 'reason'],
  },
  {
    name: 'subscriptions',
    headerRange: 'subscriptions!A1:I1',
    headers: ['userId', 'plan', 'status', 'razorpayPaymentId', 'razorpayOrderId', 'amount', 'startDate', 'endDate', 'createdAt'],
  },
  {
    name: 'inventory',
    headerRange: 'inventory!A1:I1',
    headers: ['client_id', 'sku', 'name', 'price', 'stock', 'low_stock_threshold', 'is_active', 'updated_at', 'notes'],
  },
  {
    name: 'staff',
    headerRange: 'staff!A1:J1',
    headers: ['staff_id', 'client_id', 'name', 'specialty', 'price', 'whatsapp_phone', 'bio', 'is_active', 'availability_json', 'created_at'],
  },
];

export interface InitReport {
  spreadsheetId: string;
  tabsCreated: string[];
  tabsAlreadyExisted: string[];
  headersWritten: string[];
  headersAlreadyExisted: string[];
  errors: { tab: string; message: string }[];
}

export async function initializeAllSheets(): Promise<InitReport> {
  if (!SPREADSHEET_ID) {
    throw new Error('SPREADSHEET_ID env var not set');
  }

  const sheets = getSheets();
  const report: InitReport = {
    spreadsheetId: SPREADSHEET_ID,
    tabsCreated: [],
    tabsAlreadyExisted: [],
    headersWritten: [],
    headersAlreadyExisted: [],
    errors: [],
  };

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existing = new Set(
    (meta.data.sheets || [])
      .map((s) => s.properties?.title)
      .filter((t): t is string => !!t)
  );

  const toCreate = TABS.filter((t) => !existing.has(t.name));
  if (toCreate.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: toCreate.map((t) => ({
          addSheet: { properties: { title: t.name } },
        })),
      },
    });
    report.tabsCreated = toCreate.map((t) => t.name);
  }
  report.tabsAlreadyExisted = TABS.filter((t) => existing.has(t.name)).map((t) => t.name);

  for (const tab of TABS) {
    try {
      const current = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: tab.headerRange,
      });
      const hasHeaders = !!current.data.values && current.data.values.length > 0;
      if (hasHeaders) {
        report.headersAlreadyExisted.push(tab.name);
        continue;
      }
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: tab.headerRange,
        valueInputOption: 'RAW',
        requestBody: { values: [tab.headers] },
      });
      report.headersWritten.push(tab.name);
    } catch (err) {
      report.errors.push({ tab: tab.name, message: String(err).slice(0, 300) });
    }
  }

  return report;
}
