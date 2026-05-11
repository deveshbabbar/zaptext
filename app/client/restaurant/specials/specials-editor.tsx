'use client';

// Daily specials editor for the Restaurant client workspace. Edits the
// dailySpecial / specialOffers / currentOffers fields inside the bot's
// knowledge_base — same fields the onboarding form writes, so the bot
// already knows how to quote them.

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageTopbar, PageHead, Pill, Panel } from '@/components/app/primitives';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SettingsResponse {
  knowledgeBase: string;
}

export function SpecialsEditor({ businessName }: { businessName: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [kb, setKb] = useState<Record<string, unknown>>({});
  const [dailySpecial, setDailySpecial] = useState('');
  const [specialOffers, setSpecialOffers] = useState('');
  const [currentOffers, setCurrentOffers] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/client/settings');
        if (!res.ok) throw new Error(`load failed (${res.status})`);
        const data = (await res.json()) as SettingsResponse;
        const parsed = data.knowledgeBase ? JSON.parse(data.knowledgeBase) : {};
        setKb(parsed);
        setDailySpecial(typeof parsed.dailySpecial === 'string' ? parsed.dailySpecial : '');
        setSpecialOffers(typeof parsed.specialOffers === 'string' ? parsed.specialOffers : '');
        setCurrentOffers(typeof parsed.currentOffers === 'string' ? parsed.currentOffers : '');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not load specials');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const nextKb = { ...kb, dailySpecial, specialOffers, currentOffers };
      const res = await fetch('/api/client/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulk: { knowledge_base_json: JSON.stringify(nextKb) } }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.message || data.error || `save failed (${res.status})`);
      setKb(nextKb);
      setDirty(false);
      toast.success('Specials updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '60px 32px' }}>
        <p className="text-sm text-muted-foreground">Loading specials…</p>
      </div>
    );
  }

  return (
    <>
      <PageTopbar
        crumbs={
          <>
            Restaurant /{' '}
            <a href="/client/restaurant" className="hover:underline">
              Overview
            </a>{' '}
            / <b className="text-foreground">Specials</b>
          </>
        }
        actions={
          <Pill variant="ink" onClick={handleSave} disabled={!dirty || saving}>
            {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </Pill>
        }
      />
      <div style={{ padding: '28px 32px 80px' }}>
        <PageHead
          title={
            <>
              {businessName} <span className="zt-serif">specials.</span>
            </>
          }
          sub="Edit today's headline offer + ongoing promotions. The bot quotes these when customers ask about deals."
        />

        <div className="space-y-4 max-w-3xl">
          <Panel
            title="Today's special"
            sub="One short line. Shown when customer asks `aaj kya special hai?`."
          >
            <Label className="text-xs">Headline</Label>
            <Input
              value={dailySpecial}
              onChange={(e) => { setDailySpecial(e.target.value); setDirty(true); }}
              placeholder="Tandoori Chicken — 20% off today only"
              className="mt-1"
            />
          </Panel>

          <Panel
            title="Ongoing offers"
            sub="Multi-line. Combos, weekday discounts, party-pack offers."
          >
            <Label className="text-xs">Offers</Label>
            <Textarea
              value={specialOffers}
              onChange={(e) => { setSpecialOffers(e.target.value); setDirty(true); }}
              placeholder={'• Family pack: Veg Thali x4 + Gulab Jamun — Rs.899\n• Weekday lunch: 15% off on all biryanis (Mon-Thu)\n• Birthday: free dessert on showing ID'}
              rows={6}
              className="font-mono text-xs mt-1"
            />
          </Panel>

          <Panel
            title="Current offers (alternate field)"
            sub="Some menus already populated `currentOffers`. Edit it here too so both stay in sync."
          >
            <Label className="text-xs">Current offers</Label>
            <Textarea
              value={currentOffers}
              onChange={(e) => { setCurrentOffers(e.target.value); setDirty(true); }}
              placeholder="Buy 2 Get 1 free on starters · 10% off on bills above Rs.999"
              rows={3}
              className="text-xs mt-1"
            />
          </Panel>
        </div>
      </div>
    </>
  );
}
