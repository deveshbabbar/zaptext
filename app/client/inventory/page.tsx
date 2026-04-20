'use client';

import { Fragment, useEffect, useState } from 'react';
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

  // Per-row availability editor state (keyed by sku).
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
      const res = await fetch('/api/client/inventory');
      const data = await res.json();
      setItems(data.items || []);
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
      const res = await fetch('/api/client/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          price: newPrice ? parseFloat(newPrice) : 0,
          stock: newStock ? parseInt(newStock, 10) : 0,
          low_stock_threshold: newThreshold ? parseInt(newThreshold, 10) : 0,
          is_active: true,
        }),
      });
      if (res.ok) {
        toast.success(`Added ${newName}`);
        setNewName('');
        setNewPrice('');
        setNewStock('');
        setNewThreshold('');
        await load();
      } else {
        toast.error('Failed to add item');
      }
    } finally {
      setSaving(null);
    }
  };

  const updateStock = async (sku: string, nextStock: number) => {
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
        toast.error('Update failed');
      }
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
          <Pill variant="ghost" onClick={runSyncFromForm}>
            {syncingForm ? 'Syncing…' : '📥 Sync products from form'}
          </Pill>
        }
      />
      <div style={{ padding: '28px 32px 60px' }} className="max-w-5xl">
        <PageHead
          title={<>Your <span className="zt-serif">products.</span></>}
          sub="Menu / services / plans from your onboarding form auto-sync here. Bot auto-decrements on every order. Adjust stock or mark items unavailable anytime."
        />

        <Panel title="Add new item" sub="Price + stock optional. Set a low-stock threshold to get alerts.">
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2.5">
            <input
              placeholder="Name (e.g. Dum Biryani)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="rounded-[10px] border border-[var(--line)] bg-[var(--card)] focus:border-[var(--ink)] focus:outline-none text-[13.5px]"
              style={{ padding: '10px 12px' }}
            />
            <input
              placeholder="Price ₹"
              type="number"
              min={0}
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              className="rounded-[10px] border border-[var(--line)] bg-[var(--card)] focus:border-[var(--ink)] focus:outline-none text-[13.5px]"
              style={{ padding: '10px 12px' }}
            />
            <input
              placeholder="Stock"
              type="number"
              min={0}
              value={newStock}
              onChange={(e) => setNewStock(e.target.value)}
              className="rounded-[10px] border border-[var(--line)] bg-[var(--card)] focus:border-[var(--ink)] focus:outline-none text-[13.5px]"
              style={{ padding: '10px 12px' }}
            />
            <input
              placeholder="Low alert at"
              type="number"
              min={0}
              value={newThreshold}
              onChange={(e) => setNewThreshold(e.target.value)}
              className="rounded-[10px] border border-[var(--line)] bg-[var(--card)] focus:border-[var(--ink)] focus:outline-none text-[13.5px]"
              style={{ padding: '10px 12px' }}
            />
            <Pill variant="ink" onClick={addItem}>
              {saving === 'add' ? 'Adding…' : '+ Add'}
            </Pill>
          </div>
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

            <Panel title="Active items" sub={`${active.length} item${active.length === 1 ? '' : 's'}`} className="mt-4">
              {active.length === 0 ? (
                <p className="text-[13px] text-[var(--mute)] m-0 text-center py-4">
                  No items yet. Add your first above.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13.5px]" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Name', 'Price', 'Stock', 'Threshold', 'Updated', 'Actions'].map((h) => (
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
                      {active.map((it) => {
                        const isLow = it.low_stock_threshold > 0 && it.stock <= it.low_stock_threshold;
                        const isOut = it.stock === 0;
                        const availability = humanizeAvailability(it);
                        const editing = editingHoursFor === it.sku;
                        return (
                          <Fragment key={it.sku}>
                          <tr>
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
                                className="rounded-[8px] border border-[var(--line)] hover:border-[var(--ink)] font-semibold text-[11.5px] mr-1.5"
                                style={{ padding: '5px 9px' }}
                              >
                                Pause
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
                              <td colSpan={6} style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', background: 'var(--bg-2)' }}>
                                <div className="flex flex-wrap items-end gap-3">
                                  <div>
                                    <div className="text-[11.5px] font-semibold mb-1">Available from (HH:MM)</div>
                                    <input
                                      type="time"
                                      value={draftFrom}
                                      onChange={(e) => setDraftFrom(e.target.value)}
                                      className="rounded-[8px] border border-[var(--line)] bg-[var(--card)] text-[13px]"
                                      style={{ padding: '6px 8px' }}
                                    />
                                  </div>
                                  <div>
                                    <div className="text-[11.5px] font-semibold mb-1">Available to (HH:MM)</div>
                                    <input
                                      type="time"
                                      value={draftTo}
                                      onChange={(e) => setDraftTo(e.target.value)}
                                      className="rounded-[8px] border border-[var(--line)] bg-[var(--card)] text-[13px]"
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
                                            className={`text-[11px] font-semibold rounded-[6px] border ${
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
                                    className="rounded-[8px] bg-[var(--ink)] text-[var(--background)] font-semibold text-[12px]"
                                    style={{ padding: '8px 14px' }}
                                  >
                                    {saving === it.sku ? 'Saving…' : 'Save hours'}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setDraftFrom(''); setDraftTo(''); setDraftDays(new Set());
                                    }}
                                    className="text-[11.5px] text-[var(--mute)] hover:text-[var(--ink)] underline"
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
              )}
            </Panel>

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
    </>
  );
}
