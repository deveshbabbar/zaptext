// app/admin/grocery/today/_components/today-editor.tsx
'use client';
import { useState } from 'react';
import type { GroceryProduct } from '@/lib/grocery/types';
import { toast } from 'sonner';
import { Panel, Pill, StatusPill } from '@/components/app/primitives';

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
      <Panel>
        <div className="py-12 text-center">
          <div className="text-[13.5px] text-[var(--mute)] mb-3">
            First add some products on the Products tab.
          </div>
          <Pill variant="ink" href="/admin/grocery/products">Add products</Pill>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <Pill variant="ghost" onClick={copyYesterday}>
          Copy yesterday&apos;s prices
        </Pill>
        <div className="ml-auto">
          <Pill variant="ink" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save list'}
          </Pill>
        </div>
      </div>

      <Panel title="Today's items" sub={`${rows.length} products in master list`}>
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="text-left zt-mono text-[10.5px] uppercase tracking-[.06em] text-[var(--mute)] border-b border-[var(--line)]">
              <th className="py-2.5 pr-4">Item</th>
              <th className="py-2.5 pr-4">Price (₹)</th>
              <th className="py-2.5 pr-4">Unit</th>
              <th className="py-2.5 pr-4">Stock</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.product_id}
                className="border-b border-[var(--line)] last:border-b-0"
              >
                <td className="py-3 pr-4 font-medium capitalize">{r.name}</td>
                <td className="py-3 pr-4">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    className="w-24 rounded-[10px] bg-[var(--card)] border border-[var(--line)] px-3 py-2 text-[13.5px] focus:outline-none focus:border-[var(--ink)]"
                    value={r.price}
                    onChange={(e) =>
                      update(i, { price: parseFloat(e.target.value) || 0 })
                    }
                  />
                </td>
                <td className="py-3 pr-4 text-[var(--mute)] zt-mono text-[12px] uppercase tracking-[.06em]">
                  /{r.unit}
                </td>
                <td className="py-3 pr-4">
                  <button
                    type="button"
                    onClick={() => update(i, { in_stock: !r.in_stock })}
                    className="cursor-pointer"
                  >
                    <StatusPill variant={r.in_stock ? 'ok' : 'cancel'}>
                      {r.in_stock ? 'In stock' : 'Out'}
                    </StatusPill>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
