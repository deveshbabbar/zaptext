// Team members helper — outlet manager invites, revokes, and email swaps.
//
// Data invariant: outlet data (orders, menu, tables, customer history)
// is keyed on (owner_client_id, outlet_id) — NEVER on manager email.
// Manager email is just an auth identity. Swapping emails (revoking
// old + inserting new) is a no-op for outlet data; the new manager
// walks into the same dataset under a new login.
//
// Status lifecycle:
//   invited → active   (when manager signs in via Clerk for the first
//                      time after invite; today auto-flipped on first
//                      successful access — Clerk webhook hook not yet
//                      wired, so newly-invited managers behave as
//                      'active' as soon as their email logs in)
//   active  → revoked  (owner-initiated)
//   invited → revoked  (owner cancels before manager accepts)
//
// We never DELETE rows — keeping revoked rows is the audit trail under
// DPDPA §8(6) ("reasonable expectation that you can demonstrate who
// had access to data at any past time").

import { db } from '@/lib/db';
import { team_members } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';

export type TeamMemberRole = 'outlet_manager' | 'staff';
export type TeamMemberStatus = 'invited' | 'active' | 'revoked';

export interface TeamMemberRow {
  id: string;
  owner_client_id: string;
  email: string;
  role: TeamMemberRole;
  outlet_id: string;
  status: TeamMemberStatus;
  invited_at: Date;
  accepted_at: Date | null;
  revoked_at: Date | null;
  invited_by_email: string;
}

function normEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Lists team members for an owner. Default returns ONLY active +
 * invited (the working set). Pass `{ includeRevoked: true }` to get
 * the full audit trail.
 */
export async function listTeamMembersForOwner(
  ownerClientId: string,
  options: { includeRevoked?: boolean } = {}
): Promise<TeamMemberRow[]> {
  const rows = await db
    .select()
    .from(team_members)
    .where(eq(team_members.owner_client_id, ownerClientId))
    .orderBy(team_members.invited_at);

  return rows.map((r) => ({
    id: r.id,
    owner_client_id: r.owner_client_id,
    email: r.email,
    role: r.role as TeamMemberRole,
    outlet_id: r.outlet_id,
    status: r.status as TeamMemberStatus,
    invited_at: new Date(r.invited_at),
    accepted_at: r.accepted_at ? new Date(r.accepted_at) : null,
    revoked_at: r.revoked_at ? new Date(r.revoked_at) : null,
    invited_by_email: r.invited_by_email || '',
  })).filter((r) => options.includeRevoked ? true : r.status !== 'revoked');
}

/**
 * Returns the SINGLE active manager row for a given outlet, if any.
 * Used by per-outlet notification routing — only one manager is
 * authoritative per outlet at any time.
 */
export async function getActiveManagerForOutlet(
  ownerClientId: string,
  outletId: string
): Promise<TeamMemberRow | null> {
  const rows = await db
    .select()
    .from(team_members)
    .where(
      and(
        eq(team_members.owner_client_id, ownerClientId),
        eq(team_members.outlet_id, outletId),
        sql`${team_members.status} IN ('invited', 'active')`
      )
    )
    .limit(1);

  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    owner_client_id: r.owner_client_id,
    email: r.email,
    role: r.role as TeamMemberRole,
    outlet_id: r.outlet_id,
    status: r.status as TeamMemberStatus,
    invited_at: new Date(r.invited_at),
    accepted_at: r.accepted_at ? new Date(r.accepted_at) : null,
    revoked_at: r.revoked_at ? new Date(r.revoked_at) : null,
    invited_by_email: r.invited_by_email || '',
  };
}

/**
 * Login-time check: given an email, return all (owner_client_id,
 * outlet_id, role) tuples this email currently has access to.
 * Used by auth middleware to scope dashboard queries.
 */
export async function findActiveMembershipForEmail(email: string): Promise<TeamMemberRow[]> {
  const normalised = normEmail(email);
  const rows = await db
    .select()
    .from(team_members)
    .where(
      and(
        eq(team_members.email, normalised),
        sql`${team_members.status} IN ('invited', 'active')`
      )
    );

  return rows.map((r) => ({
    id: r.id,
    owner_client_id: r.owner_client_id,
    email: r.email,
    role: r.role as TeamMemberRole,
    outlet_id: r.outlet_id,
    status: r.status as TeamMemberStatus,
    invited_at: new Date(r.invited_at),
    accepted_at: r.accepted_at ? new Date(r.accepted_at) : null,
    revoked_at: r.revoked_at ? new Date(r.revoked_at) : null,
    invited_by_email: r.invited_by_email || '',
  }));
}

interface InviteOptions {
  ownerClientId: string;
  email: string;
  role: TeamMemberRole;
  outletId: string;
  invitedByEmail: string;
}

/**
 * Invites a new team member for an outlet. If there's already an
 * active/invited member for this (owner, outlet), throws — caller
 * must explicitly swap (revoke + insert) instead. This prevents an
 * outlet from accidentally having two managers thinking they're in
 * charge.
 */
export async function inviteOutletManager(opts: InviteOptions): Promise<TeamMemberRow> {
  const existing = await getActiveManagerForOutlet(opts.ownerClientId, opts.outletId);
  if (existing) {
    throw new Error(
      `Outlet "${opts.outletId}" already has a manager (${existing.email}). Use swapOutletManagerEmail to replace.`
    );
  }
  const id = `tm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  await db.insert(team_members).values({
    id,
    owner_client_id: opts.ownerClientId,
    email: normEmail(opts.email),
    role: opts.role,
    outlet_id: opts.outletId,
    status: 'invited',
    invited_by_email: normEmail(opts.invitedByEmail),
  });
  const created = await getActiveManagerForOutlet(opts.ownerClientId, opts.outletId);
  if (!created) throw new Error('Insert succeeded but lookup failed — DB inconsistency');
  return created;
}

/**
 * Revokes a member's access by id. Owner-initiated; never deletes.
 */
export async function revokeMember(id: string): Promise<void> {
  await db
    .update(team_members)
    .set({ status: 'revoked', revoked_at: new Date() })
    .where(eq(team_members.id, id));
}

/**
 * Atomic outlet-manager email swap. Revokes the existing active
 * manager (if any) and inserts a new invited row in one logical
 * operation. ALL outlet data is preserved because data is keyed on
 * (owner_client_id, outlet_id), not on email.
 *
 * Returns the new team_member row.
 */
export async function swapOutletManagerEmail(opts: {
  ownerClientId: string;
  outletId: string;
  newEmail: string;
  role: TeamMemberRole;
  invitedByEmail: string;
}): Promise<TeamMemberRow> {
  const existing = await getActiveManagerForOutlet(opts.ownerClientId, opts.outletId);
  if (existing) {
    await revokeMember(existing.id);
  }
  return inviteOutletManager({
    ownerClientId: opts.ownerClientId,
    email: opts.newEmail,
    role: opts.role,
    outletId: opts.outletId,
    invitedByEmail: opts.invitedByEmail,
  });
}

/**
 * Marks an invite as accepted (called from auth middleware on first
 * successful login by an 'invited' member's email).
 */
export async function markMemberAccepted(id: string): Promise<void> {
  await db
    .update(team_members)
    .set({ status: 'active', accepted_at: new Date() })
    .where(eq(team_members.id, id));
}
