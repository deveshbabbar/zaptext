// POST /api/parse-catalog
//
// Single bulk-import endpoint for ALL 8 verticals. Accepts text paste,
// image upload, PDF upload, or Excel/CSV upload, and returns structured
// rows matching the vertical's catalog schema.
//
// Request: multipart/form-data with
//     vertical: 'restaurant'|'coaching'|'realestate'|'salon'|'gym'|'tiffin'|'ecommerce'|'grocery'
//     mode:     'text'|'image'|'pdf'|'excel'|'csv'
//     text:     string                (when mode=text or csv)
//     file:     File                  (when mode=image|pdf|excel)
//
// Response: { success, items: T[], count } | { success: false, error, detail? }

import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { rateLimit, getClientKey } from '@/lib/rate-limit';
import { parseTextWithLLM, parseImageWithLLM, parsePdfWithLLM } from '@/lib/catalog/llm';
import { extractTextFromExcel, extractTextFromCsv } from '@/lib/catalog/excel';
import { SCHEMAS, isSupportedVertical } from '@/lib/catalog/schemas';

const MAX_TEXT = 8_000;
const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_PDF = 10 * 1024 * 1024;
const MAX_EXCEL = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const user = await getUserRole();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const rateKey = `parse-catalog:${user.userId || getClientKey(request, '/api/parse-catalog')}`;
  const rate = rateLimit(rateKey, 6, 60_000);
  if (!rate.ok) {
    return NextResponse.json(
      { success: false, error: 'Slow down — try again in a minute.', resetInMs: rate.resetInMs },
      { status: 429 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Expected multipart/form-data' },
      { status: 400 }
    );
  }

  const vertical = String(form.get('vertical') || '');
  const mode = String(form.get('mode') || '');

  if (!isSupportedVertical(vertical)) {
    return NextResponse.json(
      { success: false, error: `Unsupported vertical: ${vertical}` },
      { status: 400 }
    );
  }
  if (!['text', 'image', 'pdf', 'excel', 'csv'].includes(mode)) {
    return NextResponse.json(
      { success: false, error: `Unsupported mode: ${mode}` },
      { status: 400 }
    );
  }

  const schema = SCHEMAS[vertical];

  try {
    let rawResult: unknown;

    if (mode === 'text') {
      const text = String(form.get('text') || '');
      if (!text.trim()) {
        return NextResponse.json({ success: false, error: 'Empty text' }, { status: 400 });
      }
      if (text.length > MAX_TEXT) {
        return NextResponse.json(
          { success: false, error: `Text too long. Keep under ${MAX_TEXT} characters.` },
          { status: 413 }
        );
      }
      rawResult = await parseTextWithLLM(schema.prompt, text);
    } else if (mode === 'csv') {
      const text = String(form.get('text') || '');
      if (!text.trim()) {
        return NextResponse.json({ success: false, error: 'Empty CSV' }, { status: 400 });
      }
      const normalized = extractTextFromCsv(text);
      rawResult = await parseTextWithLLM(schema.prompt, normalized);
    } else if (mode === 'image') {
      const file = form.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json({ success: false, error: 'Missing image file' }, { status: 400 });
      }
      if (file.size > MAX_IMAGE) {
        return NextResponse.json(
          { success: false, error: 'Image too large. Max 5 MB.' },
          { status: 413 }
        );
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const base64 = buf.toString('base64');
      const mime = file.type || 'image/jpeg';
      rawResult = await parseImageWithLLM(schema.prompt, base64, mime);
    } else if (mode === 'pdf') {
      const file = form.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json({ success: false, error: 'Missing PDF file' }, { status: 400 });
      }
      if (file.size > MAX_PDF) {
        return NextResponse.json(
          { success: false, error: 'PDF too large. Max 10 MB.' },
          { status: 413 }
        );
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const base64 = buf.toString('base64');
      rawResult = await parsePdfWithLLM(schema.prompt, base64);
    } else {
      // excel
      const file = form.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json({ success: false, error: 'Missing Excel file' }, { status: 400 });
      }
      if (file.size > MAX_EXCEL) {
        return NextResponse.json(
          { success: false, error: 'Excel too large. Max 5 MB.' },
          { status: 413 }
        );
      }
      const ab = await file.arrayBuffer();
      const tsv = await extractTextFromExcel(ab);
      rawResult = await parseTextWithLLM(schema.prompt, tsv);
    }

    const itemsRaw: unknown[] =
      typeof rawResult === 'object' &&
      rawResult !== null &&
      Array.isArray((rawResult as { items?: unknown }).items)
        ? ((rawResult as { items: unknown[] }).items)
        : Array.isArray(rawResult)
          ? (rawResult as unknown[])
          : [];

    const items: unknown[] = [];
    for (const raw of itemsRaw) {
      const v = schema.validate(raw);
      if (v) items.push(v);
    }

    if (items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No usable rows found. Try cleaner formatting (one item per line, include prices).',
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ success: true, items, count: items.length });
  } catch (err) {
    console.error('[parse-catalog] failed', { vertical, mode, err });
    const detail = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json(
      { success: false, error: 'Parse failed. Try a cleaner copy or smaller chunk.', detail },
      { status: 500 }
    );
  }
}
