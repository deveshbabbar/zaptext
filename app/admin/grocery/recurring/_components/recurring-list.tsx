// app/admin/grocery/recurring/_components/recurring-list.tsx
'use client';
import { useState } from 'react';
import type { RecurringOrder } from '@/lib/grocery/types';
import { toast } from 'sonner';

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function RecurringList({ initial }: { initial: RecurringOrder[] }) {
  const [list, setList] = useState(initial);

  async function toggle(r: RecurringOrder) {
    const res = await fetch(`/api/grocery/recurring/${r.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ is_active: !r.is_active }),
    });
    if (!res.ok) return toast.error('Update failed');
    setList((xs) => xs.map((x) => (x.id === r.id ? { ...x, is_active: !x.is_active } : x)));
  }

  async function remove(r: RecurringOrder) {
    if (!confirm('Cancel this recurring order?')) return;
    const res = await fetch(`/api/grocery/recurring/${r.id}`, { method: 'DELETE' });
    if (!res.ok) return toast.error('Delete failed');
    setList((xs) => xs.filter((x) => x.id !== r.id));
  }

  if (list.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 text-center text-neutral-500">
        No recurring orders yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {list.map((r) => (
        <div
          key={r.id}
          className="rounded-lg border border-neutral-800 bg-neutral-900 p-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">
                {r.customer_phone} · Every {DOW[r.day_of_week]}
              </div>
              <div className="text-xs text-neutral-400">
                {r.template_items.length} items · last run {r.last_run_date ?? 'never'}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => toggle(r)}
                className={`rounded px-2 py-1 text-xs ${
                  r.is_active
                    ? 'bg-emerald-600/20 text-emerald-300'
                    : 'bg-neutral-700 text-neutral-400'
                }`}
              >
                {r.is_active ? 'Active' : 'Paused'}
              </button>
              <button
                onClick={() => remove(r)}
                className="rounded bg-red-600/20 px-2 py-1 text-xs text-red-300"
              >
                Cancel
              </button>
            </div>
          </div>
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-neutral-400">Items</summary>
            <ul className="mt-1 space-y-0.5 text-neutral-300">
              {r.template_items.map((it, i) => (
                <li key={i}>
                  {it.qty}{it.unit === 'piece' ? '' : it.unit} {it.name}
                </li>
              ))}
            </ul>
          </details>
        </div>
      ))}
    </div>
  );
}
