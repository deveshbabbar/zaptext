'use client';
import { useState } from 'react';
import type { GrocerySlot } from '@/lib/grocery/types';
import { toast } from 'sonner';
import { Panel, Pill, StatusPill } from '@/components/app/primitives';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const inputCls =
  'rounded-[10px] bg-[var(--card)] border border-[var(--line)] px-3 py-2 text-[13.5px] focus:outline-none focus:border-[var(--ink)]';

export default function SlotsCard({ initial }: { initial: GrocerySlot[] }) {
  const [slots, setSlots] = useState(initial);
  const [draft, setDraft] = useState({
    label: '',
    start_time: '07:00',
    end_time: '09:00',
    cutoff_time: '21:00',
    days: [0, 1, 2, 3, 4, 5, 6] as number[],
  });

  function toggleDay(d: number) {
    setDraft((s) => ({
      ...s,
      days: s.days.includes(d) ? s.days.filter((x) => x !== d) : [...s.days, d].sort(),
    }));
  }

  async function add() {
    if (!draft.label.trim()) return;
    const res = await fetch('/api/grocery/slots', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...draft, days_of_week: draft.days }),
    });
    if (!res.ok) return toast.error('Add failed');
    const { slot } = await res.json();
    setSlots((ss) => [...ss, slot]);
    setDraft({
      label: '',
      start_time: '07:00',
      end_time: '09:00',
      cutoff_time: '21:00',
      days: [0, 1, 2, 3, 4, 5, 6],
    });
  }

  async function remove(id: string) {
    if (!confirm('Delete slot?')) return;
    const res = await fetch(`/api/grocery/slots/${id}`, { method: 'DELETE' });
    if (!res.ok) return toast.error('Delete failed');
    setSlots((ss) => ss.filter((s) => s.id !== id));
  }

  async function toggleActive(s: GrocerySlot) {
    const res = await fetch(`/api/grocery/slots/${s.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ is_active: !s.is_active }),
    });
    if (!res.ok) return toast.error('Update failed');
    setSlots((ss) => ss.map((x) => (x.id === s.id ? { ...x, is_active: !x.is_active } : x)));
  }

  return (
    <Panel
      title="Delivery slots"
      sub="Time windows you deliver in. Cutoff = order-by time on the previous day."
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5 mb-2">
        <input
          className={`${inputCls} md:col-span-2`}
          placeholder="Label (e.g. Tomorrow 7-9am)"
          value={draft.label}
          onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
        />
        <input
          type="time"
          className={inputCls}
          value={draft.start_time}
          onChange={(e) => setDraft((d) => ({ ...d, start_time: e.target.value }))}
        />
        <input
          type="time"
          className={inputCls}
          value={draft.end_time}
          onChange={(e) => setDraft((d) => ({ ...d, end_time: e.target.value }))}
        />
        <input
          type="time"
          className={inputCls}
          title="Cutoff"
          value={draft.cutoff_time}
          onChange={(e) => setDraft((d) => ({ ...d, cutoff_time: e.target.value }))}
        />
      </div>
      <div className="flex flex-wrap gap-1.5 items-center mb-4">
        {DOW.map((d, i) => (
          <button
            key={d}
            onClick={() => toggleDay(i)}
            className={`px-2 py-1 text-[11px] zt-mono uppercase tracking-[.04em] rounded-full ${
              draft.days.includes(i)
                ? 'bg-[var(--ink)] text-[var(--background)] font-semibold'
                : 'bg-[var(--card)] border border-[var(--line)] text-[var(--mute)] hover:text-[var(--ink)]'
            }`}
          >
            {d}
          </button>
        ))}
        <div className="ml-auto">
          <Pill variant="ink" onClick={add}>
            Add slot
          </Pill>
        </div>
      </div>

      {slots.length === 0 ? (
        <div className="py-12 text-center">
          <div className="text-[13.5px] text-[var(--mute)] mb-3">
            No slots yet. Add at least one (e.g. &quot;Tomorrow 7–9am&quot;).
          </div>
        </div>
      ) : (
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="text-left zt-mono text-[10.5px] uppercase tracking-[.06em] text-[var(--mute)] border-b border-[var(--line)]">
              <th className="py-2.5 pr-4">Label</th>
              <th className="py-2.5 pr-4">Window</th>
              <th className="py-2.5 pr-4">Cutoff</th>
              <th className="py-2.5 pr-4">Days</th>
              <th className="py-2.5 pr-4">Active</th>
              <th className="py-2.5 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {slots.map((s) => (
              <tr
                key={s.id}
                className="border-b border-[var(--line)] last:border-b-0"
              >
                <td className="py-3 pr-4 font-medium">{s.label}</td>
                <td className="py-3 pr-4 zt-mono text-[12px]">
                  {s.start_time}–{s.end_time}
                </td>
                <td className="py-3 pr-4 zt-mono text-[12px]">{s.cutoff_time}</td>
                <td className="py-3 pr-4 text-[var(--mute)]">
                  {s.days_of_week.map((d) => DOW[d]).join(', ')}
                </td>
                <td className="py-3 pr-4">
                  <button
                    type="button"
                    onClick={() => toggleActive(s)}
                    className="cursor-pointer"
                  >
                    <StatusPill variant={s.is_active ? 'active' : 'pending'}>
                      {s.is_active ? 'On' : 'Off'}
                    </StatusPill>
                  </button>
                </td>
                <td className="py-3 pr-4 text-right">
                  <button
                    onClick={() => remove(s.id)}
                    className="text-[12px] font-medium text-[#D93A2E] hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
