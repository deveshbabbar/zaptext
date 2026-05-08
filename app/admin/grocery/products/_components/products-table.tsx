// app/admin/grocery/products/_components/products-table.tsx
'use client';
import { useState } from 'react';
import type { GroceryProduct, GroceryUnit } from '@/lib/grocery/types';
import { toast } from 'sonner';

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-3">
        <input
          className="flex-1 rounded bg-neutral-800 px-3 py-2"
          placeholder="Item name (e.g. tamatar)"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        />
        <select
          className="rounded bg-neutral-800 px-3 py-2"
          value={draft.unit}
          onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value as GroceryUnit }))}
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
        <input
          className="flex-1 rounded bg-neutral-800 px-3 py-2"
          placeholder="Aliases (comma-sep) e.g. tomato, tameta"
          value={draft.aliases}
          onChange={(e) => setDraft((d) => ({ ...d, aliases: e.target.value }))}
        />
        <button
          onClick={add}
          className="rounded bg-emerald-600 px-4 py-2 font-medium hover:bg-emerald-500"
        >
          Add
        </button>
      </div>

      <table className="w-full text-sm">
        <thead className="text-left text-neutral-400">
          <tr>
            <th className="px-2 py-2">Name</th>
            <th className="px-2 py-2">Unit</th>
            <th className="px-2 py-2">Aliases</th>
            <th className="px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className="border-t border-neutral-800">
              <td className="px-2 py-2">{p.name}</td>
              <td className="px-2 py-2">{p.unit}</td>
              <td className="px-2 py-2 text-neutral-400">{p.name_aliases.join(', ')}</td>
              <td className="px-2 py-2 text-right">
                <button
                  onClick={() => remove(p.id)}
                  className="rounded bg-red-600/20 px-3 py-1 text-red-300 hover:bg-red-600/40"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {products.length === 0 && (
            <tr>
              <td colSpan={4} className="py-8 text-center text-neutral-500">
                No products yet. Add your first item above.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
