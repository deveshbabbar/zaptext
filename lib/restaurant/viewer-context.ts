// Restaurant viewer context.
//
// Phase 3I v2. The original requireClientWithBots returns the bot the
// LOGGED-IN USER owns. For multi-outlet chains an outlet manager logs
// in with their OWN email (not the chain owner's), so the owner's
// active_bot isn't theirs — they need access to the chain owner's
// bot, scoped to ONE outlet.
//
// This helper resolves the right viewer context:
//   - Owner: { role: 'owner', activeBot, restrictedOutletId: null }
//   - Outlet manager: { role: 'outlet_manager', activeBot (owner's),
//                       restrictedOutletId: 'SAK_id' }
//   - Both: redirect to /sign-in if no bot/membership at all
//
// Pages call `requireRestaurantViewer()` once at the top, then pass
// `viewer.restrictedOutletId` into every data query (or skip the
// filter for owner). The same pattern keeps the existing single-
// outlet kitchens working unchanged — for them restrictedOutletId
// is always null.

import { redirect } from 'next/navigation';
import { requireClientWithBots, type ClientUserInfo } from '@/lib/auth';
import { findActiveMembershipForEmail, type TeamMemberRow } from '@/lib/db/team-members';
import { getClientById } from '@/lib/db/clients';
import type { ClientRow } from '@/lib/types';

export type ViewerRole = 'owner' | 'outlet_manager';

export interface RestaurantViewer {
  role: ViewerRole;
  /** The Clerk user's email — display only. */
  email: string;
  /** The CHAIN owner's bot row (so menu/orders/specials/etc. all
   *  hang off the right client_id whether the viewer is the owner
   *  or an outlet manager). */
  activeBot: ClientRow;
  /** All bots the LOGGED-IN user owns. Owners may have other bots;
   *  outlet managers usually have none, so this is empty for them. */
  ownBots: ClientRow[];
  /** When role === 'outlet_manager', the outlet_id they're scoped
   *  to. Otherwise null (owner sees all outlets). */
  restrictedOutletId: string | null;
  /** The team_members row backing this membership (outlet manager
   *  only). Null for owners. */
  membership: TeamMemberRow | null;
}

/**
 * Resolves the active restaurant context for whoever is currently
 * signed in. Three paths:
 *
 *   1. Logged-in user OWNS a restaurant bot → role='owner'.
 *   2. Logged-in user has a team_members membership for a restaurant
 *      bot → role='outlet_manager'. The owner's bot becomes the
 *      activeBot; restrictedOutletId is set from the membership.
 *   3. Neither → redirect to /client/dashboard (which then shows
 *      the empty state / new-bot prompt).
 *
 * If a user is BOTH (rare — they own a restaurant AND were invited
 * to manage an outlet of another chain), the OWNED bot wins. This
 * keeps the owner experience consistent + protects against an
 * accidental privilege drop.
 */
export async function requireRestaurantViewer(): Promise<RestaurantViewer> {
  const user: ClientUserInfo = await requireClientWithBots();

  // Path 1: they own a restaurant bot already.
  if (user.activeBot && user.activeBot.type === 'restaurant') {
    return {
      role: 'owner',
      email: user.email,
      activeBot: user.activeBot,
      ownBots: user.allBots,
      restrictedOutletId: null,
      membership: null,
    };
  }

  // Path 2: maybe they're an outlet manager for someone else's chain.
  if (user.email) {
    const memberships = await findActiveMembershipForEmail(user.email).catch(() => []);
    for (const m of memberships) {
      const ownerBot = await getClientById(m.owner_client_id).catch(() => null);
      if (ownerBot && ownerBot.type === 'restaurant') {
        return {
          role: 'outlet_manager',
          email: user.email,
          activeBot: ownerBot,
          ownBots: user.allBots,
          restrictedOutletId: m.outlet_id,
          membership: m,
        };
      }
    }
  }

  // Path 3: nothing applies — bounce to dashboard.
  redirect('/client/dashboard');
}

/** Boolean shortcut for "is this viewer allowed to see all outlets
 *  of the chain"? Outlet managers always answer false. */
export function viewerSeesAllOutlets(v: RestaurantViewer): boolean {
  return v.role === 'owner';
}
