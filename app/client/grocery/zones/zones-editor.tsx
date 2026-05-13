'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageTopbar, PageHead, Pill, Panel } from '@/components/app/primitives';
import type { GroceryZone } from '@/lib/grocery/types';

interface Props {
  businessName: string;
  initialZones: GroceryZone[];
}

export function ZonesEditor({ businessName, initialZones }: Props) {
  const [zones, setZones] = useState<GroceryZone[]>(initialZones);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    label: '',
    pincode: '',
    area_keywords: '',
    delivery_fee: '0',
    min_order_for_free_delivery: '',
    min_order: '',
  });

  async function addZone() {
    if (!draft.label.trim()) { toast.error('Zone label required'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/grocery/zones', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: draft.label.trim(),
          pincode: draft.pincode || null,
          area_keywords: draft.area_keywords.split(',').map((s) => s.trim()).filter(Boolean),
          delivery_fee: Number(draft.delivery_fee) || 0,
          min_order_for_free_delivery: draft.min_order_for_free_delivery === '' ? null : Number(draft.min_order_for_free_delivery),
          min_order: draft.min_order === '' ? null : Number(draft.min_order),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed');
      setZones((prev) => [...prev, data.zone]);
      setDraft({ label: '', pincode: '', area_keywords: '', delivery_fee: '0', min_order_for_free_delivery: '', min_order: '' });
      toast.success(`Zone ${data.zone.label} added`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setCreating(false);
    }
  }

  async function patchZone(id: string, patch: Partial<GroceryZone>) {
    try {
      const res = await fetch(`/api/grocery/zones/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Update failed');
      setZones((prev) => prev.map((z) => z.id === id ? { ...z, ...patch } as GroceryZone : z));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function removeZone(id: string, label: string) {
    if (!window.confirm(`Remove zone "${label}"?`)) return;
    try {
      const res = await fetch(`/api/grocery/zones/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setZones((prev) => prev.filter((z) => z.id !== id));
      toast.success(`${label} removed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  const fieldCls = 'w-full rounded-[10px] border border-[var(--line)] bg-[var(--card)] focus:border-[var(--ink)] focus:outline-none text-[13.5px]';
  const fStyle = { padding: '8px 10px' };

  return (
    <>
      <PageTopbar
        crumbs={<>Grocery / <a href="/client/grocery" className="hover:underline">Overview</a> / <b className="text-foreground">Delivery zones</b></>}
      />
      <div style={{ padding: '28px 32px 80px' }}>
        <PageHead
          title={<>{businessName} <span className="zt-serif">delivery zones.</span></>}
          sub={`${zones.length} zones. Bot uses pincode + area keywords to confirm delivery. Set min-order to filter low-value orders.`}
        />

        <Panel title="Add zone" className="mb-5">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <div className="md:col-span-4">
              <div className="text-[12.5px] font-semibold mb-1.5">Zone label *</div>
              <input className={fieldCls} style={fStyle} placeholder="Whitefield"
                value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <div className="text-[12.5px] font-semibold mb-1.5">Pincode</div>
              <input className={fieldCls} style={fStyle} placeholder="560066"
                value={draft.pincode} onChange={(e) => setDraft((d) => ({ ...d, pincode: e.target.value }))} />
            </div>
            <div className="md:col-span-6">
              <div className="text-[12.5px] font-semibold mb-1.5">Area keywords (comma-separated)</div>
              <input className={fieldCls} style={fStyle} placeholder="ITPL, Brookefield, Hope Farm"
                value={draft.area_keywords} onChange={(e) => setDraft((d) => ({ ...d, area_keywords: e.target.value }))} />
            </div>
            <div className="md:col-span-4">
              <div className="text-[12.5px] font-semibold mb-1.5">Delivery fee ₹</div>
              <input type="number" className={fieldCls} style={fStyle} placeholder="20"
                value={draft.delivery_fee} onChange={(e) => setDraft((d) => ({ ...d, delivery_fee: e.target.value }))} />
            </div>
            <div className="md:col-span-4">
              <div className="text-[12.5px] font-semibold mb-1.5">Free delivery above ₹</div>
              <input type="number" className={fieldCls} style={fStyle} placeholder="299"
                value={draft.min_order_for_free_delivery} onChange={(e) => setDraft((d) => ({ ...d, min_order_for_free_delivery: e.target.value }))} />
            </div>
            <div className="md:col-span-4">
              <div className="text-[12.5px] font-semibold mb-1.5">Min order ₹</div>
              <input type="number" className={fieldCls} style={fStyle} placeholder="99"
                value={draft.min_order} onChange={(e) => setDraft((d) => ({ ...d, min_order: e.target.value }))} />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Pill variant="ink" onClick={addZone} disabled={creating || !draft.label.trim()}>
              {creating ? 'Adding…' : '+ Add zone'}
            </Pill>
          </div>
        </Panel>

        <div className="flex flex-col gap-3">
          {zones.length === 0 ? (
            <Panel title="No zones yet" sub="Add at least one zone — bot needs this to confirm deliveries.">
              <div />
            </Panel>
          ) : zones.map((z) => (
            <Panel key={z.id} title={z.label} action={
              <button onClick={() => removeZone(z.id, z.label)}
                className="text-xs text-muted-foreground hover:text-destructive">Remove</button>
            }>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                <div className="md:col-span-4">
                  <div className="text-[11.5px] font-semibold mb-1">Label</div>
                  <input className={fieldCls} style={fStyle} defaultValue={z.label}
                    onBlur={(e) => e.target.value !== z.label && patchZone(z.id, { label: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <div className="text-[11.5px] font-semibold mb-1">Pincode</div>
                  <input className={fieldCls} style={fStyle} defaultValue={z.pincode || ''}
                    onBlur={(e) => patchZone(z.id, { pincode: e.target.value || null })} />
                </div>
                <div className="md:col-span-6">
                  <div className="text-[11.5px] font-semibold mb-1">Area keywords</div>
                  <input className={fieldCls} style={fStyle} defaultValue={(z.area_keywords || []).join(', ')}
                    onBlur={(e) => {
                      const next = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                      if (JSON.stringify(next) !== JSON.stringify(z.area_keywords || [])) {
                        patchZone(z.id, { area_keywords: next });
                      }
                    }} />
                </div>
                <div className="md:col-span-4">
                  <div className="text-[11.5px] font-semibold mb-1">Delivery fee ₹</div>
                  <input type="number" className={fieldCls} style={fStyle} defaultValue={z.delivery_fee}
                    onBlur={(e) => patchZone(z.id, { delivery_fee: Number(e.target.value) || 0 })} />
                </div>
                <div className="md:col-span-4">
                  <div className="text-[11.5px] font-semibold mb-1">Free delivery above ₹</div>
                  <input type="number" className={fieldCls} style={fStyle} defaultValue={z.min_order_for_free_delivery ?? ''}
                    onBlur={(e) => patchZone(z.id, { min_order_for_free_delivery: e.target.value === '' ? null : Number(e.target.value) })} />
                </div>
                <div className="md:col-span-4">
                  <div className="text-[11.5px] font-semibold mb-1">Min order ₹</div>
                  <input type="number" className={fieldCls} style={fStyle} defaultValue={z.min_order ?? ''}
                    onBlur={(e) => patchZone(z.id, { min_order: e.target.value === '' ? null : Number(e.target.value) })} />
                </div>
              </div>
            </Panel>
          ))}
        </div>
      </div>
    </>
  );
}
