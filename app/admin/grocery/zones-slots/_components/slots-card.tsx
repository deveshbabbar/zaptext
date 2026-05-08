'use client';
import { useState } from 'react';
import type { GrocerySlot } from '@/lib/grocery/types';
import { toast } from 'sonner';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
    <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="text-lg font-semibold">Delivery slots</h2>
      <p className="mt-1 text-xs text-neutral-400">
        Time windows you deliver in. Cutoff = order-by time on the previous day.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
        <input
          className="rounded bg-neutral-800 px-3 py-2 text-sm md:col-span-2"
          placeholder="Label (e.g. Tomorrow 7-9am)"
          value={draft.label}
          onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
        />
        <input
          type="time"
          className="rounded bg-neutral-800 px-3 py-2 text-sm"
          value={draft.start_time}
          onChange={(e) => setDraft((d) => ({ ...d, start_time: e.target.value }))}
        />
        <input
          type="time"
          className="rounded bg-neutral-800 px-3 py-2 text-sm"
          value={draft.end_time}
          onChange={(e) => setDraft((d) => ({ ...d, end_time: e.target.value }))}
        />
        <input
          type="time"
          className="rounded bg-neutral-800 px-3 py-2 text-sm"
          title="Cutoff"
          value={draft.cutoff_time}
          onChange={(e) => setDraft((d) => ({ ...d, cutoff_time: e.target.value }))}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {DOW.map((d, i) => (
          <button
            key={d}
            onClick={() => toggleDay(i)}
            className={`rounded px-2 py-1 text-xs ${
              draft.days.includes(i) ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-400'
            }`}
          >
            {d}
          </button>
        ))}
        <button onClick={add} className="ml-auto rounded bg-emerald-600 px-3 py-1 text-sm font-medium">
          Add slot
        </button>
      </div>

      <table className="mt-4 w-full text-sm">
        <thead className="text-left text-neutral-400">
          <tr>
            <th className="py-2">Label</th>
            <th className="py-2">Window</th>
            <th className="py-2">Cutoff</th>
            <th className="py-2">Days</th>
            <th className="py-2">Active</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {slots.map((s) => (
            <tr key={s.id} className="border-t border-neutral-800">
              <td className="py-2">{s.label}</td>
              <td className="py-2">
                {s.start_time}–{s.end_time}
              </td>
              <td className="py-2">{s.cutoff_time}</td>
              <td className="py-2 text-neutral-400">
                {s.days_of_week.map((d) => DOW[d]).join(', ')}
              </td>
              <td className="py-2">
                <button
                  onClick={() => toggleActive(s)}
                  className={`rounded px-2 py-1 text-xs ${
                    s.is_active ? 'bg-emerald-600/20 text-emerald-300' : 'bg-neutral-700 text-neutral-400'
                  }`}
                >
                  {s.is_active ? 'On' : 'Off'}
                </button>
              </td>
              <td className="py-2 text-right">
                <button onClick={() => remove(s.id)} className="rounded bg-red-600/20 px-2 py-1 text-xs text-red-300">
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {slots.length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-center text-neutral-500">
                No slots yet. Add at least one (e.g. &quot;Tomorrow 7–9am&quot;).
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
