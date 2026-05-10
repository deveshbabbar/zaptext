'use client';
import { useState } from 'react';
import type { GroceryZone } from '@/lib/grocery/types';
import { toast } from 'sonner';
import { Panel, Pill } from '@/components/app/primitives';

const inputCls =
  'rounded-[10px] bg-[var(--card)] border border-[var(--line)] px-3 py-2 text-[13.5px] focus:outline-none focus:border-[var(--ink)]';

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
    <Panel
      title="Delivery zones"
      sub="Pin codes / area names you deliver to. Customer's address is matched against these."
    >
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          className={`${inputCls} flex-1 min-w-[140px]`}
          placeholder="Label (e.g. Sector 21)"
          value={draft.label}
          onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
        />
        <input
          className={`${inputCls} w-28`}
          placeholder="Pin code"
          value={draft.pincode}
          onChange={(e) => setDraft((d) => ({ ...d, pincode: e.target.value }))}
        />
        <input
          className={`${inputCls} flex-1 min-w-[180px]`}
          placeholder="Keywords (comma-sep) e.g. 21A, sector 21"
          value={draft.keywords}
          onChange={(e) => setDraft((d) => ({ ...d, keywords: e.target.value }))}
        />
        <input
          type="number"
          className={`${inputCls} w-24`}
          placeholder="Fee ₹"
          value={draft.fee || ''}
          onChange={(e) =>
            setDraft((d) => ({ ...d, fee: parseFloat(e.target.value) || 0 }))
          }
        />
        <input
          type="number"
          className={`${inputCls} w-28`}
          placeholder="Min order ₹"
          value={draft.minOrder || ''}
          onChange={(e) =>
            setDraft((d) => ({ ...d, minOrder: parseFloat(e.target.value) || 0 }))
          }
        />
        <Pill variant="ink" onClick={add}>
          Add zone
        </Pill>
      </div>

      {zones.length === 0 ? (
        <div className="py-12 text-center">
          <div className="text-[13.5px] text-[var(--mute)] mb-3">
            No zones yet. Add at least one before customers can order.
          </div>
        </div>
      ) : (
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="text-left zt-mono text-[10.5px] uppercase tracking-[.06em] text-[var(--mute)] border-b border-[var(--line)]">
              <th className="py-2.5 pr-4">Label</th>
              <th className="py-2.5 pr-4">Pin</th>
              <th className="py-2.5 pr-4">Keywords</th>
              <th className="py-2.5 pr-4">Fee</th>
              <th className="py-2.5 pr-4">Min</th>
              <th className="py-2.5 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {zones.map((z) => (
              <tr
                key={z.id}
                className="border-b border-[var(--line)] last:border-b-0"
              >
                <td className="py-3 pr-4 font-medium">{z.label}</td>
                <td className="py-3 pr-4 text-[var(--mute)] zt-mono text-[12px]">
                  {z.pincode ?? '—'}
                </td>
                <td className="py-3 pr-4 text-[var(--mute)]">
                  {z.area_keywords.join(', ')}
                </td>
                <td className="py-3 pr-4">₹{z.delivery_fee}</td>
                <td className="py-3 pr-4">
                  {z.min_order != null ? `₹${z.min_order}` : '—'}
                </td>
                <td className="py-3 pr-4 text-right">
                  <button
                    onClick={() => remove(z.id)}
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
  );
}
