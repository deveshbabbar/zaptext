import { getAllClients } from './google-sheets';
import { ClientRow } from './types';

export async function getBotsByOwner(userId: string): Promise<ClientRow[]> {
  const all = await getAllClients();
  return all.filter((c) => c.owner_user_id === userId);
}

export async function getBotByIdForOwner(
  botId: string,
  userId: string
): Promise<ClientRow | null> {
  const all = await getAllClients();
  return all.find((c) => c.client_id === botId && c.owner_user_id === userId) || null;
}

export async function getFirstBotForOwner(userId: string): Promise<ClientRow | null> {
  const bots = await getBotsByOwner(userId);
  return bots[0] || null;
}
