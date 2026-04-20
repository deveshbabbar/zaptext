import { google } from 'googleapis';
import { ClientRow, ConversationRow, AnalyticsRow, BusinessType } from './types';
import { getISTTimestamp, getISTDate } from './utils';

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

// ─── In-memory cache with promise coalescing (30 second TTL) ───
// Parallel callers share the in-flight Sheets RPC — no racing reads,
// no stale overwrite after invalidation. Invalidated on writes.
interface CacheEntry<T> { promise: Promise<T>; expiresAt: number; }
const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 30_000;

function getOrFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (entry && entry.expiresAt > Date.now()) {
    return entry.promise;
  }
  const promise = fetcher().catch((err) => {
    // Don't cache failures — next caller retries fresh.
    cache.delete(key);
    throw err;
  });
  cache.set(key, { promise, expiresAt: Date.now() + CACHE_TTL_MS });
  return promise;
}

function invalidateCache(key?: string): void {
  if (key) cache.delete(key);
  else cache.clear();
}

// Prime the cache with a known-good value. Used after writes to cover
// Google Sheets' read-after-write replication lag so immediate reads
// can see the new row without hitting "not found".
function primeCache<T>(key: string, data: T): void {
  cache.set(key, { promise: Promise.resolve(data), expiresAt: Date.now() + CACHE_TTL_MS });
}

const VALID_BIZ_TYPES: ReadonlyArray<BusinessType> = [
  'restaurant', 'coaching', 'realestate', 'salon', 'd2c', 'gym',
];
const VALID_STATUSES: ReadonlyArray<ClientRow['status']> = [
  'active', 'pending', 'paused', 'rejected', 'error',
];

// ─── Clients ───

export async function getAllClients(): Promise<ClientRow[]> {
  return getOrFetch('clients', async () => {
    const sheets = getSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'clients!A2:R',
    });
    const rows = res.data.values || [];
    return rows.map((row) => {
      const rawType = row[2] || '';
      const rawStatus = row[9] || 'active';
      const type = (VALID_BIZ_TYPES as ReadonlyArray<string>).includes(rawType)
        ? (rawType as BusinessType)
        : ('restaurant' as BusinessType);
      if (rawType && type !== rawType) {
        console.warn(`[clients] unknown/removed business type "${rawType}" for ${row[0]} — defaulting to restaurant (clinic vertical removed for WA policy compliance)`);
      }
      const status = (VALID_STATUSES as ReadonlyArray<string>).includes(rawStatus)
        ? (rawStatus as ClientRow['status'])
        : ('error' as ClientRow['status']);
      if (rawStatus && status !== rawStatus) {
        console.warn(`[clients] unknown status "${rawStatus}" for ${row[0]} — treating as error`);
      }
      const rawExportFormat = row[15] || 'csv';
      const exportFormat: 'csv' | 'json' = rawExportFormat === 'json' ? 'json' : 'csv';
      return {
        client_id: row[0] || '',
        business_name: row[1] || '',
        type,
        owner_name: row[3] || '',
        whatsapp_number: row[4] || '',
        phone_number_id: row[5] || '',
        city: row[6] || '',
        system_prompt: row[7] || '',
        knowledge_base_json: row[8] || '',
        status,
        created_at: row[10] || '',
        owner_user_id: row[11] || '',
        upi_id: row[12] || '',
        upi_name: row[13] || '',
        existing_system: row[14] || '',
        export_format: exportFormat,
        contact_number: row[16] || '',
        opt_in_accepted: String(row[17] || '').toUpperCase() === 'TRUE',
      };
    });
  });
}

export async function getClientById(clientId: string): Promise<ClientRow | null> {
  const clients = await getAllClients();
  return clients.find((c) => c.client_id === clientId) || null;
}

export async function getClientByPhoneNumberId(phoneNumberId: string): Promise<ClientRow | null> {
  const clients = await getAllClients();
  return clients.find((c) => c.phone_number_id === phoneNumberId) || null;
}

export class DuplicateBotError extends Error {
  readonly code = 'DUPLICATE_BOT' as const;
  constructor(public field: 'whatsapp_number' | 'phone_number_id', public value: string) {
    super(`A bot with ${field}="${value}" already exists.`);
    this.name = 'DuplicateBotError';
  }
}

