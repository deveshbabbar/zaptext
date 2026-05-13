'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageTopbar, PageHead, Pill, Panel } from '@/components/app/primitives';
import type { GroceryProduct, GroceryUnit } from '@/lib/grocery/types';

const UNITS: GroceryUnit[] = ['kg', 'g', 'piece', 'dozen', 'bunch'];

interface Props {
  businessName: string;
  initialProducts: GroceryProduct[];
}

export function GroceryProductsEditor({ businessName, initialProducts }: Props) {
  const [products, setProducts] = useState<GroceryProduct[]>(initialProducts);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<{ name: string; aliases: string; unit: GroceryUnit }>({ name: '', aliases: '', unit: 'kg' });

  async function addProduct() {
    if (!draft.name.trim()) { toast.error('Name required'); return; }
    setCreating(true);
    try {
      const aliases = draft.aliases.split(',').map((s) => s.trim()).filter(Boolean);
      const res = await fetch('/api/grocery/products', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: draft.name.trim(), name_aliases: aliases, unit: draft.unit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed');
      setProducts((prev) => [...prev, data.product]);
      setDraft({ name: '', aliases: '', unit: 'kg' });
      toast.success(`${data.product.name} added`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setCreating(false);
    }
  }

  async function removeProduct(id: string, name: string) {
    if (!window.confirm(`Remove ${name}?`)) return;
    try {
      const res = await fetch(`/api/grocery/products/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setProducts((prev) => prev.filter((p) => p.id !== id));
      toast.success(`${name} removed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function patchProduct(id: string, patch: Partial<GroceryProduct>) {
    try {
      const res = await fetch(`/api/grocery/products/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Update failed');
      setProducts((prev) => prev.map((p) => p.id === id ? { ...p, ...patch } as GroceryProduct : p));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  const fieldCls = 'w-full rounded-[10px] border border-[var(--line)] bg-[var(--card)] focus:border-[var(--ink)] focus:outline-none text-[13.5px]';
  const fStyle = { padding: '10px 12px' };

  return (
    <>
      <PageTopbar
        crumbs={<>Grocery / <a href="/client/grocery" className="hover:underline">Overview</a> / <b className="text-foreground">Products</b></>}
      />
      <div style={{ padding: '28px 32px 80px' }}>
        <PageHead
          title={<>{businessName} <span className="zt-serif">products.</span></>}
          sub={`${products.length} products. Add aliases (e.g. "tamatar, tomato") so the bot matches customer text correctly.`}
        />

        <Panel title="Add product" className="mb-5">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <div className="md:col-span-4">
              <div className="text-[12.5px] font-semibold mb-1.5">Name *</div>
              <input className={fieldCls} style={fStyle} placeholder="Tomato"
                value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
            </div>
            <div className="md:col-span-6">
              <div className="text-[12.5px] font-semibold mb-1.5">Aliases (comma-separated)</div>
              <input className={fieldCls} style={fStyle} placeholder="tamatar, tomatar, tomato red"
                value={draft.aliases} onChange={(e) => setDraft((d) => ({ ...d, aliases: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <div className="text-[12.5px] font-semibold mb-1.5">Unit *</div>
              <select className={fieldCls} style={fStyle}
                value={draft.unit} onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value as GroceryUnit }))}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Pill variant="ink" onClick={addProduct} disabled={creating || !draft.name.trim()}>
              {creating ? 'Adding…' : '+ Add product'}
            </Pill>
          </div>
        </Panel>

        <Panel title="Master catalog" sub="Add aliases liberally — the bot matches customer text against name + aliases">
          {products.length === 0 ? (
            <p className="text-[13px] text-[var(--mute)] py-3">No products yet. Add your top sellers above.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {products.map((p) => (
                <div key={p.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 border border-[var(--line)] rounded-[10px] bg-[var(--card)]" style={{ padding: 12 }}>
                  <div className="md:col-span-4">
                    <input className={fieldCls} style={fStyle} defaultValue={p.name}
                      onBlur={(e) => e.target.value !== p.name && patchProduct(p.id, { name: e.target.value })} />
                  </div>
                  <div className="md:col-span-5">
                    <input className={fieldCls} style={fStyle} defaultValue={(p.name_aliases || []).join(', ')}
                      placeholder="aliases"
                      onBlur={(e) => {
                        const next = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                        if (JSON.stringify(next) !== JSON.stringify(p.name_aliases || [])) {
                          patchProduct(p.id, { name_aliases: next });
                        }
                      }} />
                  </div>
                  <div className="md:col-span-2">
                    <select className={fieldCls} style={fStyle} defaultValue={p.unit}
                      onChange={(e) => patchProduct(p.id, { unit: e.target.value as GroceryUnit })}>
                      {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-1 flex items-center justify-end">
                    <button onClick={() => removeProduct(p.id, p.name)}
                      className="rounded-[8px] border border-red-500/30 text-red-500 hover:bg-red-500/10 text-[12px] font-semibold"
                      style={{ padding: '6px 10px' }}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
