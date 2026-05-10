'use client';
import { useState } from 'react';
import type { SubstitutionGroup, GroceryProduct } from '@/lib/grocery/types';
import { toast } from 'sonner';
import { Panel, Pill } from '@/components/app/primitives';

const inputCls =
  'rounded-[10px] bg-[var(--card)] border border-[var(--line)] px-3 py-2 text-[13.5px] focus:outline-none focus:border-[var(--ink)]';

export default function SubGroupsCard({
  initial,
  products,
}: {
  initial: SubstitutionGroup[];
  products: GroceryProduct[];
}) {
  const [groups, setGroups] = useState(initial);
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<string[]>([]);

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function add() {
    if (!name.trim() || picked.length < 2) {
      toast.error('Name + at least 2 products required');
      return;
    }
    const res = await fetch('/api/grocery/sub-groups', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, product_ids: picked }),
    });
    if (!res.ok) return toast.error('Add failed');
    const { group } = await res.json();
    setGroups((gs) => [...gs, group]);
    setName('');
    setPicked([]);
  }

  async function remove(id: string) {
    if (!confirm('Delete group?')) return;
    const res = await fetch(`/api/grocery/sub-groups/${id}`, { method: 'DELETE' });
    if (!res.ok) return toast.error('Delete failed');
    setGroups((gs) => gs.filter((g) => g.id !== id));
  }

  const productById = new Map(products.map((p) => [p.id, p]));

  return (
    <Panel
      title="Substitution groups"
      sub="Group items that can replace each other when out of stock. E.g. palak ↔ methi ↔ sarson (leafy greens)."
    >
      <div className="space-y-3 mb-4">
        <input
          className={`${inputCls} w-full`}
          placeholder="Group name (e.g. leafy greens)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex flex-wrap gap-1.5">
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => toggle(p.id)}
              className={`px-2 py-1 text-[11px] zt-mono uppercase tracking-[.04em] rounded-full ${
                picked.includes(p.id)
                  ? 'bg-[var(--ink)] text-[var(--background)] font-semibold'
                  : 'bg-[var(--card)] border border-[var(--line)] text-[var(--mute)] hover:text-[var(--ink)]'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
        <Pill variant="ink" onClick={add}>
          Create group
        </Pill>
      </div>

      {groups.length === 0 ? (
        <div className="py-12 text-center text-[13.5px] text-[var(--mute)]">
          No substitution groups yet.
        </div>
      ) : (
        <ul className="flex flex-col">
          {groups.map((g) => (
            <li
              key={g.id}
              className="flex items-center justify-between gap-3 py-3 border-b border-[var(--line)] last:border-b-0"
            >
              <div className="text-[13.5px]">
                <span className="font-semibold capitalize">{g.name}:</span>{' '}
                <span className="text-[var(--mute)]">
                  {g.product_ids
                    .map((id) => productById.get(id)?.name ?? '?')
                    .join(' ↔ ')}
                </span>
              </div>
              <button
                onClick={() => remove(g.id)}
                className="text-[12px] font-medium text-[#D93A2E] hover:underline"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
