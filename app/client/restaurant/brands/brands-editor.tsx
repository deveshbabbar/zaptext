'use client';

// Brands editor for multi-brand cloud kitchens.
//
// Loads `brands[]` out of the active bot's knowledge_base JSON via
// /api/client/settings, lets the owner add/edit/remove brand-fronts
// AND each brand's own menu (categories + items), then saves back.
//
// Shape matches the onboarding form (components/forms/type-fields.tsx
// → RestaurantForm cloud-kitchen-multi-brand section) so the bot's
// prompt-generator can read either source identically.

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageTopbar, PageHead, Pill, Panel } from '@/components/app/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

type BrandMenuItem = {
  name?: string;
  price?: string;
  description?: string;
  isVeg?: boolean;
  isBestseller?: boolean;
  foodType?: 'veg' | 'non-veg' | 'egg';
};

type BrandMenuCategory = { category?: string; items?: BrandMenuItem[] };

type Brand = {
  name?: string;
  cuisineType?: string;
  website?: string;
  menuCategories?: BrandMenuCategory[];
  bestsellerItems?: string;
};

interface SettingsResponse {
  knowledgeBase: string;
}

function emptyItem(): BrandMenuItem {
  return { name: '', price: '', description: '', isVeg: true, isBestseller: false, foodType: 'veg' };
}

function emptyCategory(): BrandMenuCategory {
  return { category: '', items: [emptyItem()] };
}

function emptyBrand(): Brand {
  return { name: '', cuisineType: '', website: '', menuCategories: [emptyCategory()] };
}

