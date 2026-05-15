'use client';

// Menu editor for the Restaurant client workspace.
// Loads the active bot's knowledge_base via /api/client/settings, lets the
// owner add/remove sections, add/remove items, bulk import, and save back.

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageTopbar, PageHead, Pill, Panel } from '@/components/app/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RestaurantMenuBulkImport } from '@/components/forms/bulk-import-buttons';

type MenuItem = {
  name?: string;
  price?: string;
  description?: string;
  isVeg?: boolean;
  isBestseller?: boolean;
  sizes?: Array<{ label: string; price: number }> | null;
  // FSSAI Reg 2.4.6 mandates allergen disclosure for the 8 listed
  // allergens. We store them as a string[] so the customer-facing menu
  // page can render badges + the AI prompt can answer allergen queries
  // truthfully.
  allergens?: string[];
};

type MenuCategory = { category?: string; items?: MenuItem[] };

interface SettingsResponse {
  knowledgeBase: string;
}

// The 8 FSSAI-mandated allergens. Keep stable — these are stored on
// menuCategories items + read by the public menu page + AI prompt.
const ALLERGEN_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'milk', label: 'Milk / Dairy' },
  { key: 'eggs', label: 'Eggs' },
  { key: 'gluten', label: 'Gluten / Wheat' },
  { key: 'peanuts', label: 'Peanuts' },
  { key: 'tree-nuts', label: 'Tree nuts' },
  { key: 'soy', label: 'Soy' },
  { key: 'fish', label: 'Fish' },
  { key: 'crustacean', label: 'Crustacean / Prawn' },
];

function emptyItem(): MenuItem {
  return { name: '', price: '', description: '', isVeg: true, isBestseller: false, allergens: [] };
}

type OutletLite = { id: string; name: string; slug?: string };

// `selectedOutletId === null` means "chain default" — edits flow into
// kb.menuCategories. A specific outlet id puts the editor in override
// mode — edits flow into kb.menuByOutlet[outletId]. An outlet with no
// override entry inherits the chain default.

