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

// ─── Image → JSON ────────────────────────────────────────────────────────
// `imageBase64` is the bare base64 string (no data: prefix). MIME must be
// one Groq vision accepts: image/jpeg, image/png, image/webp, image/gif.
// We bundle the system prompt as the FIRST text part so the model treats
// the instruction as primary and the image as supporting evidence.

export async function parseImageWithLLM(
  systemPrompt: string,
  imageBase64: string,
  mimeType: string
): Promise<unknown> {
  const cleanMime = mimeType.split(';')[0].trim() || 'image/jpeg';
  const dataUrl = `data:${cleanMime};base64,${imageBase64}`;

  const res = await groq().chat.completions.create({
    model: GROQ_VISION_MODEL,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: systemPrompt + '\n\nReturn ONLY valid JSON. No prose, no markdown fences.',
          },
          { type: 'image_url', image_url: { url: dataUrl } },
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

// ─── PDF → JSON ──────────────────────────────────────────────────────────
// Groq doesn't accept inline PDF input. Owners should upload a photo /
// screenshot of the PDF instead, or paste its text content into the
// Paste-text tab.

export async function parsePdfWithLLM(_systemPrompt?: string, _pdfBase64?: string): Promise<unknown> {
  throw new Error(
    'PDF upload not supported yet. Please take a screenshot of the PDF and upload it as an image, or copy-paste its text.'
  );
}
