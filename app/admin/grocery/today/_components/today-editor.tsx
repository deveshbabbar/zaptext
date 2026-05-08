// app/admin/grocery/today/_components/today-editor.tsx
'use client';
import { useState } from 'react';
import type { GroceryProduct } from '@/lib/grocery/types';
import { toast } from 'sonner';

interface Props {
  date: string;
  products: GroceryProduct[];
  existing: Record<string, { price: number; in_stock: boolean }>;
}

export default function TodayEditor({ date, products, existing }: Props) {
  const [rows, setRows] = useState(() =>
    products.map((p) => ({
      product_id: p.id,
      name: p.name,
      unit: p.unit,
      price: existing[p.id]?.price ?? 0,
      in_stock: existing[p.id]?.in_stock ?? true,
    }))
  );
  const [saving, setSaving] = useState(false);

  function update(idx: number, patch: Partial<typeof rows[number]>) {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  async function save() {
    setSaving(true);
    const res = await fetch('/api/grocery/daily-catalog/upsert', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        date,
        items: rows.map((r) => ({
          product_id: r.product_id,
          price_per_unit: r.price,
          in_stock: r.in_stock,
        })),
      }),
    });
    setSaving(false);
    if (!res.ok) toast.error('Save failed');
    else toast.success('Aaj ki list save ho gayi');
  }

  async function copyYesterday() {
    const res = await fetch('/api/grocery/daily-catalog/copy-yesterday', { method: 'POST' });
    if (!res.ok) {
      toast.error('Copy failed');
      return;
    }
    const { count } = await res.json();
    toast.success(`Copied ${count} items from yesterday`);
    location.reload();
  }

  if (products.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 text-center text-neutral-400">
        First add some products on the Products tab.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          onClick={copyYesterday}
          className="rounded bg-neutral-800 px-3 py-2 text-sm hover:bg-neutral-700"
        >
          Copy yesterday&apos;s prices
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="ml-auto rounded bg-emerald-600 px-4 py-2 font-medium hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save list'}
        </button>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-neutral-400">
          <tr>
            <th className="px-2 py-2">Item</th>
            <th className="px-2 py-2">Price (₹)</th>
            <th className="px-2 py-2">Unit</th>
            <th className="px-2 py-2">In stock?</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.product_id} className="border-t border-neutral-800">
              <td className="px-2 py-2 font-medium">{r.name}</td>
              <td className="px-2 py-2">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className="w-24 rounded bg-neutral-800 px-2 py-1"
                  value={r.price}
                  onChange={(e) => update(i, { price: parseFloat(e.target.value) || 0 })}
                />
              </td>
              <td className="px-2 py-2 text-neutral-400">/{r.unit}</td>
              <td className="px-2 py-2">
                <button
                  onClick={() => update(i, { in_stock: !r.in_stock })}
                  className={`rounded px-2 py-1 text-xs ${
                    r.in_stock
                      ? 'bg-emerald-600/20 text-emerald-300'
                      : 'bg-red-600/20 text-red-300'
                  }`}
                >
                  {r.in_stock ? 'In stock' : 'Out of stock'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
