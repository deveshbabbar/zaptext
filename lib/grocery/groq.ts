// lib/grocery/groq.ts
//
// Thin Groq SDK wrapper. Two surfaces:
//   1) chatJSON<T>(systemPrompt, userPrompt) → T
//      Forces JSON-mode output via response_format. Used by parsers.
//   2) transcribeVoice(audioBase64, mimeType) → string
//      Whisper-large-v3 transcription. Hindi/English/Hinglish handled.

import Groq from 'groq-sdk';

let _client: Groq | null = null;

function client(): Groq {
  if (!_client) {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY not set in env');
    _client = new Groq({ apiKey: key });
  }
  return _client;
}

const CHAT_MODEL = 'llama-3.3-70b-versatile';
const WHISPER_MODEL = 'whisper-large-v3';

export async function chatJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  opts: { temperature?: number } = {}
): Promise<T> {
  const res = await client().chat.completions.create({
    model: CHAT_MODEL,
    temperature: opts.temperature ?? 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });
  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error('Groq returned empty content');
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    throw new Error(`Groq returned non-JSON: ${raw.slice(0, 200)}`);
  }
}

export async function transcribeVoice(
  audioBase64: string,
  mimeType: string
): Promise<string> {
  // Groq Whisper accepts a File-like object. Convert base64 → Buffer → Blob.
  const buf = Buffer.from(audioBase64, 'base64');
  const blob = new Blob([buf], { type: mimeType });
  const file = new File([blob], 'audio.ogg', { type: mimeType });

  const res = await client().audio.transcriptions.create({
    file,
    model: WHISPER_MODEL,
  });
  return res.text.trim();
}
