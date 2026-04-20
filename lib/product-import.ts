import { GoogleGenerativeAI } from '@google/generative-ai';
import ExcelJS from 'exceljs';

// Parsed, normalized product ready to be upserted into the inventory sheet.
// Only `name` is required; everything else defaults in upsertItem.
export interface ImportedProduct {
  name: string;
  price?: number;
  stock?: number;
  notes?: string;
}

export interface ImportResult {
  items: ImportedProduct[];
  totalRows: number;
  skipped: number;
  warning?: string;
}

function extOf(filename: string): string {
  const m = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}

// ─── CSV parser (RFC 4180-ish, handles quoted commas + escaped quotes) ───
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else if (ch === '\r') {
        // skip; handled by \n
      } else {
        field += ch;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

// ─── Excel parser ───
async function parseXLSX(buffer: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell.value;
      if (v === null || v === undefined) cells.push('');
      else if (typeof v === 'object' && 'text' in v) cells.push(String((v as { text: unknown }).text));
      else if (typeof v === 'object' && 'result' in v) cells.push(String((v as { result: unknown }).result ?? ''));
      else cells.push(String(v));
    });
    rows.push(cells);
  });
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

// ─── AI column mapping ───
// Indian SMB spreadsheets come in wildly different shapes: "Item / Cost / Qty",
// "Product Name | MRP | Stock | Description", Hindi column headers, extra
// columns for category / GST / HSN / SKU / image URLs, etc. Instead of
// regex-guessing, we hand the raw grid to Gemini with a strict JSON schema
// and let it do the mapping — that lets us support "alag alag extra cheezein"
// without hand-coding every format.
async function mapRowsToProducts(rows: string[][]): Promise<ImportedProduct[]> {
  if (rows.length === 0) return [];

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set — cannot parse file without it.');
  }

  // Cap at ~400 rows per call to stay within token budget. Most menus < 100.
  const capped = rows.slice(0, 400);
  const asText = capped.map((r) => r.join(' | ')).join('\n');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `You are parsing a product / menu / services list uploaded by an Indian SMB owner.
The raw table is below. Columns may be in any order and in English or Hindi.
Extract every real product/service row (skip header rows, section titles, blank rows, totals).

For each product, output ONE JSON object with these fields:
  - name: required, the product / item / service / plan name as a plain string
  - price: optional number in INR (strip ₹, Rs., commas, /- etc.). If a range, use the lower bound. 0 if not provided.
  - stock: optional integer quantity if a stock / qty / available column exists. Omit if no such column.
  - notes: optional short description (category, ingredients, duration, veg/non-veg, bestseller flag, etc.) — concatenated with " · "

Return ONLY valid JSON, no prose, no code fences:
{"items": [{"name": "...", "price": 0, "stock": 0, "notes": "..."}]}

RAW TABLE:
${asText}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  // Strip any markdown fences just in case
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  let parsed: { items?: unknown };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Sometimes Gemini returns text + JSON; find the last {...} block
    const m = cleaned.match(/\{[\s\S]*\}$/);
    if (!m) throw new Error('Model returned invalid JSON');
    parsed = JSON.parse(m[0]);
  }

  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  return rawItems
    .map((it): ImportedProduct | null => {
      if (!it || typeof it !== 'object') return null;
      const rec = it as Record<string, unknown>;
      const name = typeof rec.name === 'string' ? rec.name.trim() : '';
      if (!name) return null;
      const priceRaw = rec.price;
      const price =
        typeof priceRaw === 'number'
          ? priceRaw
          : typeof priceRaw === 'string'
            ? parseFloat(priceRaw.replace(/[^\d.]/g, '')) || 0
            : 0;
      const stockRaw = rec.stock;
      const stock =
        typeof stockRaw === 'number'
          ? Math.max(0, Math.floor(stockRaw))
          : typeof stockRaw === 'string' && stockRaw.trim()
            ? Math.max(0, Math.floor(parseFloat(stockRaw.replace(/[^\d.]/g, '')) || 0))
            : undefined;
      const notes = typeof rec.notes === 'string' ? rec.notes.trim() : '';
      return { name, price, stock, notes: notes || undefined };
    })
    .filter((x): x is ImportedProduct => x !== null);
}

// ─── Public entrypoint ───
export async function parseProductFile(filename: string, buffer: Buffer): Promise<ImportResult> {
  const ext = extOf(filename);

  if (ext === 'csv' || ext === 'tsv' || ext === 'txt') {
    const text = buffer.toString('utf8');
    const rows = parseCSV(text);
    const items = await mapRowsToProducts(rows);
    return { items, totalRows: rows.length, skipped: Math.max(0, rows.length - items.length - 1) };
  }

  if (ext === 'xlsx' || ext === 'xlsm') {
    const rows = await parseXLSX(buffer);
    const items = await mapRowsToProducts(rows);
    return { items, totalRows: rows.length, skipped: Math.max(0, rows.length - items.length - 1) };
  }

  if (ext === 'xls') {
    return {
      items: [],
      totalRows: 0,
      skipped: 0,
      warning:
        'Legacy .xls format is not supported. Open in Excel / Google Sheets and re-save as .xlsx or .csv.',
    };
  }

  if (ext === 'pdf') {
    return {
      items: [],
      totalRows: 0,
      skipped: 0,
      warning:
        'PDF import coming soon — for now, export your menu/product list as CSV or Excel (.xlsx) and upload that.',
    };
  }

  return {
    items: [],
    totalRows: 0,
    skipped: 0,
    warning: `Unsupported file type ".${ext}". Please upload a CSV or .xlsx file.`,
  };
}
