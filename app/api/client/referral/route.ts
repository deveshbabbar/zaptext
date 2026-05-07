// ─── Referral info endpoint ───
//
// GET /api/client/referral
//
// Returns the signed-in user's deterministic referral code + share link
// so the /client/subscription page can render a "share & earn" panel.

import { NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { generateReferralCode, buildReferralLink } from '@/lib/referral';
import { clerkClient } from '@clerk/nextjs/server';

export async function GET() {
  const user = await getUserRole();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const code = generateReferralCode(user.userId);
  const shareLink = buildReferralLink(code);

  // Look up "who referred me" from Clerk publicMetadata so the panel
  // can show "You were referred by SOMEONE — once your first paid
  // month renews, they get a free month too." Optional — if not set
  // (organic signup), we just don't show the message.
  let referredBy: string | undefined;
  try {
    const cc = await clerkClient();
    const me = await cc.users.getUser(user.userId);
    const meta = (me.publicMetadata || {}) as Record<string, unknown>;
    if (typeof meta.referredBy === 'string' && meta.referredBy.trim()) {
      referredBy = meta.referredBy.trim();
    }
  } catch (e) {
    console.error('[referral] failed to read clerk metadata:', e);
  }

  return NextResponse.json({ code, shareLink, referredBy });
}
