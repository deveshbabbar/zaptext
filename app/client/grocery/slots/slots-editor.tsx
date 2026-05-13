'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageTopbar, PageHead, Pill, Panel } from '@/components/app/primitives';
import type { GrocerySlot } from '@/lib/grocery/types';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  businessName: string;
  initialSlots: GrocerySlot[];
}

export function SlotsEditor({ businessName, initialSlots }: Props) {
  const [slots, setSlots] = useState<GrocerySlot[]>(initialSlots);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    label: '',
    start_time: '09:00',
    end_time: '12:00',
    cutoff_time: '08:00',
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
    is_active: true,
  });

  function toggleDayDraft(d: number) {
    setDraft((p) => ({
      ...p,
      days_of_week: p.days_of_week.includes(d) ? p.days_of_week.filter((x) => x !== d) : [...p.days_of_week, d].sort(),
    }));
  }

  async function addSlot() {
    if (!draft.label.trim()) { toast.error('Label required'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/grocery/slots', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed');
      setSlots((prev) => [...prev, data.slot]);
      setDraft({ label: '', start_time: '09:00', end_time: '12:00', cutoff_time: '08:00', days_of_week: [0,1,2,3,4,5,6], is_active: true });
      toast.success(`Slot "${data.slot.label}" added`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setCreating(false);
    }
  }

  async function patchSlot(id: string, patch: Partial<GrocerySlot>) {
    try {
      const res = await fetch(`/api/grocery/slots/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Update failed');
      setSlots((prev) => prev.map((s) => s.id === id ? { ...s, ...patch } as GrocerySlot : s));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function removeSlot(id: string, label: string) {
    if (!window.confirm(`Remove slot "${label}"?`)) return;
    try {
      const res = await fetch(`/api/grocery/slots/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setSlots((prev) => prev.filter((s) => s.id !== id));
      toast.success(`${label} removed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  const fieldCls = 'w-full rounded-[10px] border border-[var(--line)] bg-[var(--card)] focus:border-[var(--ink)] focus:outline-none text-[13.5px]';
  const fStyle = { padding: '8px 10px' };

  return (
    <>
      <PageTopbar
        crumbs={<>Grocery / <a href="/client/grocery" className="hover:underline">Overview</a> / <b className="text-foreground">Delivery slots</b></>}
      />
      <div style={{ padding: '28px 32px 80px' }}>
        <PageHead
          title={<>{businessName} <span className="zt-serif">delivery slots.</span></>}
          sub={`${slots.length} slots. Cutoff is the latest the bot will accept an order for that slot (e.g. 08:00 for 9–12 morning slot).`}
        />

        <Panel title="Add slot" className="mb-5">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <div className="md:col-span-3">
              <div className="text-[12.5px] font-semibold mb-1.5">Label *</div>
              <input className={fieldCls} style={fStyle} placeholder="Morning"
                value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <div className="text-[12.5px] font-semibold mb-1.5">Start</div>
              <input type="time" className={fieldCls} style={fStyle}
                value={draft.start_time} onChange={(e) => setDraft((d) => ({ ...d, start_time: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <div className="text-[12.5px] font-semibold mb-1.5">End</div>
              <input type="time" className={fieldCls} style={fStyle}
                value={draft.end_time} onChange={(e) => setDraft((d) => ({ ...d, end_time: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <div className="text-[12.5px] font-semibold mb-1.5">Cutoff</div>
              <input type="time" className={fieldCls} style={fStyle}
                value={draft.cutoff_time} onChange={(e) => setDraft((d) => ({ ...d, cutoff_time: e.target.value }))} />
            </div>
            <div className="md:col-span-3">
              <div className="text-[12.5px] font-semibold mb-1.5">Days</div>
              <div className="flex gap-1">
                {DAY_LABELS.map((lbl, i) => {
                  const on = draft.days_of_week.includes(i);
                  return (
                    <button key={i} type="button" onClick={() => toggleDayDraft(i)}
                      className="rounded-full text-[12px] font-bold flex-1"
                      title={DAY_NAMES[i]}
                      style={{
                        padding: '6px 0',
                        border: '1px solid ' + (on ? 'var(--ink)' : 'var(--line)'),
                        background: on ? 'var(--ink)' : 'transparent',
                        color: on ? 'var(--card)' : 'var(--ink)',
                      }}>
                      {lbl}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Pill variant="ink" onClick={addSlot} disabled={creating || !draft.label.trim()}>
              {creating ? 'Adding…' : '+ Add slot'}
            </Pill>
          </div>
        </Panel>

        <div className="flex flex-col gap-3">
          {slots.length === 0 ? (
            <Panel title="No slots yet" sub="Add at least one slot — bot needs this to schedule deliveries.">
              <div />
            </Panel>
          ) : slots.map((s) => (
            <Panel key={s.id} title={s.label} action={
              <div className="flex gap-2">
                <button onClick={() => patchSlot(s.id, { is_active: !s.is_active })}
                  className="text-xs rounded-[6px] border" style={{
                    padding: '4px 10px',
                    borderColor: s.is_active ? '#16a34a' : 'var(--line)',
                    color: s.is_active ? '#16a34a' : 'var(--mute)',
                  }}>
                  {s.is_active ? 'Active' : 'Inactive'}
                </button>
                <button onClick={() => removeSlot(s.id, s.label)}
                  className="text-xs text-muted-foreground hover:text-destructive">Remove</button>
              </div>
            }>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                <div className="md:col-span-3">
                  <div className="text-[11.5px] font-semibold mb-1">Label</div>
                  <input className={fieldCls} style={fStyle} defaultValue={s.label}
                    onBlur={(e) => e.target.value !== s.label && patchSlot(s.id, { label: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <div className="text-[11.5px] font-semibold mb-1">Start</div>
                  <input type="time" className={fieldCls} style={fStyle} defaultValue={s.start_time}
                    onBlur={(e) => patchSlot(s.id, { start_time: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <div className="text-[11.5px] font-semibold mb-1">End</div>
                  <input type="time" className={fieldCls} style={fStyle} defaultValue={s.end_time}
                    onBlur={(e) => patchSlot(s.id, { end_time: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <div className="text-[11.5px] font-semibold mb-1">Cutoff</div>
                  <input type="time" className={fieldCls} style={fStyle} defaultValue={s.cutoff_time}
                    onBlur={(e) => patchSlot(s.id, { cutoff_time: e.target.value })} />
                </div>
                <div className="md:col-span-3">
                  <div className="text-[11.5px] font-semibold mb-1">Days</div>
                  <div className="flex gap-1">
                    {DAY_LABELS.map((lbl, i) => {
                      const on = s.days_of_week.includes(i);
                      return (
                        <button key={i} type="button"
                          onClick={() => {
                            const next = on ? s.days_of_week.filter((d) => d !== i) : [...s.days_of_week, i].sort();
                            patchSlot(s.id, { days_of_week: next });
                          }}
                          className="rounded-full text-[12px] font-bold flex-1"
                          title={DAY_NAMES[i]}
                          style={{
                            padding: '6px 0',
                            border: '1px solid ' + (on ? 'var(--ink)' : 'var(--line)'),
                            background: on ? 'var(--ink)' : 'transparent',
                            color: on ? 'var(--card)' : 'var(--ink)',
                          }}>
                          {lbl}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      </div>
    </>
  );
}
