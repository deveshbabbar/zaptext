// /api/client/restaurant/team
//
// Owner-only CRUD on the team_members table for outlet manager
// assignments. See lib/db/team-members.ts for the invariants
// (data keyed on outlet_id, never on email — email swap preserves
// all per-outlet data).
//
// GET    → list active + invited team members for this owner
// POST   → invite a new outlet manager (errors if outlet already
//          has an active manager — owner must PATCH-swap instead)
// PATCH  → swap manager email for a given outlet (revoke + invite
//          atomically — outlet data preserved)
// DELETE → revoke a specific team_member row by id

import { NextRequest, NextResponse } from 'next/server';
import { requireClientWithBots } from '@/lib/auth';
import {
  listTeamMembersForOwner,
  inviteOutletManager,
  revokeMember,
  swapOutletManagerEmail,
  type TeamMemberRole,
} from '@/lib/db/team-members';

function validEmail(s: string): boolean {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function GET() {
  const user = await requireClientWithBots().catch(() => null);
  if (!user || !user.activeBot || user.activeBot.type !== 'restaurant') {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const members = await listTeamMembersForOwner(user.activeBot.client_id);
  return NextResponse.json({ ok: true, members });
}

export async function POST(request: NextRequest) {
  const user = await requireClientWithBots().catch(() => null);
  if (!user || !user.activeBot || user.activeBot.type !== 'restaurant') {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  let body: { email?: string; outletId?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  if (!validEmail(body.email || '')) {
    return NextResponse.json({ ok: false, error: 'Valid email required' }, { status: 400 });
  }
  if (!body.outletId) {
    return NextResponse.json({ ok: false, error: 'outletId required' }, { status: 400 });
  }
  const role: TeamMemberRole = body.role === 'staff' ? 'staff' : 'outlet_manager';
  try {
    const created = await inviteOutletManager({
      ownerClientId: user.activeBot.client_id,
      email: body.email!,
      role,
      outletId: body.outletId,
      invitedByEmail: user.email,
    });
    return NextResponse.json({ ok: true, member: created });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Invite failed' },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const user = await requireClientWithBots().catch(() => null);
  if (!user || !user.activeBot || user.activeBot.type !== 'restaurant') {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  let body: { outletId?: string; newEmail?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.outletId) {
    return NextResponse.json({ ok: false, error: 'outletId required' }, { status: 400 });
  }
  if (!validEmail(body.newEmail || '')) {
    return NextResponse.json({ ok: false, error: 'Valid newEmail required' }, { status: 400 });
  }
  const role: TeamMemberRole = body.role === 'staff' ? 'staff' : 'outlet_manager';
  try {
    const created = await swapOutletManagerEmail({
      ownerClientId: user.activeBot.client_id,
      outletId: body.outletId,
      newEmail: body.newEmail!,
      role,
      invitedByEmail: user.email,
    });
    return NextResponse.json({ ok: true, member: created });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Swap failed' },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const user = await requireClientWithBots().catch(() => null);
  if (!user || !user.activeBot || user.activeBot.type !== 'restaurant') {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ ok: false, error: 'id query param required' }, { status: 400 });
  }
  await revokeMember(id);
  return NextResponse.json({ ok: true });
}
