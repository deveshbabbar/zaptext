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

// Defense-in-depth admin allowlist. Set in env as:
//   ADMIN_EMAIL_ALLOWLIST="alice@zaptext.shop,bob@zaptext.shop"
// When set, only users whose primary email is on this list can hold
// the `admin` role even if Clerk's publicMetadata.role says "admin".
// When UNSET, role comes from Clerk metadata alone — backward
// compatible, no rollout breakage if the env isn't configured yet.
//
// Protects against: misconfigured Clerk dashboard, accidental
// metadata writes, test users with role:'admin' bleeding into prod,
// and any future leak path that lets someone flip the metadata flag.
const ADMIN_EMAIL_ALLOWLIST: Set<string> | null = (() => {
  const raw = (process.env.ADMIN_EMAIL_ALLOWLIST || '').trim();
  if (!raw) return null;
  const list = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.includes('@'));
  return list.length > 0 ? new Set(list) : null;
})();

export async function getUserRole(): Promise<UserInfo | null> {
  const user = await currentUser();
  if (!user) return null;
  const meta = user.publicMetadata as Record<string, string>;
  let role = (meta.role as 'admin' | 'client') || 'client';
  const email = user.emailAddresses[0]?.emailAddress || '';

  if (role === 'admin' && ADMIN_EMAIL_ALLOWLIST && !ADMIN_EMAIL_ALLOWLIST.has(email.toLowerCase())) {
    console.warn('[auth] demoting admin → client; email not in ADMIN_EMAIL_ALLOWLIST', {
      userId: user.id,
      email,
    });
    role = 'client';
  }

  return {
    userId: user.id,
    role,
    email,
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
