import { cookies } from 'next/headers';
import { getBotByIdForOwner, getFirstBotForOwner } from './owner-clients';
import { ClientRow } from './types';

const COOKIE_NAME = 'active_bot_id';

export async function getActiveBotId(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value || null;
}

export async function setActiveBotId(botId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, botId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function resolveActiveBot(userId: string): Promise<ClientRow | null> {
  const botId = await getActiveBotId();
  if (botId) {
    const bot = await getBotByIdForOwner(botId, userId);
    if (bot) return bot;
  }
  return getFirstBotForOwner(userId);
}
