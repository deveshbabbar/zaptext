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

  const history = conversationHistory.map((msg) => ({
    role: msg.direction === 'incoming' ? 'user' as const : 'model' as const,
    parts: [{ text: msg.message }],
  }));

  const chat = model.startChat({ history });
  const result = await chat.sendMessage(newMessage);
  return result.response.text();
}
