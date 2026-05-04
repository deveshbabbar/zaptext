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
