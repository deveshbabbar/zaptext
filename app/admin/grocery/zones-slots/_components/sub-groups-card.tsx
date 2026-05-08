'use client';
import { useState } from 'react';
import type { SubstitutionGroup, GroceryProduct } from '@/lib/grocery/types';
import { toast } from 'sonner';

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
    <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 md:col-span-2">
      <h2 className="text-lg font-semibold">Substitution groups</h2>
      <p className="mt-1 text-xs text-neutral-400">
        Group items that can replace each other when out of stock.
        E.g. palak &harr; methi &harr; sarson (leafy greens).
      </p>

      <div className="mt-3 space-y-2">
        <input
          className="w-full rounded bg-neutral-800 px-3 py-2 text-sm"
          placeholder="Group name (e.g. leafy greens)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex flex-wrap gap-1">
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => toggle(p.id)}
              className={`rounded px-2 py-1 text-xs ${
                picked.includes(p.id)
                  ? 'bg-emerald-600 text-white'
                  : 'bg-neutral-800 text-neutral-300'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
        <button
          onClick={add}
          className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium"
        >
          Create group
        </button>
      </div>

      <ul className="mt-4 space-y-2">
        {groups.map((g) => (
          <li
            key={g.id}
            className="flex items-center justify-between rounded border border-neutral-800 px-3 py-2 text-sm"
          >
            <div>
              <span className="font-medium">{g.name}:</span>{' '}
              <span className="text-neutral-400">
                {g.product_ids
                  .map((id) => productById.get(id)?.name ?? '?')
                  .join(' ↔ ')}
              </span>
            </div>
            <button
              onClick={() => remove(g.id)}
              className="rounded bg-red-600/20 px-2 py-1 text-xs text-red-300"
            >
              Delete
            </button>
          </li>
        ))}
        {groups.length === 0 && (
          <li className="rounded border border-dashed border-neutral-800 p-4 text-center text-neutral-500">
            No substitution groups yet.
          </li>
        )}
      </ul>
    </section>
  );
}