export function BrandsEditor({ businessName }: { businessName: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [kb, setKb] = useState<Record<string, unknown>>({});
  const [brands, setBrands] = useState<Brand[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/client/settings');
        if (!res.ok) throw new Error(`load failed (${res.status})`);
        const data = (await res.json()) as SettingsResponse;
        const parsed = data.knowledgeBase ? JSON.parse(data.knowledgeBase) : {};
        setKb(parsed);
        const list = Array.isArray(parsed.brands) ? parsed.brands : [];
        // Migrate legacy brand rows that only have bestsellerItems —
        // surface that string as a placeholder "Bestsellers" category
        // so the owner can see it and expand it into real items.
        const migrated = list.map((b: Brand) => {
          if (!b.menuCategories || b.menuCategories.length === 0) {
            if (b.bestsellerItems && b.bestsellerItems.trim()) {
              const items = b.bestsellerItems
                .split(',')
                .map((nm) => ({
                  name: nm.trim(),
                  price: '',
                  description: '',
                  isVeg: true,
                  isBestseller: true,
                  foodType: 'veg' as const,
                }))
                .filter((it) => it.name);
              return { ...b, menuCategories: [{ category: 'Bestsellers', items }] };
            }
            return { ...b, menuCategories: [emptyCategory()] };
          }
          return b;
        });
        setBrands(migrated);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not load brands');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const markDirty = () => setDirty(true);

  const updateBrand = (idx: number, patch: Partial<Brand>) => {
    const next = [...brands];
    next[idx] = { ...next[idx], ...patch };
    setBrands(next);
    markDirty();
  };

  const addBrand = () => {
    setBrands([...brands, emptyBrand()]);
    markDirty();
  };

  const removeBrand = (idx: number) => {
    if (!confirm(`Remove brand "${brands[idx]?.name || 'this brand'}" and its entire menu?`)) return;
    setBrands(brands.filter((_, i) => i !== idx));
    markDirty();
  };

  const setBrandCats = (idx: number, cats: BrandMenuCategory[]) => {
    updateBrand(idx, { menuCategories: cats });
  };

  async function handleSave() {
    const cleaned = brands.filter((b) => (b.name || '').trim());
    setSaving(true);
    try {
      const nextKb = { ...kb, brands: cleaned };
      const res = await fetch('/api/client/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulk: { knowledge_base_json: JSON.stringify(nextKb) } }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.message || data.error || `save failed (${res.status})`);
      setKb(nextKb);
      setBrands(cleaned);
      setDirty(false);
      toast.success('Brands saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const totalItems = brands.reduce(
    (n, b) => n + (b.menuCategories || []).reduce((m, c) => m + (c.items?.length || 0), 0),
    0
  );

  if (loading) {
    return (
      <div style={{ padding: '60px 32px' }}>
        <p className="text-sm text-muted-foreground">Loading brands…</p>
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
            / <b className="text-foreground">Brands</b>
          </>
        }
        actions={
          <>
            <Pill onClick={addBrand}>+ Add brand</Pill>
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
              {businessName} <span className="zt-serif">brand-fronts.</span>
            </>
          }
          sub={
            brands.length === 0
              ? 'Multi-brand cloud kitchens (one kitchen, many brand identities on aggregators) manage each brand here. If you run a single-brand restaurant, just use the regular Menu page instead.'
              : `${brands.length} brand${brands.length === 1 ? '' : 's'} · ${totalItems} item${totalItems === 1 ? '' : 's'} across all brands.`
          }
        />

        {brands.length === 0 && (
          <Panel
            title="No brands yet"
            sub="Add a brand-front to get started. Each brand keeps its OWN menu — the bot serves the right brand's dishes when the customer asks for that brand."
          >
            <Button type="button" onClick={addBrand}>+ Add your first brand</Button>
          </Panel>
        )}

        <div className="space-y-5">
          {brands.map((brand, bIdx) => (
            <Panel
              key={bIdx}
              title={
                <Input
                  className="h-9 text-base font-semibold"
                  placeholder="Brand name (e.g., Biryani by Kilo)"
                  value={brand.name || ''}
                  onChange={(e) => updateBrand(bIdx, { name: e.target.value })}
                />
              }
              action={
                <button
                  type="button"
                  onClick={() => removeBrand(bIdx)}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Remove brand
                </button>
              }
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Cuisine</Label>
                    <Input
                      placeholder="Hyderabadi biryani"
                      value={brand.cuisineType || ''}
                      onChange={(e) => updateBrand(bIdx, { cuisineType: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Brand website (optional)</Label>
                    <Input
                      placeholder="https://brand.com"
                      value={brand.website || ''}
                      onChange={(e) => updateBrand(bIdx, { website: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[12px] font-semibold">
                      Menu for <span className="text-primary">{brand.name || 'this brand'}</span>
                    </Label>
                    <span className="text-[10.5px] text-muted-foreground">
                      {(brand.menuCategories || []).length} categor
                      {((brand.menuCategories || []).length === 1) ? 'y' : 'ies'} /{' '}
                      {(brand.menuCategories || []).reduce((n, c) => n + (c.items?.length || 0), 0)} items
                    </span>
                  </div>

                  {(brand.menuCategories || []).map((cat, cIdx) => (
                    <div key={cIdx} className="border border-border rounded-md p-3 space-y-2 bg-background">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <Label className="text-[11px]">Category name</Label>
                          <Input
                            placeholder="Biryani / Starters / Desserts"
                            value={cat.category || ''}
                            onChange={(e) => {
                              const next = [...(brand.menuCategories || [])];
                              next[cIdx] = { ...next[cIdx], category: e.target.value };
                              setBrandCats(bIdx, next);
                            }}
                          />
                        </div>
                        {(brand.menuCategories || []).length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = (brand.menuCategories || []).filter((_, i) => i !== cIdx);
                              setBrandCats(bIdx, next);
                            }}
                            className="text-muted-foreground hover:text-destructive text-sm self-end pb-1.5"
                            title="Remove category"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <div className="space-y-2">
                        {(cat.items || []).map((item, iIdx) => (
                          <div key={iIdx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start border-b border-border pb-2 last:border-b-0">
                            <div className="md:col-span-4">
                              <Label className="text-[11px]">Item</Label>
                              <Input
                                placeholder="Mutton biryani"
                                value={item.name || ''}
                                onChange={(e) => {
                                  const next = [...(brand.menuCategories || [])];
                                  const items = [...(next[cIdx].items || [])];
                                  items[iIdx] = { ...items[iIdx], name: e.target.value };
                                  next[cIdx] = { ...next[cIdx], items };
                                  setBrandCats(bIdx, next);
                                }}
                              />
                            </div>
                            <div className="md:col-span-2">
                              <Label className="text-[11px]">Price</Label>
                              <Input
                                placeholder="₹349"
                                value={item.price || ''}
                                onChange={(e) => {
                                  const next = [...(brand.menuCategories || [])];
                                  const items = [...(next[cIdx].items || [])];
                                  items[iIdx] = { ...items[iIdx], price: e.target.value };
                                  next[cIdx] = { ...next[cIdx], items };
                                  setBrandCats(bIdx, next);
                                }}
                              />
                            </div>
                            <div className="md:col-span-4">
                              <Label className="text-[11px]">Description</Label>
                              <Input
                                placeholder="Slow-dum-cooked Hyderabadi style"
                                value={item.description || ''}
                                onChange={(e) => {
                                  const next = [...(brand.menuCategories || [])];
                                  const items = [...(next[cIdx].items || [])];
                                  items[iIdx] = { ...items[iIdx], description: e.target.value };
                                  next[cIdx] = { ...next[cIdx], items };
                                  setBrandCats(bIdx, next);
                                }}
                              />
                            </div>
                            <div className="md:col-span-2 flex flex-col gap-1.5">
                              <div className="flex gap-1.5">
                                {[
                                  { key: 'veg', label: '🟢' },
                                  { key: 'non-veg', label: '🔴' },
                                  { key: 'egg', label: '🟡' },
                                ].map((opt) => {
                                  const resolved = item.foodType || (item.isVeg ? 'veg' : 'non-veg');
                                  const active = resolved === opt.key;
                                  return (
                                    <button
                                      key={opt.key}
                                      type="button"
                                      onClick={() => {
                                        const next = [...(brand.menuCategories || [])];
                                        const items = [...(next[cIdx].items || [])];
                                        items[iIdx] = {
                                          ...items[iIdx],
                                          foodType: opt.key as 'veg' | 'non-veg' | 'egg',
                                          isVeg: opt.key === 'veg',
                                        };
                                        next[cIdx] = { ...next[cIdx], items };
                                        setBrandCats(bIdx, next);
                                      }}
                                      className={`text-[12px] px-2 py-1 rounded border ${
                                        active ? 'bg-foreground text-background border-foreground' : 'bg-background border-border'
                                      }`}
                                    >
                                      {opt.label}
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={item.isBestseller ?? false}
                                  onCheckedChange={(v) => {
                                    const next = [...(brand.menuCategories || [])];
                                    const items = [...(next[cIdx].items || [])];
                                    items[iIdx] = { ...items[iIdx], isBestseller: v };
                                    next[cIdx] = { ...next[cIdx], items };
                                    setBrandCats(bIdx, next);
                                  }}
                                />
                                <span className="text-[11px]">Bestseller</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...(brand.menuCategories || [])];
                                  const items = (next[cIdx].items || []).filter((_, i) => i !== iIdx);
                                  next[cIdx] = { ...next[cIdx], items };
                                  setBrandCats(bIdx, next);
                                }}
                                className="text-[10.5px] text-muted-foreground hover:text-destructive self-start"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const next = [...(brand.menuCategories || [])];
                            const items = [...(next[cIdx].items || []), emptyItem()];
                            next[cIdx] = { ...next[cIdx], items };
                            setBrandCats(bIdx, next);
                          }}
                        >
                          + Add item
                        </Button>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => setBrandCats(bIdx, [...(brand.menuCategories || []), emptyCategory()])}
                    className="w-full border border-dashed border-border rounded-md py-1.5 text-[11.5px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    + Add menu category for this brand
                  </button>
                </div>
              </div>
            </Panel>
          ))}

          {brands.length > 0 && (
            <div className="flex justify-end">
              <Pill onClick={addBrand}>+ Add another brand</Pill>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
