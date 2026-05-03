import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConversationRow } from './types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function generateBotResponse(
  systemPrompt: string,
  conversationHistory: ConversationRow[],
  newMessage: string
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: systemPrompt,
  });

  const mapped = conversationHistory.map((msg) => ({
    role: msg.direction === 'incoming' ? 'user' as const : 'model' as const,
    parts: [{ text: msg.message }],
  }));

  // Gemini requires `history[0].role === 'user'` — startChat throws
  // otherwise. After the Neon cutover we started returning the full last-N
  // history reliably, which surfaced this latent bug: if the chat happened
  // to begin with an outgoing/bot message (e.g. an admin owner-command
  // reply, or a stray welcome message logged before the customer wrote
  // back), the conversation has a leading `model` entry. Trim those off
  // until either we hit a user entry or the history is empty.
  const firstUserIdx = mapped.findIndex((h) => h.role === 'user');
  const history = firstUserIdx === -1 ? [] : mapped.slice(firstUserIdx);

  const chat = model.startChat({ history });
  const result = await chat.sendMessage(newMessage);
  return result.response.text();
}