export function MenuEditor({ businessName }: { businessName: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [kb, setKb] = useState<Record<string, unknown>>({});
  const [chainMenu, setChainMenu] = useState<MenuCategory[]>([]);
  const [overrides, setOverrides] = useState<Record<string, MenuCategory[]>>({});
  const [outlets, setOutlets] = useState<OutletLite[]>([]);
  const [multiOutletEnabled, setMultiOutletEnabled] = useState(false);
  const [selectedOutletId, setSelectedOutletId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // The menu the editor renders + mutates. Mirrors either the chain
  // default (selectedOutletId === null) or the active override.
  const menu: MenuCategory[] =
    selectedOutletId === null ? chainMenu : overrides[selectedOutletId] ?? chainMenu;

  // Branch inherits when NO override entry exists. An empty array IS an
  // override (owner explicitly cleared the menu — kitchen renovating etc.)
  const isInheriting =
    selectedOutletId !== null && !Object.prototype.hasOwnProperty.call(overrides, selectedOutletId);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/client/settings');
        if (!res.ok) throw new Error(`load failed (${res.status})`);
        const data = (await res.json()) as SettingsResponse;
        const parsed = data.knowledgeBase ? JSON.parse(data.knowledgeBase) : {};
        setKb(parsed);
        setChainMenu(Array.isArray(parsed.menuCategories) ? parsed.menuCategories : []);
        const mbo = parsed.menuByOutlet;
        setOverrides(mbo && typeof mbo === 'object' && !Array.isArray(mbo) ? (mbo as Record<string, MenuCategory[]>) : {});
        const list = Array.isArray(parsed.outlets) ? (parsed.outlets as OutletLite[]) : [];
        setOutlets(list.filter((o) => o && o.id && o.name));
        setMultiOutletEnabled(parsed.multiOutletEnabled === true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not load menu');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Single setter writes to chain OR active override.
  function setMenu(next: MenuCategory[]) {
    if (selectedOutletId === null) {
      setChainMenu(next);
    } else {
      setOverrides({ ...overrides, [selectedOutletId]: next });
    }
  }

  // Copy chain menu into this outlet's override so the owner can edit
  // it independently. No-op for the chain selection.
  function customizeForThisBranch() {
    if (selectedOutletId === null) return;
    setOverrides({ ...overrides, [selectedOutletId]: structuredClone(chainMenu) });
    setDirty(true);
  }

  // Drop the override entry — branch goes back to inheriting.
  function revertToChainDefault() {
    if (selectedOutletId === null) return;
    if (!confirm('Discard this branch\'s custom menu and inherit the chain default?')) return;
    const next = { ...overrides };
    delete next[selectedOutletId];
    setOverrides(next);
    setDirty(true);
  }

  function markDirty() {
    setDirty(true);
  }

  // Bulk-import wrapper expects { data, onChange }. We feed it the live menu
  // via a synthetic data object, intercept the onChange so we can re-route
  // the updated menuCategories into our local state.
  const bulkImportData = { menuCategories: menu };
  const bulkImportOnChange = (field: string, value: unknown) => {
    if (field === 'menuCategories' && Array.isArray(value)) {
      setMenu(value as MenuCategory[]);
      markDirty();
    }
  };

  function addCategory() {
    setMenu([...menu, { category: '', items: [emptyItem()] }]);
    markDirty();
  }

  function removeCategory(idx: number) {
    setMenu(menu.filter((_, i) => i !== idx));
    markDirty();
  }

  function updateCategoryName(idx: number, name: string) {
    const next = [...menu];
    next[idx] = { ...next[idx], category: name };
    setMenu(next);
    markDirty();
  }

  function addItem(catIdx: number) {
    const next = [...menu];
    const items = [...(next[catIdx].items || []), emptyItem()];
    next[catIdx] = { ...next[catIdx], items };
    setMenu(next);
    markDirty();
  }

  function removeItem(catIdx: number, itemIdx: number) {
    const next = [...menu];
    const items = (next[catIdx].items || []).filter((_, i) => i !== itemIdx);
    next[catIdx] = { ...next[catIdx], items };
    setMenu(next);
    markDirty();
  }

  function updateItem(catIdx: number, itemIdx: number, patch: Partial<MenuItem>) {
    const next = [...menu];
    const items = [...(next[catIdx].items || [])];
    items[itemIdx] = { ...items[itemIdx], ...patch };
    next[catIdx] = { ...next[catIdx], items };
    setMenu(next);
    markDirty();
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Garbage-collect outlet overrides that no longer have a matching
      // outlet (deleted from Outlets editor since last load) so the
      // payload doesn't grow unboundedly.
      const validIds = new Set(outlets.map((o) => o.id));
      const cleanedOverrides: Record<string, MenuCategory[]> = {};
      for (const [id, cats] of Object.entries(overrides)) {
        if (validIds.has(id)) cleanedOverrides[id] = cats;
      }
      const nextKb: Record<string, unknown> = {
        ...kb,
        menuCategories: chainMenu,
        menuByOutlet: cleanedOverrides,
      };
      const res = await fetch('/api/client/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulk: { knowledge_base_json: JSON.stringify(nextKb) } }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        throw new Error(data.message || data.error || `save failed (${res.status})`);
      }
      setKb(nextKb);
      setOverrides(cleanedOverrides);
      setDirty(false);
      toast.success(
        selectedOutletId === null
          ? 'Chain menu saved'
          : `Menu saved for ${outlets.find((o) => o.id === selectedOutletId)?.name || 'this branch'}`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const totalItems = menu.reduce((n, c) => n + (Array.isArray(c.items) ? c.items.length : 0), 0);

  if (loading) {
    return (
      <div style={{ padding: '60px 32px' }}>
        <p className="text-sm text-muted-foreground">Loading menu…</p>
      </div>
    );
  }

  return (
    <>
      <PageTopbar
        crumbs={
          <>
            Restaurant /{' '}
            <a href="/client/restaurant" className="hover:underline">
              Overview
            </a>{' '}
            / <b className="text-foreground">Menu</b>
          </>
        }
        actions={
          <>
            <RestaurantMenuBulkImport data={bulkImportData} onChange={bulkImportOnChange} />
            <Pill variant="ink" onClick={handleSave} disabled={!dirty || saving}>
              {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
            </Pill>
          </>
        }
      />
      <div style={{ padding: '28px 32px 80px' }}>
        <PageHead
          title={
            <>
              {businessName} <span className="zt-serif">menu.</span>
            </>
          }
          sub={
            selectedOutletId === null
              ? `${totalItems} item${totalItems === 1 ? '' : 's'} across ${menu.length} section${menu.length === 1 ? '' : 's'}. ${multiOutletEnabled ? 'This is the chain default — every branch starts from this menu. Pick a branch below to customize.' : 'Bulk import a photo / Excel of your existing menu, or add items manually.'}`
              : isInheriting
                ? `${outlets.find((o) => o.id === selectedOutletId)?.name || 'This branch'} inherits the chain default (${totalItems} item${totalItems === 1 ? '' : 's'}). Click "Customize for this branch" to make changes here only.`
                : `Custom menu for ${outlets.find((o) => o.id === selectedOutletId)?.name || 'this branch'} — ${totalItems} item${totalItems === 1 ? '' : 's'}.`
          }
        />

        {multiOutletEnabled && outlets.length > 0 && (
          <Panel title="Which menu are you editing?">
            <div className="flex flex-wrap gap-2 items-center">
              <button
                type="button"
                onClick={() => setSelectedOutletId(null)}
                className={`text-[12px] px-3 py-1.5 rounded-full border transition-colors ${
                  selectedOutletId === null
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-background border-border hover:border-foreground'
                }`}
              >
                Chain default
              </button>
              {outlets.map((o) => {
                const hasOverride = Object.prototype.hasOwnProperty.call(overrides, o.id);
                const active = selectedOutletId === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSelectedOutletId(o.id)}
                    className={`text-[12px] px-3 py-1.5 rounded-full border transition-colors ${
                      active
                        ? 'bg-foreground text-background border-foreground'
                        : 'bg-background border-border hover:border-foreground'
                    }`}
                    title={hasOverride ? 'Custom menu' : 'Inherits chain default'}
                  >
                    {o.name}
                    {hasOverride ? ' ✏️' : ''}
                  </button>
                );
              })}
            </div>
            {selectedOutletId !== null && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {isInheriting ? (
                  <Button type="button" variant="outline" size="sm" onClick={customizeForThisBranch}>
                    ✏️ Customize menu for this branch
                  </Button>
                ) : (
                  <Button type="button" variant="outline" size="sm" onClick={revertToChainDefault}>
                    ↺ Revert to chain default
                  </Button>
                )}
                <span className="text-[11px] text-muted-foreground">
                  {isInheriting
                    ? 'Any change you make here will only affect this branch.'
                    : 'This branch has its own menu. The chain default stays untouched.'}
                </span>
              </div>
            )}
          </Panel>
        )}

        <div className="space-y-4">
          {menu.length === 0 && (
            <Panel
              title="No menu yet"
              sub="Use Bulk import to load your existing menu from a photo, paste, or Excel — or click Add section to start manually."
            >
              <Button type="button" onClick={addCategory}>
                + Add section
              </Button>
            </Panel>
          )}

          {menu.map((cat, catIdx) => (
            <Panel
              key={catIdx}
              title={
                <Input
                  className="h-9 text-base font-semibold"
                  placeholder="Section name (e.g., Starters)"
                  value={cat.category || ''}
                  onChange={(e) => updateCategoryName(catIdx, e.target.value)}
                />
              }
              action={
                <button
                  type="button"
                  onClick={() => removeCategory(catIdx)}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Remove section
                </button>
              }
            >
              <div className="space-y-3">
                {(cat.items || []).map((item, itemIdx) => (
                  <div key={itemIdx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start border-b border-border pb-3 last:border-b-0">
                    <div className="md:col-span-4">
                      <Label className="text-xs">Dish name</Label>
                      <Input
                        placeholder="Paneer Tikka"
                        value={item.name || ''}
                        onChange={(e) => updateItem(catIdx, itemIdx, { name: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-3">
                      <Label className="text-xs">Price</Label>
                      <Input
                        placeholder="Rs.249 or Half Rs.200 / Full Rs.380"
                        value={item.price || ''}
                        onChange={(e) => updateItem(catIdx, itemIdx, { price: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-3">
                      <Label className="text-xs">Description</Label>
                      <Input
                        placeholder="Marinated cottage cheese in tandoor"
                        value={item.description || ''}
                        onChange={(e) => updateItem(catIdx, itemIdx, { description: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-2 flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={item.isVeg ?? true}
                          onCheckedChange={(v) => updateItem(catIdx, itemIdx, { isVeg: v })}
                        />
                        <span className="text-xs">Veg</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={item.isBestseller ?? false}
                          onCheckedChange={(v) => updateItem(catIdx, itemIdx, { isBestseller: v })}
                        />
                        <span className="text-xs">Bestseller</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(catIdx, itemIdx)}
                        className="text-[11px] text-muted-foreground hover:text-destructive self-start"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="md:col-span-12">
                      <Label className="text-xs">
                        Contains allergens
                        <span className="text-[10px] text-muted-foreground ml-1.5">(FSSAI Reg 2.4.6 — tap any that apply)</span>
                      </Label>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {ALLERGEN_OPTIONS.map((a) => {
                          const selected = (item.allergens || []).includes(a.key);
                          return (
                            <button
                              key={a.key}
                              type="button"
                              onClick={() => {
                                const current = item.allergens || [];
                                const next = selected
                                  ? current.filter((k) => k !== a.key)
                                  : [...current, a.key];
                                updateItem(catIdx, itemIdx, { allergens: next });
                              }}
                              className={`text-[11px] px-2 py-1 rounded-full border transition ${
                                selected
                                  ? 'bg-foreground text-background border-foreground'
                                  : 'bg-background text-foreground border-border hover:border-foreground'
                              }`}
                            >
                              {selected ? '✓ ' : ''}{a.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => addItem(catIdx)}>
                  + Add item
                </Button>
              </div>
            </Panel>
          ))}

          {menu.length > 0 && (
            <Button type="button" variant="outline" onClick={addCategory}>
              + Add another section
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
