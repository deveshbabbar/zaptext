// app/admin/grocery/recurring/_components/recurring-list.tsx
'use client';
import { useState } from 'react';
import type { RecurringOrder } from '@/lib/grocery/types';
import { toast } from 'sonner';
import { Panel, StatusPill } from '@/components/app/primitives';

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
      <Panel>
        <div className="py-12 text-center text-[13.5px] text-[var(--mute)]">
          No recurring orders yet.
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-3">
      {list.map((r) => (
        <Panel key={r.id}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="font-semibold text-[14.5px]">
                {r.customer_phone}{' '}
                <span className="text-[var(--mute)] font-normal">
                  · Every {DOW[r.day_of_week]}
                </span>
              </div>
              <div className="text-[11.5px] zt-mono uppercase tracking-[.06em] text-[var(--mute)] mt-1">
                {r.template_items.length} items · last run{' '}
                {r.last_run_date ?? 'never'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggle(r)}
                className="cursor-pointer"
              >
                <StatusPill variant={r.is_active ? 'active' : 'pending'}>
                  {r.is_active ? 'Active' : 'Paused'}
                </StatusPill>
              </button>
              <button
                onClick={() => remove(r)}
                className="text-[12px] font-medium text-[#D93A2E] hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>
          <details className="mt-3 text-[13px]">
            <summary className="cursor-pointer text-[var(--mute)] zt-mono text-[11px] uppercase tracking-[.06em]">
              Items
            </summary>
            <ul className="mt-2 space-y-0.5 text-[var(--ink-2)]">
              {r.template_items.map((it, i) => (
                <li key={i}>
                  {it.qty}
                  {it.unit === 'piece' ? '' : it.unit} {it.name}
                </li>
              ))}
            </ul>
          </details>
        </Panel>
      ))}
    </div>
  );
}