export async function addClient(client: ClientRow): Promise<void> {
  // Prevent duplicate bots on the same WhatsApp number / phone_number_id —
  // two rows with the same phone_number_id would cause webhook routing to
  // hit a non-deterministic client on inbound messages.
  const existing = await getAllClients();
  const normalizedPhone = (client.whatsapp_number || '').replace(/\D/g, '');
  if (normalizedPhone) {
    const dupPhone = existing.find((c) => c.whatsapp_number.replace(/\D/g, '') === normalizedPhone);
    if (dupPhone) throw new DuplicateBotError('whatsapp_number', client.whatsapp_number);
  }
  if (client.phone_number_id) {
    const dupId = existing.find((c) => c.phone_number_id === client.phone_number_id);
    if (dupId) throw new DuplicateBotError('phone_number_id', client.phone_number_id);
  }

  const sheets = getSheets();
  // CRITICAL: insertDataOption='INSERT_ROWS' forces Sheets to INSERT a new row
  // instead of overwriting whatever row it thinks is "after the table". The
  // default (OVERWRITE) can silently clobber an existing bot row when the
  // sheet's table boundary is miscalculated (blank columns, out-of-order rows)
  // — that's the "bot disappeared after some time" symptom.
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'clients!A:R',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[
        client.client_id,
        client.business_name,
        client.type,
        client.owner_name,
        client.whatsapp_number,
        client.phone_number_id,
        client.city,
        client.system_prompt,
        client.knowledge_base_json,
        client.status,
        client.created_at,
        client.owner_user_id,
        client.upi_id || '',
        client.upi_name || '',
        client.existing_system || '',
        client.export_format || 'csv',
        client.contact_number || '',
        client.opt_in_accepted ? 'TRUE' : 'FALSE',
      ]],
    },
  });
  invalidateCache('clients');

  // Sheets has a small read-after-write replication lag; if a fresh
  // read doesn't yet see the new row, patch the cache with the row we
  // just wrote so getClientById/getAllClients can find it immediately.
  try {
    const fresh = await getAllClients();
    if (!fresh.find((c) => c.client_id === client.client_id)) {
      primeCache<ClientRow[]>('clients', [...fresh, client]);
    }
  } catch {
    // If the refresh fails, fall through — next read will retry from Sheets.
  }
}

// Hard-delete a client row from the `clients` sheet. Also drops its
// conversations rows so the dashboard doesn't show ghost history.
// Returns true if a row was deleted, false if the clientId wasn't found.
export async function deleteClient(clientId: string): Promise<boolean> {
  const sheets = getSheets();

  // Find client row in `clients` sheet
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'clients!A2:A',
  });
  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((row) => row[0] === clientId);
  if (rowIndex === -1) return false;

  // Resolve sheetIds — batchUpdate needs numeric sheetId, not name
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const clientsSheet = (meta.data.sheets || []).find((s) => s.properties?.title === 'clients');
  const convosSheet = (meta.data.sheets || []).find((s) => s.properties?.title === 'conversations');
  if (!clientsSheet?.properties?.sheetId) return false;

  // Delete the client row. rowIndex is 0-based within A2:A, so sheet row = rowIndex + 1
  // in 0-based dimension terms (header is row 0, first data row is row 1).
  const deleteRequests: Array<{ deleteDimension: { range: { sheetId: number; dimension: 'ROWS'; startIndex: number; endIndex: number } } }> = [
    {
      deleteDimension: {
        range: {
          sheetId: clientsSheet.properties.sheetId,
          dimension: 'ROWS',
          startIndex: rowIndex + 1,
          endIndex: rowIndex + 2,
        },
      },
    },
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: deleteRequests },
  });

  // Purge conversations rows for this client_id (best-effort; don't fail the
  // main delete if this step hiccups).
  try {
    if (convosSheet?.properties?.sheetId) {
      const conv = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'conversations!A2:B',
      });
      const convRows = conv.data.values || [];
      // Collect indices (0-based within A2:B) where client_id column B matches.
      // Delete bottom-up so earlier indices stay valid.
      const convDeleteReqs = convRows
        .map((row, i) => ({ row, i }))
        .filter(({ row }) => row[1] === clientId)
        .reverse()
        .map(({ i }) => ({
          deleteDimension: {
            range: {
              sheetId: convosSheet.properties!.sheetId!,
              dimension: 'ROWS' as const,
              startIndex: i + 1,
              endIndex: i + 2,
            },
          },
        }));
      if (convDeleteReqs.length > 0) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: { requests: convDeleteReqs },
        });
      }
    }
  } catch (e) {
    console.error('[deleteClient] conversations cleanup failed:', e);
  }

  invalidateCache('clients');
  invalidateCache('conversations');
  return true;
}

export async function updateClientStatus(clientId: string, status: ClientRow['status']): Promise<void> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'clients!A2:A',
  });
  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((row) => row[0] === clientId);
  if (rowIndex === -1) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `clients!J${rowIndex + 2}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[status]] },
  });
  invalidateCache('clients');
}

export async function updateClientField(clientId: string, field: string, value: string): Promise<void> {
  const fieldToCol: Record<string, string> = {
    business_name: 'B',
    owner_name: 'D',
    whatsapp_number: 'E',
    phone_number_id: 'F',
    city: 'G',
    system_prompt: 'H',
    knowledge_base_json: 'I',
    status: 'J',
    upi_id: 'M',
    upi_name: 'N',
    existing_system: 'O',
    export_format: 'P',
    contact_number: 'Q',
    opt_in_accepted: 'R',
  };
  const col = fieldToCol[field];
  if (!col) return;

  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'clients!A2:A',
  });
  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((row) => row[0] === clientId);
  if (rowIndex === -1) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `clients!${col}${rowIndex + 2}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[value]] },
  });
  invalidateCache('clients');
}

