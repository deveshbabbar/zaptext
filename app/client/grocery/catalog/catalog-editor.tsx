'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PageTopbar, PageHead, Pill, Panel } from '@/components/app/primitives';
import type { GroceryProduct } from '@/lib/grocery/types';

type CatalogRow = { price_per_unit: number; in_stock: boolean; stock_qty: number | null };

interface Props {
  businessName: string;
  date: string;
  products: GroceryProduct[];
  initialCatalog: Record<string, CatalogRow>;
}

export function DailyCatalogEditor({ businessName, date, products, initialCatalog }: Props) {
  const [rows, setRows] = useState<Record<string, CatalogRow>>(initialCatalog);
  const [filter, setFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [dirty, setDirty] = useState(false);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.name_aliases || []).some((a) => a.toLowerCase().includes(q))
    );
  }, [products, filter]);

  const setRow = (id: string, patch: Partial<CatalogRow>) => {
    setRows((prev) => ({ ...prev, [id]: { ...(prev[id] || { price_per_unit: 0, in_stock: true, stock_qty: null }), ...patch } }));
    setDirty(true);
  };

  async function saveAll() {
    setSaving(true);
    try {
      const items = Object.entries(rows)
        .filter(([, r]) => typeof r.price_per_unit === 'number' && r.price_per_unit > 0)
        .map(([product_id, r]) => ({
          product_id,
          price_per_unit: r.price_per_unit,
          in_stock: r.in_stock,
          stock_qty: r.stock_qty,
        }));
      const res = await fetch('/api/grocery/daily-catalog/upsert', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed');
      toast.success(`Today's catalog saved (${data.count} items)`);
      setDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function copyYesterday() {
    if (Object.keys(rows).length > 0 && !window.confirm("Copy yesterday's prices over today's? Unsaved edits will be replaced after reload.")) {
      return;
    }
    setCopying(true);
    try {
      const res = await fetch('/api/grocery/daily-catalog/copy-yesterday', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed');
      toast.success(`Copied ${data.count} rows from yesterday — reloading…`);
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Copy failed');
    } finally {
      setCopying(false);
    }
  }

  const inStockCount = Object.values(rows).filter((r) => r.in_stock && r.price_per_unit > 0).length;
  const outOfStockCount = Object.values(rows).filter((r) => !r.in_stock).length;
  const noProducts = products.length === 0;

  const fieldCls = 'w-full rounded-[8px] border border-[var(--line)] bg-[var(--card)] focus:border-[var(--ink)] focus:outline-none text-[13.5px]';
  const fStyle = { padding: '6px 10px' };

  return (
    <>
      <PageTopbar
        crumbs={<>Grocery / <a href="/client/grocery" className="hover:underline">Overview</a> / <b className="text-foreground">Today&apos;s catalog</b></>}
        actions={
          <>
            <Pill variant="ghost" onClick={copyYesterday} disabled={copying || noProducts}>
              {copying ? 'Copying…' : 'Copy yesterday'}
            </Pill>
            <Pill variant="ink" onClick={saveAll} disabled={!dirty || saving || noProducts}>
              {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
            </Pill>
          </>
        }
      />
      <div style={{ padding: '28px 32px 80px' }}>
        <PageHead
          title={<>{businessName} <span className="zt-serif">today.</span></>}
          sub={`${date} — set price + stock for each product. Bot quotes only items priced > 0.`}
        />

        {noProducts ? (
          <Panel title="No products yet" sub="Add products in the master catalog first.">
            <Pill variant="ink" href="/client/grocery/products">Go to products</Pill>
          </Panel>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-[10px] border border-[var(--line)]" style={{ padding: '10px 14px' }}>
                <div className="text-[11px] uppercase tracking-[.06em] text-[var(--mute)]">In-stock</div>
                <div className="text-[22px] font-bold">{inStockCount}</div>
              </div>
              <div className="rounded-[10px] border border-[var(--line)]" style={{ padding: '10px 14px' }}>
                <div className="text-[11px] uppercase tracking-[.06em] text-[var(--mute)]">Out-of-stock</div>
                <div className="text-[22px] font-bold">{outOfStockCount}</div>
              </div>
              <div className="rounded-[10px] border border-[var(--line)]" style={{ padding: '10px 14px' }}>
                <div className="text-[11px] uppercase tracking-[.06em] text-[var(--mute)]">Total products</div>
                <div className="text-[22px] font-bold">{products.length}</div>
              </div>
            </div>

            <Panel title="Filter" className="mb-3">
              <input className={fieldCls} style={{ padding: '10px 12px' }}
                placeholder="Search products by name or alias…"
                value={filter} onChange={(e) => setFilter(e.target.value)} />
            </Panel>

            <Panel title="Products" sub={`${filtered.length} shown · update price ₹/unit and toggle stock`}>
              <div className="grid grid-cols-12 gap-2 text-[11px] uppercase tracking-[.06em] text-[var(--mute)] font-semibold border-b border-[var(--line)] pb-2 mb-2">
                <div className="col-span-5">Product</div>
                <div className="col-span-3">Price ₹ / unit</div>
                <div className="col-span-2">Stock qty (opt)</div>
                <div className="col-span-2">In stock</div>
              </div>
              <div className="flex flex-col gap-1">
                {filtered.map((p) => {
                  const r = rows[p.id] || { price_per_unit: 0, in_stock: true, stock_qty: null };
                  return (
                    <div key={p.id} className="grid grid-cols-12 gap-2 items-center py-1.5 border-b border-[var(--line)] last:border-b-0">
                      <div className="col-span-5">
                        <div className="text-[13.5px] font-semibold">{p.name}</div>
                        <div className="text-[11px] text-[var(--mute)] zt-mono uppercase">per {p.unit}</div>
                      </div>
                      <div className="col-span-3">
                        <input type="number" min={0} step="0.01" className={fieldCls} style={fStyle}
                          value={r.price_per_unit || ''}
                          onChange={(e) => setRow(p.id, { price_per_unit: e.target.value === '' ? 0 : Number(e.target.value) })}
                          placeholder="0.00" />
                      </div>
                      <div className="col-span-2">
                        <input type="number" min={0} className={fieldCls} style={fStyle}
                          value={r.stock_qty ?? ''}
                          onChange={(e) => setRow(p.id, { stock_qty: e.target.value === '' ? null : Number(e.target.value) })}
                          placeholder="—" />
                      </div>
                      <div className="col-span-2">
                        <button type="button" onClick={() => setRow(p.id, { in_stock: !r.in_stock })}
                          className="rounded-full text-[11.5px] font-semibold"
                          style={{
                            padding: '4px 12px',
                            border: '1px solid ' + (r.in_stock ? '#16a34a' : '#dc2626'),
                            color: r.in_stock ? '#16a34a' : '#dc2626',
                            background: r.in_stock ? '#16a34a15' : '#dc262615',
                          }}>
                          {r.in_stock ? 'In stock' : 'Out'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </>
        )}
      </div>
    </>
  );
}
