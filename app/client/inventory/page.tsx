'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { PageTopbar, PageHead, Panel, Pill, StatusPill } from '@/components/app/primitives';

interface InventoryItem {
  client_id: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
  low_stock_threshold: number;
  is_active: boolean;
  updated_at: string;
  notes: string;
  available_from?: string;
  available_to?: string;
  available_days?: string[];
  category?: string;
  tracks_stock?: boolean;
}

interface InventoryCategory {
  id: string;
  name: string;
  tracks_stock: boolean;
  display_order: number;
}

const ALL_DAYS: { key: string; label: string }[] = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

function humanizeAvailability(i: InventoryItem): string {
  const from = (i.available_from || '').trim();
  const to = (i.available_to || '').trim();
  const days = i.available_days || [];
  const hasWindow = from || to;
  const hasDays = days.length > 0 && days.length < 7;
  if (!hasWindow && !hasDays) return '24×7';
  const parts: string[] = [];
  if (hasWindow) parts.push(`${from || '00:00'}–${to || '24:00'}`);
  if (hasDays) parts.push(days.map((d) => d[0].toUpperCase() + d.slice(1)).join('/'));
  return parts.join(' · ');
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [syncingForm, setSyncingForm] = useState(false);

  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newStock, setNewStock] = useState('');
  const [newThreshold, setNewThreshold] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [categories, setCategories] = useState<InventoryCategory[]>([]);

  // ── Bulk-update state (Work Item 3) ──────────────────────────────────
  // Checked rows accumulate here. The bulk-action bar appears only while
  // this set is non-empty. Cleared after a successful Apply.
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set());
  const [bulkStock, setBulkStock] = useState('');
  const [bulkThreshold, setBulkThreshold] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const toggleSku = (sku: string) => {
    setSelectedSkus((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  };
  const setGroupSelection = (skus: string[], on: boolean) => {
    setSelectedSkus((prev) => {
      const next = new Set(prev);
      for (const sku of skus) {
        if (on) next.add(sku);
        else next.delete(sku);
      }
      return next;
    });
  };
  const clearBulkSelection = () => {
    setSelectedSkus(new Set());
    setBulkStock('');
    setBulkThreshold('');
  };
  async function applyBulk(patch: {
    stock?: number;
    low_stock_threshold?: number;
    is_active?: boolean;
  }) {
    if (selectedSkus.size === 0) return;
    if (Object.keys(patch).length === 0) {
      toast.error('Set a value to apply');
      return;
    }
    setBulkBusy(true);
    try {
      const res = await fetch('/api/client/inventory/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skus: Array.from(selectedSkus), patch }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        updated?: number;
        skipped?: number;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        toast.error(data.error || `Bulk update failed (${res.status})`);
        return;
      }
      const skippedNote = data.skipped && data.skipped > 0 ? ` · ${data.skipped} skipped` : '';
      toast.success(`Updated ${data.updated ?? 0} item${(data.updated ?? 0) === 1 ? '' : 's'}${skippedNote}`);
      clearBulkSelection();
      await load();
    } catch {
      toast.error('Bulk update failed');
    } finally {
      setBulkBusy(false);
    }
  }

  // Per-row availability editor state (keyed by sku).
  // File-import preview state
  interface ImportedProduct {
    name: string;
    price?: number;
    stock?: number;
    notes?: string;
  }
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportedProduct[] | null>(null);
  const [importFilename, setImportFilename] = useState('');
  const [importWarning, setImportWarning] = useState('');
  // Monotonic counter — each new file pick increments it; stale fetch responses
  // (from a previously selected file) are ignored when the ID no longer matches.
  const importSeqRef = useRef(0);

  const handleFilePick = async (file: File) => {
    const seq = ++importSeqRef.current;
    setImporting(true);
    setImportPreview(null);
    setImportWarning('');
    setImportFilename(file.name);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/client/inventory/import', { method: 'POST', body: fd });
      if (importSeqRef.current !== seq) return; // stale — a newer file was picked
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Import failed');
        setImportOpen(false);
        return;
      }
      setImportPreview(Array.isArray(data.items) ? data.items : []);
      setImportWarning(data.warning || '');
      setImportOpen(true);
    } catch {
      if (importSeqRef.current === seq) toast.error('Upload failed');
    } finally {
      if (importSeqRef.current === seq) setImporting(false);
    }
  };

  const confirmBulkImport = async () => {
    if (!importPreview || importPreview.length === 0) return;
    setImporting(true);
    try {
      const res = await fetch('/api/client/inventory/bulk-upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: importPreview }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || `${data.imported} imported`);
        setImportOpen(false);
        setImportPreview(null);
        await load();
      } else {
        toast.error(data.error || 'Bulk import failed');
      }
    } catch {
      toast.error('Bulk import failed');
    } finally {
      setImporting(false);
    }
  };

  const [editingHoursFor, setEditingHoursFor] = useState<string | null>(null);
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');
  const [draftDays, setDraftDays] = useState<Set<string>>(new Set());

  const openHoursEditor = (item: InventoryItem) => {
    setEditingHoursFor(item.sku);
    setDraftFrom(item.available_from || '');
    setDraftTo(item.available_to || '');
    setDraftDays(new Set(item.available_days || []));
  };

  const closeHoursEditor = () => {
    setEditingHoursFor(null);
    setDraftFrom('');
    setDraftTo('');
    setDraftDays(new Set());
  };

  const toggleDraftDay = (d: string) => {
    setDraftDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  };

  const saveAvailability = async (item: InventoryItem) => {
    setSaving(item.sku);
    try {
      const res = await fetch('/api/client/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: item.name,
          sku: item.sku,
          available_from: draftFrom.trim(),
          available_to: draftTo.trim(),
          available_days: Array.from(draftDays),
        }),
      });
      const data = await res.json();
      if (res.ok && data.item) {
        setItems((prev) => prev.map((i) => (i.sku === item.sku ? data.item : i)));
        toast.success('Hours saved');
        closeHoursEditor();
      } else {
        toast.error(data.error || 'Failed to save hours');
      }
    } catch {
      toast.error('Failed to save hours');
    } finally {
      setSaving(null);
    }
  };

  const runSyncFromForm = async () => {
    setSyncingForm(true);
    try {
      const res = await fetch('/api/client/inventory/sync-from-form', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Synced');
        await load();
      } else {
        toast.error(data.error || data.message || 'Sync failed');
      }
    } catch {
      toast.error('Sync failed');
    } finally {
      setSyncingForm(false);
    }
  };

  const load = async () => {
    try {
      // Items + categories in parallel — both feed the inventory page render.
      const [itemsRes, catsRes] = await Promise.all([
        fetch('/api/client/inventory'),
        fetch('/api/client/inventory/categories'),
      ]);
      const itemsData = await itemsRes.json();
      setItems(itemsData.items || []);
      // Categories endpoint may 404 on legacy bots that haven't been seeded
      // yet — treat that as an empty list rather than an error.
      if (catsRes.ok) {
        const catsData = await catsRes.json();
        setCategories(Array.isArray(catsData.categories) ? catsData.categories : []);
      }
      // ── One-time price recovery for bots written before the parsePrice
      //    fix (commit 97bc8ae). The old regex kept the trailing dot in
      //    "Rs.199" and parseFloat read it as 0.199, so every Rs.-prefixed
      //    item landed in the DB at 1/1000th its real value (₹199 → ₹0.2
      //    in the UI). Detection heuristic: if MORE THAN HALF the items
      //    are priced under ₹1, the table is almost certainly stale —
      //    no real menu has half its items below a rupee. Re-run the
      //    sync, which uses the fixed parser. Safe because:
      //      • Inventory items added manually via "Add new item" come
      //        in as numbers, not strings, so they bypass parsePrice.
      //      • The sync only touches items that exist in knowledge_base —
      //        manually added items without a KB counterpart are left
      //        untouched.
      //      • Stock counts and low_stock_threshold are preserved across
      //        the upsert (see lib/db/inventory.ts L104-L112).
      const itemsArr = (itemsData.items || []) as InventoryItem[];
      const tinyPriced = itemsArr.filter((it) => it.price > 0 && it.price < 1);
      const looksStale = itemsArr.length >= 4 && tinyPriced.length >= itemsArr.length / 2;
      if (looksStale) {
        try {
          const fixRes = await fetch('/api/client/inventory/sync-from-form', { method: 'POST' });
          if (fixRes.ok) {
            // Re-read items so the table renders with the recovered prices
            // without the user having to refresh manually.
            const refreshed = await fetch('/api/client/inventory').then((r) => r.json());
            if (Array.isArray(refreshed.items)) {
              setItems(refreshed.items);
              toast.success('Prices auto-recovered from your menu data');
            }
          }
        } catch {
          // Non-fatal — user can still click "Sync products from form" manually.
        }
      }
    } catch {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const addItem = async () => {
    if (!newName.trim()) {
      toast.error('Name required');
      return;
    }
    setSaving('add');
    try {
      // If the chosen category has tracks_stock=false, don't write a stock
      // value — leaves the item with stock=0 / tracks_stock=false at the
      // server which the bot prompt then surfaces as "always available".
      const selectedCat = categories.find((c) => c.name === newCategory);
      const tracksStock = selectedCat ? selectedCat.tracks_stock : true;
      const res = await fetch('/api/client/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          price: newPrice ? parseFloat(newPrice) : 0,
          stock: tracksStock && newStock ? parseInt(newStock, 10) : 0,
          low_stock_threshold: tracksStock && newThreshold ? parseInt(newThreshold, 10) : 0,
          is_active: true,
          category: newCategory || '',
          tracks_stock: tracksStock,
        }),
      });
      if (res.ok) {
        toast.success(`Added ${newName}`);
        setNewName('');
        setNewPrice('');
        setNewStock('');
        setNewThreshold('');
        setNewCategory('');
        await load();
      } else {
        toast.error('Failed to add item');
      }
    } finally {
      setSaving(null);
    }
  };

  const updateStock = async (sku: string, nextStock: number) => {
    const previousStock = items.find((i) => i.sku === sku)?.stock ?? 0;
    setSaving(sku);
    try {
      const res = await fetch('/api/client/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _action: 'set-stock', sku, stock: nextStock }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((i) => (i.sku === sku ? { ...i, stock: Math.max(0, Math.floor(nextStock)) } : i))
        );
        toast.success('Stock updated');
      } else {
        // Revert optimistic local value so UI matches server state
        setItems((prev) => prev.map((i) => (i.sku === sku ? { ...i, stock: previousStock } : i)));
        toast.error('Update failed');
      }
    } catch {
      setItems((prev) => prev.map((i) => (i.sku === sku ? { ...i, stock: previousStock } : i)));
      toast.error('Update failed');
    } finally {
      setSaving(null);
    }
  };

  const adjust = async (sku: string, delta: number) => {
    setSaving(sku);
    try {
      const res = await fetch('/api/client/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _action: 'adjust-stock', sku, delta }),
      });
      const data = await res.json();
      if (res.ok && data.item) {
        setItems((prev) => prev.map((i) => (i.sku === sku ? data.item : i)));
      } else {
        toast.error('Update failed');
      }
    } finally {
      setSaving(null);
    }
  };

  const toggleActive = async (item: InventoryItem) => {
    setSaving(item.sku);
    try {
      const res = await fetch('/api/client/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: item.name,
          sku: item.sku,
          is_active: !item.is_active,
        }),
      });
      const data = await res.json();
      if (res.ok && data.item) {
        setItems((prev) => prev.map((i) => (i.sku === item.sku ? data.item : i)));
      }
    } finally {
      setSaving(null);
    }
  };

  const deleteItem = async (sku: string, name: string) => {
    if (!window.confirm(`Remove "${name}" from active inventory?`)) return;
    setSaving(sku);
    try {
      const res = await fetch('/api/client/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _action: 'delete', sku }),
      });
      if (res.ok) {
        setItems((prev) => prev.map((i) => (i.sku === sku ? { ...i, is_active: false } : i)));
        toast.success(`${name} deactivated`);
      }
    } finally {
      setSaving(null);
    }
  };

  const active = items.filter((i) => i.is_active);
  const inactive = items.filter((i) => !i.is_active);
  const lowStock = active.filter((i) => i.low_stock_threshold > 0 && i.stock <= i.low_stock_threshold);

  // Group active items by category for display. Categories without items
  // are dropped from the render so the page doesn't show a wall of empty
  // panels for verticals that haven't filled in every default. Items with
  // an unknown / blank category land under "Uncategorised" at the bottom.
  const groupedActive: Array<{ name: string; tracks_stock: boolean; items: InventoryItem[] }> = (() => {
    const map = new Map<string, { tracks_stock: boolean; items: InventoryItem[] }>();
    for (const c of categories) {
      map.set(c.name, { tracks_stock: c.tracks_stock, items: [] });
    }
    for (const it of active) {
      const cat = it.category && map.has(it.category) ? it.category : 'Uncategorised';
      if (!map.has(cat)) {
        map.set(cat, { tracks_stock: it.tracks_stock !== false, items: [] });
      }
      map.get(cat)!.items.push(it);
    }
    return Array.from(map.entries())
      .filter(([, g]) => g.items.length > 0)
      .map(([name, g]) => ({ name, tracks_stock: g.tracks_stock, items: g.items }));
  })();

  return (
    <>
      <PageTopbar
        crumbs={
          <>
            <b className="text-foreground">Products &amp; Inventory</b> · {active.length} active ·{' '}
            {lowStock.length > 0 ? `${lowStock.length} low-stock` : 'all good'}
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <label className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full font-semibold text-[13px] border border-[var(--line)] bg-[var(--card)] hover:border-[var(--ink)] cursor-pointer transition hover:-translate-y-px whitespace-nowrap ${importing ? 'opacity-60 cursor-wait' : ''}`}>
              {importing ? 'Parsing…' : '📄 Import CSV / Excel'}
              <input
                type="file"
                accept=".csv,.tsv,.txt,.xlsx,.xlsm,.pdf"
                className="hidden"
                disabled={importing}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFilePick(f);
                  e.target.value = '';
                }}
              />
            </label>
            <Pill variant="ghost" onClick={runSyncFromForm}>
              {syncingForm ? 'Syncing…' : '📥 Sync products from form'}
            </Pill>
          </div>
        }
      />
      <div style={{ padding: '28px 32px 60px' }} className="max-w-5xl">
        <PageHead
          title={<>Your <span className="zt-serif">products.</span></>}
          sub="Menu / services / plans from your onboarding form auto-sync here. Bot auto-decrements on every order. Adjust stock or mark items unavailable anytime."
        />

        <Panel title="Add new item" sub="Pick a category — stock fields auto-hide for service-style categories like memberships, services, and courses.">
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1.2fr_auto] gap-2.5">
            <input
              placeholder="Name (e.g. Dum Biryani)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={saving === 'add'}
              className="rounded-[10px] border border-[var(--line)] bg-[var(--card)] focus:border-[var(--ink)] focus:outline-none text-[13.5px] disabled:opacity-50"
              style={{ padding: '10px 12px' }}
            />
            <input
              placeholder="Price ₹"
              type="number"
              min={0}
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              disabled={saving === 'add'}
              className="rounded-[10px] border border-[var(--line)] bg-[var(--card)] focus:border-[var(--ink)] focus:outline-none text-[13.5px] disabled:opacity-50"
              style={{ padding: '10px 12px' }}
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              disabled={saving === 'add'}
              className="rounded-[10px] border border-[var(--line)] bg-[var(--card)] focus:border-[var(--ink)] focus:outline-none text-[13.5px] disabled:opacity-50"
              style={{ padding: '10px 12px' }}
            >
              <option value="">— Category (optional) —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}{c.tracks_stock ? '' : ' (no stock)'}
                </option>
              ))}
            </select>
            <Pill variant="ink" onClick={addItem} disabled={saving === 'add'}>
              {saving === 'add' ? 'Adding…' : '+ Add'}
            </Pill>
          </div>
          {/* Stock + threshold only shown when the chosen category tracks stock.
              For service-style categories (memberships, services, courses,
              listings) those fields would be misleading. */}
          {(() => {
            const selected = categories.find((c) => c.name === newCategory);
            const showStock = !selected || selected.tracks_stock;
            if (!showStock) return null;
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-2.5">
                <input
                  placeholder="Stock"
                  type="number"
                  min={0}
                  value={newStock}
                  onChange={(e) => setNewStock(e.target.value)}
                  disabled={saving === 'add'}
                  className="rounded-[10px] border border-[var(--line)] bg-[var(--card)] focus:border-[var(--ink)] focus:outline-none text-[13.5px] disabled:opacity-50"
                  style={{ padding: '10px 12px' }}
                />
                <input
                  placeholder="Low alert at"
                  type="number"
                  min={0}
                  value={newThreshold}
                  onChange={(e) => setNewThreshold(e.target.value)}
                  disabled={saving === 'add'}
                  className="rounded-[10px] border border-[var(--line)] bg-[var(--card)] focus:border-[var(--ink)] focus:outline-none text-[13.5px] disabled:opacity-50"
                  style={{ padding: '10px 12px' }}
                />
              </div>
            );
          })()}
        </Panel>

        {loading ? (
          <div className="animate-pulse h-48 bg-[var(--card)] border border-[var(--line)] rounded-[18px] mt-4" />
        ) : (
          <>
            {lowStock.length > 0 && (
              <div
                className="rounded-[14px] mt-4 flex items-start gap-3"
                style={{
                  padding: 16,
                  background: 'color-mix(in oklab, #E89A1C 14%, transparent)',
                  border: '1px solid color-mix(in oklab, #E89A1C 45%, transparent)',
                }}
              >
                <div className="text-[22px]">⚠️</div>
                <div className="flex-1 text-[13px]">
                  <b>{lowStock.length} item{lowStock.length > 1 ? 's' : ''} low on stock</b>
                  <div className="text-[var(--ink-2)] mt-0.5">
                    {lowStock.map((l) => `${l.name} (${l.stock} left)`).join(' · ')}
                  </div>
                </div>
              </div>
            )}

            {active.length === 0 ? (
              <Panel title="Active items" sub="0 items" className="mt-4">
                <p className="text-[13px] text-[var(--mute)] m-0 text-center py-4">
                  No items yet. Add your first above.
                </p>
              </Panel>
            ) : groupedActive.map((group) => (
              <Panel
                key={group.name}
                title={group.name}
                sub={`${group.items.length} item${group.items.length === 1 ? '' : 's'}${group.tracks_stock ? '' : ' · no stock tracking'}`}
                className="mt-4"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-[13.5px]" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {/* Bulk-select master checkbox for this group. Reflects
                            "all selected", "some selected" (indeterminate), or
                            "none selected" based on the group's items. */}
                        <th
                          className="bg-[var(--bg-2)]"
                          style={{ padding: '10px 8px 10px 12px', borderBottom: '1px solid var(--line)', width: 32 }}
                        >
                          <input
                            type="checkbox"
                            aria-label={`Select all in ${group.name}`}
                            checked={
                              group.items.length > 0 &&
                              group.items.every((it) => selectedSkus.has(it.sku))
                            }
                            ref={(el) => {
                              if (!el) return;
                              const selectedHere = group.items.filter((it) => selectedSkus.has(it.sku)).length;
                              el.indeterminate = selectedHere > 0 && selectedHere < group.items.length;
                            }}
                            onChange={(e) =>
                              setGroupSelection(group.items.map((it) => it.sku), e.target.checked)
                            }
                          />
                        </th>
                        {(group.tracks_stock
                          ? ['Name', 'Price', 'Stock', 'Threshold', 'Updated', 'Actions']
                          : ['Name', 'Price', 'Updated', 'Actions']
                        ).map((h) => (
                          <th
                            key={h}
                            className="zt-mono text-[10.5px] uppercase tracking-[.08em] text-[var(--mute)] font-medium bg-[var(--bg-2)]"
                            style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--line)' }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((it) => {
                        const isLow = it.low_stock_threshold > 0 && it.stock <= it.low_stock_threshold;
                        const isOut = it.stock === 0;
                        const availability = humanizeAvailability(it);
                        const editing = editingHoursFor === it.sku;
                        return (
                          <Fragment key={it.sku}>
                          <tr>
                            <td
                              style={{ padding: '10px 8px 10px 12px', borderBottom: editing ? 'none' : '1px solid var(--line)', width: 32 }}
                            >
                              <input
                                type="checkbox"
                                aria-label={`Select ${it.name}`}
                                checked={selectedSkus.has(it.sku)}
                                onChange={() => toggleSku(it.sku)}
                              />
                            </td>
                            <td style={{ padding: '10px 12px', borderBottom: editing ? 'none' : '1px solid var(--line)' }}>
                              <div className="font-semibold">{it.name}</div>
                              <div className="zt-mono text-[11.5px] text-[var(--mute)]">{it.sku}</div>
                              <div className={`text-[11px] mt-0.5 ${availability === '24×7' ? 'text-[var(--mute)]' : 'text-[var(--ink)] font-semibold'}`}>
                                🕒 {availability}
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
                              {it.price > 0 ? `₹${it.price}` : '—'}
                            </td>
                            {group.tracks_stock && (
                              <>
                                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => adjust(it.sku, -1)}
                                      disabled={saving === it.sku || it.stock === 0}
                                      className="w-7 h-7 rounded-[6px] border border-[var(--line)] hover:border-[var(--ink)] disabled:opacity-40"
                                    >
                                      −
                                    </button>
                                    <input
                                      type="number"
                                      min={0}
                                      value={it.stock}
                                      onChange={(e) => {
                                        const v = parseInt(e.target.value || '0', 10);
                                        setItems((prev) => prev.map((i) => (i.sku === it.sku ? { ...i, stock: v } : i)));
                                      }}
                                      onBlur={(e) => updateStock(it.sku, parseInt(e.target.value || '0', 10))}
                                      className={`w-[72px] text-center rounded-[6px] border text-[13px] font-semibold ${
                                        isOut
                                          ? 'border-red-500/40 text-red-500'
                                          : isLow
                                          ? 'border-[#E89A1C] text-[#E89A1C]'
                                          : 'border-[var(--line)]'
                                      }`}
                                      style={{ padding: '4px 6px' }}
                                    />
                                    <button
                                      onClick={() => adjust(it.sku, 1)}
                                      disabled={saving === it.sku}
                                      className="w-7 h-7 rounded-[6px] border border-[var(--line)] hover:border-[var(--ink)] disabled:opacity-40"
                                    >
                                      +
                                    </button>
                                    {isOut && <StatusPill variant="cancel">OUT</StatusPill>}
                                    {!isOut && isLow && <StatusPill variant="pending">LOW</StatusPill>}
                                  </div>
                                </td>
                                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
                                  {it.low_stock_threshold > 0 ? it.low_stock_threshold : '—'}
                                </td>
                              </>
                            )}
                            <td className="zt-mono text-[11.5px] text-[var(--mute)]" style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
                              {it.updated_at ? it.updated_at.slice(0, 10) : '—'}
                            </td>
                            <td style={{ padding: '10px 12px', borderBottom: editing ? 'none' : '1px solid var(--line)', textAlign: 'right' }}>
                              <button
                                onClick={() => (editing ? closeHoursEditor() : openHoursEditor(it))}
                                className="rounded-[8px] border border-[var(--line)] hover:border-[var(--ink)] font-semibold text-[11.5px] mr-1.5"
                                style={{ padding: '5px 9px' }}
                              >
                                {editing ? '✕ Close' : '⏰ Hours'}
                              </button>
                              <button
                                onClick={() => toggleActive(it)}
                                disabled={saving === it.sku}
                                className="rounded-[8px] border border-[var(--line)] hover:border-[var(--ink)] font-semibold text-[11.5px] mr-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ padding: '5px 9px' }}
                              >
                                {saving === it.sku ? 'Saving…' : 'Pause'}
                              </button>
                              <button
                                onClick={() => deleteItem(it.sku, it.name)}
                                className="rounded-[8px] border border-red-500/40 text-red-500 hover:bg-red-500/10 font-semibold text-[11.5px]"
                                style={{ padding: '5px 9px' }}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                          {editing && (
                            <tr>
                              <td colSpan={7} style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', background: 'var(--bg-2)' }}>
                                <div className="flex flex-wrap items-end gap-3">
                                  <div>
                                    <div className="text-[11.5px] font-semibold mb-1">Available from (HH:MM)</div>
                                    <input
                                      type="time"
                                      value={draftFrom}
                                      onChange={(e) => setDraftFrom(e.target.value)}
                                      disabled={saving === it.sku}
                                      className="rounded-[8px] border border-[var(--line)] bg-[var(--card)] text-[13px] disabled:opacity-50"
                                      style={{ padding: '6px 8px' }}
                                    />
                                  </div>
                                  <div>
                                    <div className="text-[11.5px] font-semibold mb-1">Available to (HH:MM)</div>
                                    <input
                                      type="time"
                                      value={draftTo}
                                      onChange={(e) => setDraftTo(e.target.value)}
                                      disabled={saving === it.sku}
                                      className="rounded-[8px] border border-[var(--line)] bg-[var(--card)] text-[13px] disabled:opacity-50"
                                      style={{ padding: '6px 8px' }}
                                    />
                                  </div>
                                  <div>
                                    <div className="text-[11.5px] font-semibold mb-1">Days (empty = every day)</div>
                                    <div className="flex gap-1">
                                      {ALL_DAYS.map((d) => {
                                        const on = draftDays.has(d.key);
                                        return (
                                          <button
                                            key={d.key}
                                            type="button"
                                            onClick={() => toggleDraftDay(d.key)}
                                            disabled={saving === it.sku}
                                            className={`text-[11px] font-semibold rounded-[6px] border disabled:opacity-50 ${
                                              on
                                                ? 'bg-[var(--ink)] text-[var(--background)] border-[var(--ink)]'
                                                : 'bg-[var(--card)] border-[var(--line)] hover:border-[var(--ink)]'
                                            }`}
                                            style={{ padding: '5px 8px' }}
                                          >
                                            {d.label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => saveAvailability(it)}
                                    disabled={saving === it.sku}
                                    className="rounded-[8px] bg-[var(--ink)] text-[var(--background)] font-semibold text-[12px] disabled:opacity-50"
                                    style={{ padding: '8px 14px' }}
                                  >
                                    {saving === it.sku ? 'Saving…' : 'Save hours'}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setDraftFrom(''); setDraftTo(''); setDraftDays(new Set());
                                    }}
                                    disabled={saving === it.sku}
                                    className="text-[11.5px] text-[var(--mute)] hover:text-[var(--ink)] underline disabled:opacity-50"
                                  >
                                    Clear (24×7)
                                  </button>
                                </div>
                                <p className="text-[11px] text-[var(--mute)] mt-2 m-0">
                                  Bot will not accept orders for this item outside the window. Leave blank for 24×7. Wrap-around ok (e.g. 22:00 → 02:00 = evening + late-night).
                                </p>
                              </td>
                            </tr>
                          )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Panel>
            ))}

            {inactive.length > 0 && (
              <Panel title="Inactive items" sub="Bot won't offer these. Toggle to bring back." className="mt-4">
                <div className="flex flex-wrap gap-2">
                  {inactive.map((it) => (
                    <button
                      key={it.sku}
                      onClick={() => toggleActive(it)}
                      className="rounded-full border border-[var(--line)] hover:border-[var(--ink)] text-[12.5px] font-medium"
                      style={{ padding: '6px 12px' }}
                    >
                      {it.name} · bring back
                    </button>
                  ))}
                </div>
              </Panel>
            )}
          </>
        )}
      </div>

      {importOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => !importing && setImportOpen(false)}
        >
          <div
            className="bg-[var(--card)] rounded-[16px] border border-[var(--line)] max-w-3xl w-[90vw] max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-[var(--line)]">
              <div>
                <div className="font-bold text-[17px]">
                  Review imported products{importPreview ? ` · ${importPreview.length} found` : ''}
                </div>
                <div className="text-[12px] text-[var(--mute)] zt-mono">{importFilename}</div>
              </div>
              <button
                onClick={() => !importing && setImportOpen(false)}
                className="text-[18px] text-[var(--mute)] hover:text-[var(--ink)] px-2"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {importWarning && (
                <div className="rounded-[8px] border border-amber-500/40 bg-amber-500/10 text-[13px] mb-4" style={{ padding: '10px 12px' }}>
                  ⚠️ {importWarning}
                </div>
              )}

              {importPreview && importPreview.length > 0 ? (
                <table className="w-full text-[13px]" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Name', 'Price (₹)', 'Stock', 'Notes', ''].map((h) => (
                        <th
                          key={h}
                          className="zt-mono text-[10.5px] uppercase tracking-[.08em] text-[var(--mute)] font-medium"
                          style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid var(--line)' }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.map((p, i) => (
                      <tr key={i}>
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--line)' }}>
                          <input
                            className="w-full bg-transparent border-b border-transparent hover:border-[var(--line)] focus:border-[var(--ink)] focus:outline-none disabled:opacity-50"
                            value={p.name}
                            disabled={importing}
                            onChange={(e) => {
                              const next = [...importPreview];
                              next[i] = { ...next[i], name: e.target.value };
                              setImportPreview(next);
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--line)' }}>
                          <input
                            type="number"
                            min={0}
                            className="w-20 bg-transparent border-b border-transparent hover:border-[var(--line)] focus:border-[var(--ink)] focus:outline-none disabled:opacity-50"
                            value={p.price ?? 0}
                            disabled={importing}
                            onChange={(e) => {
                              const next = [...importPreview];
                              next[i] = { ...next[i], price: parseFloat(e.target.value) || 0 };
                              setImportPreview(next);
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--line)' }}>
                          <input
                            type="number"
                            min={0}
                            className="w-20 bg-transparent border-b border-transparent hover:border-[var(--line)] focus:border-[var(--ink)] focus:outline-none disabled:opacity-50"
                            value={p.stock ?? 0}
                            disabled={importing}
                            onChange={(e) => {
                              const next = [...importPreview];
                              next[i] = { ...next[i], stock: parseInt(e.target.value, 10) || 0 };
                              setImportPreview(next);
                            }}
                          />
                        </td>
                        <td className="text-[11.5px] text-[var(--mute)]" style={{ padding: '8px 10px', borderBottom: '1px solid var(--line)' }}>
                          {p.notes || '—'}
                        </td>
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--line)', textAlign: 'right' }}>
                          <button
                            onClick={() => setImportPreview(importPreview.filter((_, j) => j !== i))}
                            disabled={importing}
                            className="text-[11px] text-red-500 hover:underline disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-10 text-[var(--mute)] text-[13px]">
                  {importWarning ? 'Nothing to import.' : 'No products detected in the file.'}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-5 border-t border-[var(--line)] text-[12px]">
              <div className="text-[var(--mute)]">
                Review and edit above. Existing products with the same name keep their current stock.
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => !importing && setImportOpen(false)}
                  className="rounded-[10px] border border-[var(--line)] hover:border-[var(--ink)] font-semibold text-[13px]"
                  style={{ padding: '8px 14px' }}
                  disabled={importing}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmBulkImport}
                  disabled={importing || !importPreview || importPreview.length === 0}
                  className="rounded-[10px] bg-[var(--ink)] text-[var(--background)] font-semibold text-[13px] disabled:opacity-60"
                  style={{ padding: '8px 16px' }}
                >
                  {importing ? 'Importing…' : `Import ${importPreview?.length || 0} items`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk-action bar (Work Item 3) ───────────────────────────────
          Sticky bottom toolbar. Visible only while ≥ 1 row is ticked.
          Stock / threshold inputs accept a single value to apply to all
          selected rows; Pause / Resume toggles is_active in one shot. */}
      {selectedSkus.size > 0 && (
        <div
          role="region"
          aria-label="Bulk update toolbar"
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 90,
            background: 'var(--card)',
            borderTop: '1px solid var(--line)',
            boxShadow: '0 -8px 24px rgba(0,0,0,.08)',
          }}
        >
          <div
            className="max-w-5xl mx-auto flex flex-wrap items-center gap-3"
            style={{ padding: '12px 32px' }}
          >
            <div className="font-semibold text-[13px]">
              {selectedSkus.size} selected
            </div>

            <label className="flex items-center gap-2 text-[12px] text-[var(--mute)]">
              Stock
              <input
                type="number"
                min={0}
                value={bulkStock}
                onChange={(e) => setBulkStock(e.target.value)}
                disabled={bulkBusy}
                placeholder="—"
                className="w-[78px] rounded-[8px] border border-[var(--line)] bg-[var(--bg)] text-[13px] font-semibold focus:border-[var(--ink)] focus:outline-none disabled:opacity-50"
                style={{ padding: '5px 8px' }}
              />
            </label>

            <label className="flex items-center gap-2 text-[12px] text-[var(--mute)]">
              Low alert
              <input
                type="number"
                min={0}
                value={bulkThreshold}
                onChange={(e) => setBulkThreshold(e.target.value)}
                disabled={bulkBusy}
                placeholder="—"
                className="w-[78px] rounded-[8px] border border-[var(--line)] bg-[var(--bg)] text-[13px] font-semibold focus:border-[var(--ink)] focus:outline-none disabled:opacity-50"
                style={{ padding: '5px 8px' }}
              />
            </label>

            <Pill
              variant="ink"
              onClick={() => {
                const patch: { stock?: number; low_stock_threshold?: number } = {};
                if (bulkStock.trim()) {
                  const n = parseInt(bulkStock, 10);
                  if (Number.isFinite(n)) patch.stock = Math.max(0, n);
                }
                if (bulkThreshold.trim()) {
                  const n = parseInt(bulkThreshold, 10);
                  if (Number.isFinite(n)) patch.low_stock_threshold = Math.max(0, n);
                }
                applyBulk(patch);
              }}
              disabled={bulkBusy || (!bulkStock.trim() && !bulkThreshold.trim())}
            >
              {bulkBusy ? 'Applying…' : 'Apply'}
            </Pill>

            <button
              type="button"
              onClick={() => applyBulk({ is_active: false })}
              disabled={bulkBusy}
              className="rounded-[8px] border border-[var(--line)] font-semibold text-[12px] disabled:opacity-50 hover:border-[#E89A1C] hover:text-[#E89A1C]"
              style={{ padding: '6px 12px' }}
            >
              Pause all
            </button>
            <button
              type="button"
              onClick={() => applyBulk({ is_active: true })}
              disabled={bulkBusy}
              className="rounded-[8px] border border-[var(--line)] font-semibold text-[12px] disabled:opacity-50 hover:border-[var(--accent)] hover:text-[var(--accent)]"
              style={{ padding: '6px 12px' }}
            >
              Resume all
            </button>

            <button
              type="button"
              onClick={clearBulkSelection}
              disabled={bulkBusy}
              className="ml-auto rounded-[8px] border border-transparent text-[var(--mute)] font-semibold text-[12px] hover:text-[var(--ink)] disabled:opacity-50"
              style={{ padding: '6px 10px' }}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </>
  );
}
