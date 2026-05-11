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

const TEXT_MAX_TOKENS = Number(process.env.GROQ_TEXT_MAX_TOKENS) || 8192;

export async function parseTextWithLLM(
  systemPrompt: string,
  userText: string
): Promise<unknown> {
  const res = await groq().chat.completions.create({
    model: GROQ_MODEL,
    temperature: 0.1,
    max_tokens: TEXT_MAX_TOKENS,
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
// Strategy: one model call per image, in parallel, then merge the items[]
// arrays. We tried single-call multi-image first and it worked, but the
// vision model's 8192-token completion budget gets exhausted before the
// JSON closes for menus with ~40+ items — the model emits a clean partial
// array (JSON mode never returns broken JSON, it just stops early). One
// call per page sidesteps this entirely and parallelism keeps latency flat.
//
// Each input is the raw base64 string (no data: prefix) plus MIME type.
// Groq vision accepts image/jpeg, image/png, image/webp, image/gif.

export type ImageInput = { base64: string; mimeType: string };

const VISION_MAX_TOKENS = Number(process.env.GROQ_VISION_MAX_TOKENS) || 8192;

async function parseSingleImage(
  systemPrompt: string,
  image: ImageInput,
  pageHint?: string
): Promise<unknown> {
  const cleanMime = image.mimeType.split(';')[0].trim() || 'image/jpeg';

  const res = await groq().chat.completions.create({
    model: GROQ_VISION_MODEL,
    temperature: 0.1,
    max_tokens: VISION_MAX_TOKENS,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              systemPrompt +
              (pageHint ? `\n\n${pageHint}` : '') +
              '\n\nExtract EVERY visible item — do not skip any. Be exhaustive.' +
              '\n\nReturn ONLY valid JSON. No prose, no markdown fences.',
          },
          {
            type: 'image_url',
            image_url: { url: `data:${cleanMime};base64,${image.base64}` },
          },
        ],
      },
    ],
  });
  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error('Groq vision returned empty content');
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Groq vision returned non-JSON: ${raw.slice(0, 200)}`);
  }
}

export async function parseImageWithLLM(
  systemPrompt: string,
  images: ImageInput[]
): Promise<unknown> {
  if (images.length === 0) throw new Error('parseImageWithLLM: no images supplied');

  // Single image: one direct call, no merge needed.
  if (images.length === 1) {
    return parseSingleImage(systemPrompt, images[0]);
  }

  // Multi-image: parallel calls, one per page, then concatenate the
  // items[] arrays. We don't dedupe in code — the user reviews the preview
  // table and can delete any header/footer rows that slipped through.
  const results = await Promise.all(
    images.map((img, idx) =>
      parseSingleImage(
        systemPrompt,
        img,
        `This is page ${idx + 1} of ${images.length} of a multi-page menu. Extract only what is visible on THIS page.`
      )
    )
  );

  const allItems: unknown[] = [];
  for (const r of results) {
    if (
      typeof r === 'object' &&
      r !== null &&
      Array.isArray((r as { items?: unknown }).items)
    ) {
      allItems.push(...((r as { items: unknown[] }).items));
    }
  }
  return { items: allItems };
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
