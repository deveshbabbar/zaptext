// app/admin/grocery/products/_components/products-table.tsx
'use client';
import { useRef, useState } from 'react';
import type { GroceryProduct, GroceryUnit } from '@/lib/grocery/types';
import { toast } from 'sonner';
import { Panel, Pill } from '@/components/app/primitives';

const UNITS: GroceryUnit[] = ['kg', 'g', 'piece', 'dozen', 'bunch'];

export default function ProductsTable({
  initialProducts,
}: {
  initialProducts: GroceryProduct[];
}) {
  const [products, setProducts] = useState(initialProducts);
  const [draft, setDraft] = useState({
    name: '',
    unit: 'kg' as GroceryUnit,
    aliases: '',
  });
  const nameInputRef = useRef<HTMLInputElement>(null);

  async function add() {
    if (!draft.name.trim()) return;
    const res = await fetch('/api/grocery/products', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: draft.name,
        unit: draft.unit,
        name_aliases: draft.aliases
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    });
    if (!res.ok) {
      toast.error('Add failed');
      return;
    }
    const { product } = await res.json();
    setProducts((ps) => [...ps, product].sort((a, b) => a.name.localeCompare(b.name)));
    setDraft({ name: '', unit: 'kg', aliases: '' });
    toast.success('Added');
  }

  async function remove(id: string) {
    if (!confirm('Delete this product?')) return;
    const res = await fetch(`/api/grocery/products/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error('Delete failed');
      return;
    }
    setProducts((ps) => ps.filter((p) => p.id !== id));
  }

  const inputCls =
    'rounded-[10px] bg-[var(--card)] border border-[var(--line)] px-3 py-2 text-[13.5px] focus:outline-none focus:border-[var(--ink)]';

  return (
    <div className="space-y-4">
      <Panel title="Add product" sub="Master list — set once, edit rarely.">
        <div className="flex flex-wrap gap-2">
          <input
            ref={nameInputRef}
            className={`${inputCls} flex-1 min-w-[200px]`}
            placeholder="Item name (e.g. tamatar)"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
          <select
            className={inputCls}
            value={draft.unit}
            onChange={(e) =>
              setDraft((d) => ({ ...d, unit: e.target.value as GroceryUnit }))
            }
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <input
            className={`${inputCls} flex-1 min-w-[200px]`}
            placeholder="Aliases (comma-sep) e.g. tomato, tameta"
            value={draft.aliases}
            onChange={(e) => setDraft((d) => ({ ...d, aliases: e.target.value }))}
          />
          <Pill variant="ink" onClick={add}>
            Add
          </Pill>
        </div>
      </Panel>

      <Panel title="All products" sub={`${products.length} items`}>
        {products.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-[13.5px] text-[var(--mute)] mb-3">
              No products yet
            </div>
            <Pill
              variant="ink"
              onClick={() => nameInputRef.current?.focus()}
            >
              Add first product
            </Pill>
          </div>
        ) : (
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="text-left zt-mono text-[10.5px] uppercase tracking-[.06em] text-[var(--mute)] border-b border-[var(--line)]">
                <th className="py-2.5 pr-4">Name</th>
                <th className="py-2.5 pr-4">Unit</th>
                <th className="py-2.5 pr-4">Aliases</th>
                <th className="py-2.5 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-[var(--line)] last:border-b-0"
                >
                  <td className="py-3 pr-4 capitalize font-medium">{p.name}</td>
                  <td className="py-3 pr-4 text-[var(--mute)] zt-mono text-[12px] uppercase tracking-[.06em]">
                    {p.unit}
                  </td>
                  <td className="py-3 pr-4 text-[var(--mute)]">
                    {p.name_aliases.join(', ')}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <button
                      onClick={() => remove(p.id)}
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
    </div>
  );
}
