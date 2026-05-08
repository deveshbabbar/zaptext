'use client';
import { useState } from 'react';
import type { GroceryZone } from '@/lib/grocery/types';
import { toast } from 'sonner';

export default function ZonesCard({ initial }: { initial: GroceryZone[] }) {
  const [zones, setZones] = useState(initial);
  const [draft, setDraft] = useState({
    label: '',
    pincode: '',
    keywords: '',
    fee: 0,
    minOrder: 0,
  });

  async function add() {
    if (!draft.label.trim()) return;
    const res = await fetch('/api/grocery/zones', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        label: draft.label,
        pincode: draft.pincode || null,
        area_keywords: draft.keywords
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        delivery_fee: draft.fee,
        min_order: draft.minOrder || null,
      }),
    });
    if (!res.ok) return toast.error('Add failed');
    const { zone } = await res.json();
    setZones((zs) => [...zs, zone]);
    setDraft({ label: '', pincode: '', keywords: '', fee: 0, minOrder: 0 });
  }

  async function remove(id: string) {
    if (!confirm('Delete zone?')) return;
    const res = await fetch(`/api/grocery/zones/${id}`, { method: 'DELETE' });
    if (!res.ok) return toast.error('Delete failed');
    setZones((zs) => zs.filter((z) => z.id !== id));
  }

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="text-lg font-semibold">Delivery zones</h2>
      <p className="mt-1 text-xs text-neutral-400">
        Pin codes / area names you deliver to. Customer&apos;s address is matched against these.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          className="flex-1 rounded bg-neutral-800 px-3 py-2 text-sm"
          placeholder="Label (e.g. Sector 21)"
          value={draft.label}
          onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
        />
        <input
          className="w-28 rounded bg-neutral-800 px-3 py-2 text-sm"
          placeholder="Pin code"
          value={draft.pincode}
          onChange={(e) => setDraft((d) => ({ ...d, pincode: e.target.value }))}
        />
        <input
          className="flex-1 rounded bg-neutral-800 px-3 py-2 text-sm"
          placeholder="Keywords (comma-sep) e.g. 21A, sector 21, model town"
          value={draft.keywords}
          onChange={(e) => setDraft((d) => ({ ...d, keywords: e.target.value }))}
        />
        <input
          type="number"
          className="w-24 rounded bg-neutral-800 px-3 py-2 text-sm"
          placeholder="Fee ₹"
          value={draft.fee || ''}
          onChange={(e) => setDraft((d) => ({ ...d, fee: parseFloat(e.target.value) || 0 }))}
        />
        <input
          type="number"
          className="w-28 rounded bg-neutral-800 px-3 py-2 text-sm"
          placeholder="Min order ₹"
          value={draft.minOrder || ''}
          onChange={(e) => setDraft((d) => ({ ...d, minOrder: parseFloat(e.target.value) || 0 }))}
        />
        <button onClick={add} className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium">
          Add zone
        </button>
      </div>
      <table className="mt-4 w-full text-sm">
        <thead className="text-left text-neutral-400">
          <tr>
            <th className="py-2">Label</th>
            <th className="py-2">Pin</th>
            <th className="py-2">Keywords</th>
            <th className="py-2">Fee</th>
            <th className="py-2">Min</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {zones.map((z) => (
            <tr key={z.id} className="border-t border-neutral-800">
              <td className="py-2">{z.label}</td>
              <td className="py-2">{z.pincode ?? '—'}</td>
              <td className="py-2 text-neutral-400">{z.area_keywords.join(', ')}</td>
              <td className="py-2">₹{z.delivery_fee}</td>
              <td className="py-2">{z.min_order != null ? `₹${z.min_order}` : '—'}</td>
              <td className="py-2 text-right">
                <button
                  onClick={() => remove(z.id)}
                  className="rounded bg-red-600/20 px-2 py-1 text-xs text-red-300"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {zones.length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-center text-neutral-500">
                No zones yet. Add at least one before customers can order.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
