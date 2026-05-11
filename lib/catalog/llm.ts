// Shared LLM helpers for the bulk-import / catalog-parse pipeline.
//
// Three entry points:
//   - parseTextWithLLM   → Groq llama-3.3-70b in JSON mode (cheapest path)
//   - parseImageWithLLM  → Gemini Flash multimodal (photo of menu / catalog)
//   - parsePdfWithLLM    → Gemini Flash with inline PDF data
//
// Each returns the raw JSON from the model. The caller is responsible for
// validating/coercing into the vertical-specific shape via a validator
// passed in from the schema module.

import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

let _groq: Groq | null = null;
function groq(): Groq {
  if (!_groq) {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY not set');
    _groq = new Groq({ apiKey: key });
  }
  return _groq;
}

let _gemini: GoogleGenerativeAI | null = null;
function gemini(): GoogleGenerativeAI {
  if (!_gemini) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY not set (required for image/PDF parsing)');
    _gemini = new GoogleGenerativeAI(key);
  }
  return _gemini;
}

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

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
//
// `imageBase64` is the bare base64 string (no data: prefix). `mimeType`
// must be one Gemini accepts: image/jpeg, image/png, image/webp, image/heic.

export async function parseImageWithLLM(
  systemPrompt: string,
  imageBase64: string,
  mimeType: string
): Promise<unknown> {
  const model = gemini().getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
  });
  const cleanMime = mimeType.split(';')[0].trim() || 'image/jpeg';
  const result = await model.generateContent([
    { text: systemPrompt + '\n\nReturn ONLY valid JSON. No prose, no markdown fences.' },
    { inlineData: { data: imageBase64, mimeType: cleanMime } },
  ]);
  const text = result.response.text().trim();
  if (!text) throw new Error('Gemini returned empty content');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Gemini returned non-JSON: ${text.slice(0, 200)}`);
  }
}

// ─── PDF → JSON ──────────────────────────────────────────────────────────

export async function parsePdfWithLLM(
  systemPrompt: string,
  pdfBase64: string
): Promise<unknown> {
  const model = gemini().getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
  });
  const result = await model.generateContent([
    { text: systemPrompt + '\n\nReturn ONLY valid JSON. No prose, no markdown fences.' },
    { inlineData: { data: pdfBase64, mimeType: 'application/pdf' } },
  ]);
  const text = result.response.text().trim();
  if (!text) throw new Error('Gemini returned empty content');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Gemini returned non-JSON: ${text.slice(0, 200)}`);
  }
}
