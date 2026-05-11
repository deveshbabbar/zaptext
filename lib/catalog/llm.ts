// Shared LLM helpers for the bulk-import / catalog-parse pipeline.
//
// All routing goes through Groq:
//   - parseTextWithLLM   -> llama-3.3-70b-versatile in JSON mode (text)
//   - parseImageWithLLM  -> meta-llama/llama-4-scout-17b-16e-instruct (vision + JSON)
//   - parsePdfWithLLM    -> NOT YET SUPPORTED (Groq has no inline PDF input).
//                            Owners should upload a photo / screenshot or paste text.

import Groq from 'groq-sdk';

let _groq: Groq | null = null;
function groq(): Groq {
  if (!_groq) {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY not set');
    _groq = new Groq({ apiKey: key });
  }
  return _groq;
}

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const GROQ_VISION_MODEL =
  process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';

// ─── Text → JSON ─────────────────────────────────────────────────────────

export async function parseTextWithLLM(
  systemPrompt: string,
  userText: string
): Promise<unknown> {
  const res = await groq().chat.completions.create({
    model: GROQ_MODEL,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userText },
    ],
  });
  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error('Groq returned empty content');
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Groq returned non-JSON: ${raw.slice(0, 200)}`);
  }
}

// ─── Image(s) → JSON ────────────────────────────────────────────────────
// Accepts one OR more images in a single vision call. Multi-page menus
// commonly span 2-3 photos; we send all of them in one message so the
// model can build a single unified extraction (one "items" array across
// pages) rather than running the call N times and de-duping.
//
// Each input is the raw base64 string (no data: prefix) plus MIME type.
// Groq vision accepts image/jpeg, image/png, image/webp, image/gif.

export type ImageInput = { base64: string; mimeType: string };

export async function parseImageWithLLM(
  systemPrompt: string,
  images: ImageInput[]
): Promise<unknown> {
  if (images.length === 0) throw new Error('parseImageWithLLM: no images supplied');

  const multiPageHint =
    images.length > 1
      ? `\n\nThis menu spans ${images.length} pages — extract items from ALL pages and combine them into ONE "items" array. Do NOT duplicate items that appear on more than one page (e.g., a section header repeated at the top of page 2).`
      : '';

  const content: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  > = [
    {
      type: 'text',
      text: systemPrompt + multiPageHint + '\n\nReturn ONLY valid JSON. No prose, no markdown fences.',
    },
  ];
  for (const img of images) {
    const cleanMime = img.mimeType.split(';')[0].trim() || 'image/jpeg';
    content.push({
      type: 'image_url',
      image_url: { url: `data:${cleanMime};base64,${img.base64}` },
    });
  }

  const res = await groq().chat.completions.create({
    model: GROQ_VISION_MODEL,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content }],
  });
  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error('Groq vision returned empty content');
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Groq vision returned non-JSON: ${raw.slice(0, 200)}`);
  }
}

// ─── PDF → JSON ──────────────────────────────────────────────────────────
// Groq doesn't accept inline PDF input. Owners should upload a photo /
// screenshot of the PDF instead, or paste its text content into the
// Paste-text tab.

export async function parsePdfWithLLM(_systemPrompt?: string, _pdfBase64?: string): Promise<unknown> {
  throw new Error(
    'PDF upload not supported yet. Please take a screenshot of the PDF and upload it as an image, or copy-paste its text.'
  );
}