// ─── Conversations ───

export async function getConversationHistory(
  clientId: string,
  customerPhone: string,
  limit: number = 10
): Promise<ConversationRow[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'conversations!A2:F',
  });
  const rows = res.data.values || [];
  const filtered = rows
    .map((row) => ({
      timestamp: row[0] || '',
      client_id: row[1] || '',
      customer_phone: row[2] || '',
      direction: (row[3] || '') as ConversationRow['direction'],
      message: row[4] || '',
      message_type: row[5] || 'text',
    }))
    .filter((r) => r.client_id === clientId && r.customer_phone === customerPhone);
  return filtered.slice(-limit);
}

export async function addConversationMessage(msg: ConversationRow): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'conversations!A:F',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        msg.timestamp,
        msg.client_id,
        msg.customer_phone,
        msg.direction,
        msg.message,
        msg.message_type,
      ]],
    },
  });
  invalidateCache('conversations');
}

async function getAllConversations(): Promise<ConversationRow[]> {
  return getOrFetch('conversations', async () => {
    const sheets = getSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'conversations!A2:F',
    });
    const rows = res.data.values || [];
    return rows.map((row) => {
      const rawDir = row[3] || '';
      const direction: ConversationRow['direction'] =
        rawDir === 'incoming' || rawDir === 'outgoing' ? rawDir : 'incoming';
      return {
        timestamp: row[0] || '',
        client_id: row[1] || '',
        customer_phone: row[2] || '',
        direction,
        message: row[4] || '',
        message_type: row[5] || 'text',
      };
    });
  });
}

export async function getClientConversations(clientId: string): Promise<ConversationRow[]> {
  const all = await getAllConversations();
  return all.filter((r) => r.client_id === clientId);
}

// ─── Analytics ───

export async function updateAnalytics(clientId: string, customerPhone: string): Promise<void> {
  const sheets = getSheets();
  const today = getISTDate();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'analytics!A2:D',
  });
  const rows = res.data.values || [];
  const existingIndex = rows.findIndex((r) => r[0] === today && r[1] === clientId);

  if (existingIndex >= 0) {
    const currentTotal = parseInt(rows[existingIndex][2] || '0', 10) + 1;
    // Simple unique customer tracking: check conversations for today
    const convRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'conversations!A2:C',
    });
    const convRows = convRes.data.values || [];
    const todayCustomers = new Set(
      convRows
        .filter((r) => r[1] === clientId && (r[0] || '').startsWith(today.replace(/-/g, '/')))
        .map((r) => r[2])
    );
    todayCustomers.add(customerPhone);

    const rowNum = existingIndex + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `analytics!C${rowNum}:D${rowNum}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[currentTotal, todayCustomers.size]] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'analytics!A:D',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[today, clientId, 1, 1]],
      },
    });
  }
}

export async function getClientAnalytics(clientId: string, days: number = 7): Promise<AnalyticsRow[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'analytics!A2:D',
  });
  const rows = res.data.values || [];
  return rows
    .map((row) => ({
      date: row[0] || '',
      client_id: row[1] || '',
      total_messages: parseInt(row[2] || '0', 10),
      unique_customers: parseInt(row[3] || '0', 10),
    }))
    .filter((r) => r.client_id === clientId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-days);
}

// ─── Init Sheets (create headers if needed) ───

export async function initializeSheets(): Promise<void> {
  const sheets = getSheets();

  // Check if headers exist
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'clients!A1:Q1',
    });
    if (!res.data.values || res.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'clients!A1:Q1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['client_id', 'business_name', 'type', 'owner_name', 'whatsapp_number', 'phone_number_id', 'city', 'system_prompt', 'knowledge_base_json', 'status', 'created_at', 'owner_user_id', 'upi_id', 'upi_name', 'existing_system', 'export_format', 'contact_number']],
        },
      });
    }
  } catch {
    // Sheet might not exist yet
  }

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'conversations!A1:F1',
    });
    if (!res.data.values || res.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'conversations!A1:F1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['timestamp', 'client_id', 'customer_phone', 'direction', 'message', 'message_type']],
        },
      });
    }
  } catch {
    // Sheet might not exist yet
  }

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'analytics!A1:D1',
    });
    if (!res.data.values || res.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'analytics!A1:D1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['date', 'client_id', 'total_messages', 'unique_customers']],
        },
      });
    }
  } catch {
    // Sheet might not exist yet
  }
}
