// Excel → flat-text dump for downstream LLM normalization.
//
// We don't try to map columns ourselves — the spreadsheet could be in any
// format (price + name swapped, headers in row 3, items merged across
// columns, etc). Instead we render the sheet as a TSV-style text block
// and hand it to Groq with the same vertical-specific prompt used for
// pasted text. The LLM is good at "figure out which column is the name
// and which is the price" given context.

import ExcelJS from 'exceljs';

const MAX_ROWS = 1000;
const MAX_COLS = 32;

export async function extractTextFromExcel(buffer: ArrayBuffer): Promise<string> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const out: string[] = [];
  let totalRows = 0;
  wb.eachSheet((sheet) => {
    if (totalRows >= MAX_ROWS) return;
    out.push(`# Sheet: ${sheet.name}`);
    sheet.eachRow((row, rowNum) => {
      if (totalRows >= MAX_ROWS) return;
      const cells: string[] = [];
      const values = row.values as unknown[];
      for (let i = 1; i <= Math.min(values.length - 1, MAX_COLS); i++) {
        const v = values[i];
        if (v == null) {
          cells.push('');
        } else if (typeof v === 'object' && v !== null && 'text' in v) {
          cells.push(String((v as { text: unknown }).text ?? '').trim());
        } else if (typeof v === 'object' && v !== null && 'result' in v) {
          cells.push(String((v as { result: unknown }).result ?? '').trim());
        } else {
          cells.push(String(v).trim());
        }
      }
      if (cells.some((c) => c !== '')) {
        out.push(`row${rowNum}\t${cells.join('\t')}`);
        totalRows++;
      }
    });
  });

  return out.join('\n');
}

export function extractTextFromCsv(text: string): string {
  return text.replace(/\r\n/g, '\n').slice(0, 40_000);
}
