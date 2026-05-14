'use client';

// Team Members client — owner-only.
//
// Per-outlet card showing the active manager (if any) with:
//   - invite (empty outlets)
//   - swap email (active outlet) — uses PATCH which revokes + invites
//     atomically; outlet data stays intact because every row in
//     dine_in_orders / restaurant_tables / kb.outlets is keyed on
//     outlet_id, never on manager email
//   - revoke (active outlet, no replacement)
//
// Status badges:
//   invited  → manager hasn't signed in via Clerk yet
//   active   → has signed in
//   revoked  → no longer in the working set (audit trail; not shown
//             by default — server filters)

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageTopbar, PageHead, Panel } from '@/components/app/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TeamMember {
  id: string;
  email: string;
  role: 'outlet_manager' | 'staff';
  outlet_id: string;
  status: 'invited' | 'active' | 'revoked';
  invited_at: string;
  accepted_at: string | null;
}

interface OutletLite {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
}

export function TeamMembersClient({ businessName }: { businessName: string }) {
  const [loading, setLoading] = useState(true);
  const [outlets, setOutlets] = useState<OutletLite[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [busyOutlet, setBusyOutlet] = useState<string | null>(null);
  // Per-outlet input drafts: { [outletId]: { email, mode: 'invite' | 'swap' } }
  const [drafts, setDrafts] = useState<Record<string, { email: string; mode: 'invite' | 'swap' }>>({});

  async function refresh() {
    setLoading(true);
    try {
      const [oRes, mRes] = await Promise.all([
        fetch('/api/client/restaurant/outlets'),
        fetch('/api/client/restaurant/team'),
      ]);
      const oJson = (await oRes.json()) as { ok: boolean; outlets?: OutletLite[] };
      const mJson = (await mRes.json()) as { ok: boolean; members?: TeamMember[] };
      if (oJson.ok) setOutlets(oJson.outlets || []);
      if (mJson.ok) setMembers(mJson.members || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function setDraft(outletId: string, patch: Partial<{ email: string; mode: 'invite' | 'swap' }>) {
    setDrafts((d) => {
      const existing = d[outletId] || { email: '', mode: 'invite' as const };
      return {
        ...d,
        [outletId]: { ...existing, ...patch },
      };
    });
  }

  async function handleInvite(outletId: string) {
    const draft = drafts[outletId];
    if (!draft?.email) {
      toast.error('Enter an email first');
      return;
    }
    setBusyOutlet(outletId);
    try {
      const res = await fetch('/api/client/restaurant/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: draft.email, outletId, role: 'outlet_manager' }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) throw new Error(data.error || 'Invite failed');
      toast.success(`Invited ${draft.email}`);
      setDraft(outletId, { email: '' });
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setBusyOutlet(null);
    }
  }

  async function handleSwap(outletId: string) {
    const draft = drafts[outletId];
    if (!draft?.email) {
      toast.error('Enter the new manager email');
      return;
    }
    if (!confirm(
      `Swap this outlet's manager to ${draft.email}?\n\n` +
      `The current manager will lose access immediately. ALL outlet ` +
      `data (orders, menu, tables, history) stays intact.`
    )) return;

    setBusyOutlet(outletId);
    try {
      const res = await fetch('/api/client/restaurant/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outletId, newEmail: draft.email, role: 'outlet_manager' }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) throw new Error(data.error || 'Swap failed');
      toast.success(`Manager swapped to ${draft.email}`);
      setDraft(outletId, { email: '', mode: 'invite' });
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Swap failed');
    } finally {
      setBusyOutlet(null);
    }
  }

  async function handleRevoke(member: TeamMember) {
    if (!confirm(
      `Revoke access for ${member.email}?\n\n` +
      `They won't be able to log in. Outlet data is preserved — you ` +
      `can invite a new manager from the same form.`
    )) return;
    setBusyOutlet(member.outlet_id);
    try {
      const res = await fetch(`/api/client/restaurant/team?id=${encodeURIComponent(member.id)}`, {
        method: 'DELETE',
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) throw new Error(data.error || 'Revoke failed');
      toast.success('Access revoked');
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Revoke failed');
    } finally {
      setBusyOutlet(null);
    }
  }

  function memberForOutlet(outletId: string): TeamMember | undefined {
    return members.find((m) => m.outlet_id === outletId);
  }

  if (loading) {
    return (
      <div style={{ padding: '60px 32px' }}>
        <p className="text-sm text-muted-foreground">Loading team…</p>
      </div>
    );
  }

  const activeOutlets = outlets.filter((o) => o.isActive);

  return (
    <>
      <PageTopbar
        crumbs={
          <>
            Restaurant /{' '}
            <a href="/client/restaurant" className="hover:underline">Overview</a>
            {' '}/ <b className="text-foreground">Team Members</b>
          </>
        }
      />
      <div style={{ padding: '28px 32px 80px' }}>
        <PageHead
          title={
            <>
              {businessName}{' '}
              <span className="zt-serif">team.</span>
            </>
          }
          sub="Assign one manager per outlet. Manager email is just an auth identity — swap or revoke anytime; orders, menu, table data stay with the outlet."
        />

        {activeOutlets.length === 0 && (
          <Panel title="No active outlets">
            <p className="text-sm text-muted-foreground">
              Add an outlet first in{' '}
              <a href="/client/restaurant/outlets" className="underline">
                Settings → Outlets
              </a>
              .
            </p>
          </Panel>
        )}

        <div className="space-y-4">
          {activeOutlets.map((o) => {
            const member = memberForOutlet(o.id);
            const draft = drafts[o.id] || { email: '', mode: 'invite' as const };
            const isBusy = busyOutlet === o.id;

            return (
              <Panel
                key={o.id}
                title={
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{o.name}</span>
                    <span className="text-[10px] uppercase tracking-[.06em] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                      @{o.slug}
                    </span>
                  </div>
                }
              >
                {member ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="text-[14px] font-semibold truncate">{member.email}</div>
                        <div className="text-[11px] text-muted-foreground zt-mono">
                          {member.status === 'invited' && 'Invite sent — waiting for first sign-in'}
                          {member.status === 'active' && `Active — accepted ${member.accepted_at ? new Date(member.accepted_at).toLocaleDateString() : ''}`}
                        </div>
                      </div>
                      <span className={`text-[10px] uppercase tracking-[.06em] px-1.5 py-0.5 rounded ${
                        member.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {member.status}
                      </span>
                    </div>

                    <div className="flex gap-2 flex-wrap items-end pt-3 border-t border-border">
                      <div className="flex-1 min-w-[200px]">
                        <Label className="text-xs">New manager email (swap)</Label>
                        <Input
                          type="email"
                          placeholder="suresh.saket@example.com"
                          value={draft.email}
                          onChange={(e) => setDraft(o.id, { email: e.target.value, mode: 'swap' })}
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={() => handleSwap(o.id)}
                        disabled={isBusy || !draft.email}
                      >
                        {isBusy ? 'Swapping…' : 'Swap manager'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleRevoke(member)}
                        disabled={isBusy}
                      >
                        Revoke access
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Swap = current manager loses access + new manager gets invited. Outlet
                      data (orders, menu, tables, customer history) stays with the outlet,
                      not the email.
                    </p>
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap items-end">
                    <div className="flex-1 min-w-[200px]">
                      <Label className="text-xs">Outlet manager email</Label>
                      <Input
                        type="email"
                        placeholder="rohit.saket@example.com"
                        value={draft.email}
                        onChange={(e) => setDraft(o.id, { email: e.target.value, mode: 'invite' })}
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={() => handleInvite(o.id)}
                      disabled={isBusy || !draft.email}
                    >
                      {isBusy ? 'Inviting…' : 'Send invite'}
                    </Button>
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      </div>
    </>
  );
}
