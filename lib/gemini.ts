import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConversationRow } from './types';

// ─── LLM provider switch ─────────────────────────────────────────────────
//
// Provider is chosen by env var, in this priority order:
//   1. GROQ_API_KEY     → Groq (OpenAI-compatible REST, very fast Llama)
//   2. GEMINI_API_KEY   → Google Gemini (the original integration)
//
// Both paths use the same exported function signature so callers
// (app/api/webhook/route.ts, app/api/clients/[id]/test/route.ts) don't
// need to change. Useful when one provider is down — flip the env on
// Vercel and redeploy and the bot keeps replying.

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

export async function generateBotResponse(
  systemPrompt: string,
  conversationHistory: ConversationRow[],
  newMessage: string
): Promise<string> {
  if (process.env.GROQ_API_KEY) {
    return generateWithGroq(systemPrompt, conversationHistory, newMessage);
  }
  if (process.env.GEMINI_API_KEY) {
    return generateWithGemini(systemPrompt, conversationHistory, newMessage);
  }
  throw new Error(
    '[llm] No provider key configured. Set GROQ_API_KEY or GEMINI_API_KEY in your environment.'
  );
}

// ─── Groq (OpenAI-compatible) ──────────────────────────────────────────

async function generateWithGroq(
  systemPrompt: string,
  conversationHistory: ConversationRow[],
  newMessage: string
): Promise<string> {
  // OpenAI-style messages array: system once, then alternating user/assistant
  // history, then the customer's new message. Unlike Gemini, the OpenAI
  // chat schema is happy with any ordering — no leading-user requirement —
  // so we don't need the trim-to-first-user dance.
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
  ];
  for (const msg of conversationHistory) {
    messages.push({
      role: msg.direction === 'incoming' ? 'user' : 'assistant',
      content: msg.message,
    });
  }
  messages.push({ role: 'user', content: newMessage });

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      // Groq is fast enough that we don't need to stream for the WhatsApp
      // use case — just wait for the full reply.
      stream: false,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`[groq] ${res.status} ${res.statusText}: ${errText.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const reply = data.choices?.[0]?.message?.content;
  if (typeof reply !== 'string' || !reply.trim()) {
    throw new Error('[groq] empty completion');
  }
  return reply.trim();
}

// ─── Gemini (existing path) ────────────────────────────────────────────

async function generateWithGemini(
  systemPrompt: string,
  conversationHistory: ConversationRow[],
  newMessage: string
): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: systemPrompt,
  });

  const mapped = conversationHistory.map((msg) => ({
    role: msg.direction === 'incoming' ? ('user' as const) : ('model' as const),
    parts: [{ text: msg.message }],
  }));

  // Gemini requires `history[0].role === 'user'` — startChat throws
  // otherwise. Trim leading model entries until we hit a user message or
  // the history is empty.
  const firstUserIdx = mapped.findIndex((h) => h.role === 'user');
  const history = firstUserIdx === -1 ? [] : mapped.slice(firstUserIdx);

  const chat = model.startChat({ history });
  const result = await chat.sendMessage(newMessage);
  return result.response.text();
}

// ─── Audio transcription (voice notes) ──────────────────────────────────
//
// Indian SMB customers prefer voice notes over typing — especially in
// regional languages. We support TWO providers with the same priority
// order as text generation:
//
//   1. GROQ_API_KEY      → Groq Whisper (whisper-large-v3) — fast and
//                          handles Hindi/regional languages well via
//                          Whisper's multilingual training.
//   2. GEMINI_API_KEY    → Gemini 2.5 Flash multimodal (inlineData).
//
// Output is plain text in the speaker's original language (no
// translation) so the existing AI reply path can treat it like typed
// input. WhatsApp voice notes are OGG/Opus — both providers accept
// this format directly.

const GROQ_WHISPER_MODEL = process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3';

export async function transcribeAudio(
  base64: string,
  mimeType: string
): Promise<string> {
  if (process.env.GROQ_API_KEY) {
    return transcribeWithGroq(base64, mimeType);
  }
  if (process.env.GEMINI_API_KEY) {
    return transcribeWithGemini(base64, mimeType);
  }
  throw new Error(
    '[transcribeAudio] No provider key configured. Set GROQ_API_KEY (preferred) or GEMINI_API_KEY for voice-note support.'
  );
}

async function transcribeWithGroq(base64: string, mimeType: string): Promise<string> {
  // Groq's Whisper endpoint is OpenAI-compatible: multipart/form-data
  // with a `file` field (binary audio) plus `model`. We don't pass
  // `language` so Whisper auto-detects — it handles Hindi, Hinglish,
  // Tamil, Telugu, Marathi, Gujarati, Bengali, Punjabi, etc. natively.
  const buf = Buffer.from(base64, 'base64');
  const cleanMime = mimeType.split(';')[0].trim() || 'audio/ogg';
  // Pick a sensible filename extension from the MIME type — Groq uses
  // it as a hint for the audio decoder. Default to .ogg (WhatsApp voice).
  const extMap: Record<string, string> = {
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/mp4': 'm4a',
    'audio/m4a': 'm4a',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/aac': 'aac',
  };
  const ext = extMap[cleanMime] || 'ogg';

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buf)], { type: cleanMime }), `voice.${ext}`);
  form.append('model', GROQ_WHISPER_MODEL);
  // verbose_json gets us a `text` field plus segment metadata; plain
  // 'json' is fine — we only need text. We don't use 'text' format
  // because Groq sometimes wraps in extra characters.
  form.append('response_format', 'json');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`[groq-whisper] ${res.status} ${res.statusText}: ${errText.slice(0, 200)}`);
  }
  const data = (await res.json()) as { text?: string };
  const text = (data.text || '').trim();
  if (!text) {
    throw new Error('[groq-whisper] empty transcript');
  }
  return text;
}

async function transcribeWithGemini(base64: string, mimeType: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  // Normalize WhatsApp's "audio/ogg; codecs=opus" to the bare MIME Gemini
  // accepts. Gemini's audio input wants the base type without parameters.
  const cleanMime = mimeType.split(';')[0].trim() || 'audio/ogg';

  const result = await model.generateContent([
    {
      inlineData: {
        data: base64,
        mimeType: cleanMime,
      },
    },
    {
      text:
        'Transcribe this audio message verbatim. Return ONLY the transcribed text in the speaker\'s original language ' +
        '(do NOT translate to English). If the speaker uses Hinglish (Hindi+English mixed), keep it Hinglish. ' +
        'If pure Hindi, return Devanagari. If pure English, return English. ' +
        'No prefacing, no commentary, no quotes — just the words.',
    },
  ]);
  const text = result.response.text().trim();
  if (!text) {
    throw new Error('[gemini-transcribe] empty transcript');
  }
  return text;
}
