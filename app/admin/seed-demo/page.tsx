// /admin/seed-demo — one-click seeder for the dbabbar demo account.
// Drops 7 demo bots (Restaurant, Coaching, Real Estate, Salon, Tiffin,
// Ecommerce, Grocery) into the chosen Clerk user's account. Gym is
// unchecked by default because the dbabbar account already has a real
// "Gym Time Fitness" bot — the admin doesn't want it overwritten.

'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageTopbar, PageHead, Panel, Pill } from '@/components/app/primitives';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { BUSINESS_TYPES } from '@/lib/constants';

const SEEDABLE = BUSINESS_TYPES.filter((bt) => !bt.hidden);

export default function SeedDemoPage() {
  const [ownerUserId, setOwnerUserId] = useState('');
  const [ownerName, setOwnerName] = useState('Devesh Babbar');
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const bt of SEEDABLE) map[bt.type] = bt.type !== 'gym';
    return map;
  });
  const [seeding, setSeeding] = useState(false);
  const [result, setResult] = useState<{ created?: number; skipped?: number; details?: unknown } | null>(null);

  async function handleSeed() {
    const owner = ownerUserId.trim();
    if (!owner) {
      toast.error('Enter the Clerk user ID first');
      return;
    }
    const verticals = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    if (verticals.length === 0) {
      toast.error('Pick at least one vertical');
      return;
    }
    setSeeding(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/demo/seed-bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerUserId: owner, ownerName, verticals }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; created?: unknown[]; skipped?: unknown[]; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || `Seed failed (${res.status})`);
      const c = Array.isArray(data.created) ? data.created.length : 0;
      const s = Array.isArray(data.skipped) ? data.skipped.length : 0;
      setResult({ created: c, skipped: s, details: data });
      toast.success(`Created ${c} demo bot${c === 1 ? '' : 's'}${s > 0 ? `, skipped ${s}` : ''}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Seed failed');
    } finally {
      setSeeding(false);
    }
  }

  return (
    <>
      <PageTopbar crumbs={<>Admin / <b className="text-foreground">Seed demo bots</b></>} />
      <div style={{ padding: '28px 32px 60px', maxWidth: 760 }}>
        <PageHead
          title={<>Seed <span className="zt-serif">demo bots.</span></>}
          sub="Drops one fully-populated demo bot per vertical into the chosen Clerk user's account. Uses placeholder phone numbers — only for showing the CLIENT DASHBOARD with realistic data per vertical. Bots are idempotent by (owner + business_name); re-running is safe."
        />

        <Panel title="Target owner">
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Clerk user ID (the owner_user_id field)</Label>
              <Input
                value={ownerUserId}
                onChange={(e) => setOwnerUserId(e.target.value)}
                placeholder="user_2abc...xyz"
              />
              <p className="text-[10.5px] text-muted-foreground mt-1">
                Find this on /admin/clients/[id] — it&apos;s the owner_user_id shown for any bot you already own.
              </p>
            </div>
            <div>
              <Label className="text-xs">Owner name (cosmetic — appears as owner_name on each demo bot)</Label>
              <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Devesh Babbar" />
            </div>
          </div>
        </Panel>

        <div style={{ height: 14 }} />

        <Panel title="Verticals to seed" sub="Each vertical gets a unique business identity with rich KB data — menu, listings, plans, products, etc.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {SEEDABLE.map((bt) => (
              <label key={bt.type} className="flex items-center gap-3 px-3 py-2 rounded-[10px] border border-[var(--line)] cursor-pointer hover:border-[var(--ink)] transition">
                <Switch
                  checked={!!selected[bt.type]}
                  onCheckedChange={(v) => setSelected((s) => ({ ...s, [bt.type]: !!v }))}
                />
                <span className="text-sm flex-1">
                  {bt.icon} {bt.label}
                </span>
                {bt.type === 'gym' && (
                  <span className="text-[10px] text-amber-700 zt-mono">SKIP — real bot lives here</span>
                )}
              </label>
            ))}
          </div>
        </Panel>

        <div className="flex items-center gap-3 mt-5">
          <Pill variant="ink" onClick={handleSeed} disabled={seeding || !ownerUserId.trim()}>
            {seeding ? 'Seeding…' : 'Seed selected verticals'}
          </Pill>
          {result && (
            <span className="text-sm text-muted-foreground">
              Created <b className="text-foreground">{result.created || 0}</b> · Skipped <b className="text-foreground">{result.skipped || 0}</b>
            </span>
          )}
        </div>

        {result && (
          <Panel title="Result" className="mt-5">
            <pre className="text-[11px] zt-mono whitespace-pre-wrap overflow-x-auto" style={{ maxHeight: 320 }}>
              {JSON.stringify(result.details, null, 2)}
            </pre>
            <p className="text-xs text-muted-foreground mt-2">
              The seeded bots show up immediately under that owner&apos;s /client/bots and /client/dashboard.
              They share placeholder WhatsApp numbers and won&apos;t receive real messages.
            </p>
          </Panel>
        )}
      </div>
    </>
  );
}
