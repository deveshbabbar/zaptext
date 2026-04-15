import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { resolveActiveBot } from './active-bot';
import { getBotsByOwner } from './owner-clients';
import { ClientRow } from './types';

export interface UserInfo {
  userId: string;
  role: 'admin' | 'client';
  email: string;
  name: string;
  clientId?: string;
  businessName?: string;
  businessType?: string;
}

export interface ClientUserInfo extends UserInfo {
  activeBot: ClientRow | null;
  allBots: ClientRow[];
}

export async function getUserRole(): Promise<UserInfo | null> {
  const user = await currentUser();
  if (!user) return null;
  const meta = user.publicMetadata as Record<string, string>;
  const role = (meta.role as 'admin' | 'client') || 'client';
  return {
    userId: user.id,
    role,
    email: user.emailAddresses[0]?.emailAddress || '',
    name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
  };
}

export async function requireAdmin(): Promise<UserInfo> {
  const user = await getUserRole();
  if (!user || user.role !== 'admin') {
    redirect('/sign-in');
  }
  return user;
}

export async function requireClientWithBots(): Promise<ClientUserInfo> {
  const user = await getUserRole();
  if (!user) redirect('/sign-in');
  if (user.role !== 'client' && user.role !== 'admin') redirect('/sign-in');

  const allBots = await getBotsByOwner(user.userId);
  const activeBot = await resolveActiveBot(user.userId);
  return { ...user, activeBot, allBots };
}

export async function requireClient(): Promise<UserInfo> {
  const user = await getUserRole();
  if (!user) redirect('/sign-in');
  if (user.role !== 'client' && user.role !== 'admin') redirect('/sign-in');
  return user;
}
