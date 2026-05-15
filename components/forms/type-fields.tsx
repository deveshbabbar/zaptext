'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { DynamicList } from './dynamic-list';
import { BusinessType, FAQ } from '@/lib/types';
import { FAQ_TEMPLATES } from '@/lib/constants';
import {
  RestaurantMenuBulkImport,
  CoachingCoursesBulkImport,
  RealEstateListingsBulkImport,
  SalonServicesBulkImport,
  GymPlansBulkImport,
  TiffinPlansBulkImport,
  EcommerceProductsBulkImport,
  GroceryProductsBulkImport,
} from './bulk-import-buttons';

interface TypeFieldsProps {
  type: BusinessType;
  data: Record<string, unknown>;
  onChange: (field: string, value: unknown) => void;
}

export function TypeFieldsForm({ type, data, onChange }: TypeFieldsProps) {
  switch (type) {
    case 'restaurant': return <RestaurantForm data={data} onChange={onChange} />;
    case 'coaching': return <CoachingForm data={data} onChange={onChange} />;
    case 'realestate': return <RealEstateForm data={data} onChange={onChange} />;
    case 'salon': return <SalonForm data={data} onChange={onChange} />;
    case 'd2c': return <D2CForm data={data} onChange={onChange} />;
    case 'gym': return <GymForm data={data} onChange={onChange} />;
    case 'tiffin': return <TiffinForm data={data} onChange={onChange} />;
    case 'ecommerce': return <EcommerceForm data={data} onChange={onChange} />;
    case 'grocery': return <GroceryForm data={data} onChange={onChange} />;
    default:
      return (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <b>Form not yet available for &quot;{type}&quot;.</b>
          <div className="mt-1 text-amber-800">Contact support &mdash; your bot type is recognised but the onboarding form is still being built.</div>
        </div>
      );
  }
}

// ─── Restaurant Form ───
function RestaurantForm({ data, onChange }: { data: Record<string, unknown>; onChange: (f: string, v: unknown) => void }) {
  const menuCategories = (data.menuCategories as Array<Record<string, unknown>>) || [{ category: '', items: [{ name: '', price: '', description: '', isVeg: true, isBestseller: false }] }];
  const paymentMethods = (data.paymentMethods as string[]) || ['Cash on Delivery'];
  // Multi-select sub-types — many restaurants overlap categories (cafe + bakery,
  // sweet-shop + tiffin, pure-veg + jain). Read from array, fall back to legacy
  // single `subType` field for old data rows. Write to BOTH so old code paths
  // that read `subType` still work.
  const subTypes = (data.subTypes as string[]) || ((data.subType as string) ? [data.subType as string] : []);
  const subType = subTypes[0] || '';
  const setSubTypes = (next: string[]) => {
    onChange('subTypes', next);
    onChange('subType', next[0] || '');
  };
  const serviceModes = (data.serviceModes as string[]) || ['dine_in', 'delivery'];
  const deliveryPartners = (data.deliveryPartners as string[]) || [];
  const brands = (data.brands as Array<Record<string, unknown>>) || [];

  const SUB_TYPES: Array<{ value: string; label: string; emoji: string }> = [
    { value: 'dine-in-family', label: 'Family restaurant', emoji: '🍽️' },
    { value: 'fine-dine', label: 'Fine-dine', emoji: '🍷' },
    { value: 'qsr', label: 'QSR / fast-food', emoji: '🍔' },
    { value: 'cloud-kitchen-single', label: 'Cloud kitchen (single brand)', emoji: '☁️' },
    { value: 'cloud-kitchen-multi-brand', label: 'Cloud kitchen (multi-brand)', emoji: '🏷️' },
    { value: 'dhaba', label: 'Dhaba', emoji: '🛻' },
    { value: 'food-truck', label: 'Food truck', emoji: '🚚' },
    { value: 'sweet-shop', label: 'Sweet shop / mithai', emoji: '🍬' },
    { value: 'bakery', label: 'Bakery', emoji: '🥐' },
    { value: 'eggless-bakery', label: 'Eggless bakery', emoji: '🥖' },
    { value: 'custom-cake-studio', label: 'Custom cake studio', emoji: '🎂' },
    { value: 'ice-cream-parlour', label: 'Ice-cream parlour', emoji: '🍦' },
    { value: 'juice-bar', label: 'Juice bar', emoji: '🥤' },
    { value: 'chai-tapri', label: 'Chai tapri', emoji: '☕' },
    { value: 'cafe', label: 'Cafe', emoji: '🥪' },
    { value: 'pure-veg', label: 'Pure-veg restaurant', emoji: '🟢' },
    { value: 'jain-only', label: 'Jain-only', emoji: '🟡' },
    { value: 'regional-specialty', label: 'Regional specialty', emoji: '🌶️' },
    { value: 'tiffin-attached', label: 'Restaurant + tiffin', emoji: '🍱' },
  ];

  const isCloudKitchenMultiBrand = subTypes.includes('cloud-kitchen-multi-brand');
  const isCustomCake = subTypes.includes('custom-cake-studio') || subTypes.includes('bakery') || subTypes.includes('eggless-bakery');
  const isIceCream = subTypes.includes('ice-cream-parlour');
  const isJuiceBar = subTypes.includes('juice-bar');
  const isMithai = subTypes.includes('sweet-shop');

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold border-b border-border pb-2">Restaurant Details</h3>

      {/* Sub-type chooser — MULTI-SELECT (cafe + bakery, sweet-shop + tiffin, etc.) */}
      <div>
        <Label>What kind of restaurant? * <span className="text-[10px] text-muted-foreground font-normal">(pick all that apply)</span></Label>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
          {SUB_TYPES.map((st) => {
            const active = subTypes.includes(st.value);
            return (
              <button
                key={st.value}
                type="button"
                onClick={() => {
                  const next = active ? subTypes.filter((s) => s !== st.value) : [...subTypes, st.value];
                  setSubTypes(next);
                }}
                className={`text-left rounded-md border px-3 py-2 text-xs transition-colors ${
                  active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border hover:border-primary/50'
                }`}
              >
                <span className="mr-1">{st.emoji}</span>
                {st.label}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Picks affect bot tone, allergen rules, and which extra fields appear below.
          {subTypes.length > 1 && <span className="ml-1 text-[var(--ink)]">{subTypes.length} selected.</span>}
        </p>
      </div>

      {/* Service modes */}
      <div>
        <Label>How do you serve customers?</Label>
        <div className="flex gap-2 mt-1 flex-wrap">
          {(() => {
            const cloudOnly = serviceModes.includes('cloud_kitchen_only');
            return [
              { v: 'dine_in', l: 'Dine-in' },
              { v: 'takeaway', l: 'Takeaway' },
              { v: 'delivery', l: 'Delivery' },
              { v: 'cloud_kitchen_only', l: 'Cloud kitchen only' },
            ].map((o) => {
              const active = serviceModes.includes(o.v);
              // Dine-in is mutually exclusive with "Cloud kitchen only".
              // If cloud-only is on, dine-in is disabled (and visibly muted).
              const disabled = cloudOnly && o.v === 'dine_in';
              return (
                <button
                  key={o.v}
                  type="button"
                  disabled={disabled}
                  title={disabled ? 'Cloud-kitchen-only kitchens don’t serve dine-in customers.' : undefined}
                  onClick={() => {
                    if (disabled) return;
                    let next: string[];
                    if (active) {
                      next = serviceModes.filter((m) => m !== o.v);
                    } else {
                      next = [...serviceModes, o.v];
                    }
                    // Toggling "Cloud kitchen only" auto-removes dine_in
                    // — they're mutually exclusive.
                    if (o.v === 'cloud_kitchen_only' && !active) {
                      next = next.filter((m) => m !== 'dine_in');
                    }
                    onChange('serviceModes', next);
                  }}
                  className={`px-3 py-1.5 rounded text-xs border transition-colors ${
                    disabled
                      ? 'bg-secondary/40 border-border text-muted-foreground line-through cursor-not-allowed'
                      : active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-secondary border-border'
                  }`}
                >
                  {o.l}
                </button>
              );
            });
          })()}
        </div>
        {serviceModes.includes('cloud_kitchen_only') && (
          <p className="text-[10.5px] text-muted-foreground mt-1.5 m-0">
            Cloud-kitchen-only mode — dine-in is unavailable. Customers can order
            delivery / takeaway only.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-2">
          <Switch checked={(data.pureVeg as boolean) ?? false} onCheckedChange={(v) => onChange('pureVeg', v)} />
          <Label className="text-xs">Pure-veg kitchen</Label>
        </div>
        {(data.pureVeg as boolean) === false && (
          <div className="flex items-center gap-2">
            <Switch checked={(data.sharedKitchenWithNonVeg as boolean) ?? true} onCheckedChange={(v) => onChange('sharedKitchenWithNonVeg', v)} />
            <Label className="text-xs">Veg cooked in shared kitchen</Label>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Switch checked={(data.bulkOrdersEnabled as boolean) ?? false} onCheckedChange={(v) => onChange('bulkOrdersEnabled', v)} />
          <Label className="text-xs">Bulk / corporate orders</Label>
        </div>
      </div>

      {/*
        Outlet structure toggle (Phase 3C). Single-location kitchens
        get the simple onboarding — multi-outlet UI stays hidden.
        Chains opt in here and finish per-outlet setup in
        Settings → Outlets after signup. We store both:
          - multiOutletEnabled (boolean) — UI gate everywhere
          - outletCount (number)         — for analytics / billing tiers
      */}
      <div>
        <Label>How many outlets / branches do you operate?</Label>
        <div className="flex gap-2 mt-1 flex-wrap">
          {[
            { v: 'single', l: 'Just one location' },
            { v: 'multi', l: 'Multiple outlets / branches' },
          ].map((o) => {
            const active =
              o.v === 'multi' ? (data.multiOutletEnabled as boolean) === true
              : (data.multiOutletEnabled as boolean) !== true;
            return (
              <button
                key={o.v}
                type="button"
                onClick={() => {
                  const isMulti = o.v === 'multi';
                  onChange('multiOutletEnabled', isMulti);
                  if (isMulti) {
                    const current = Number(data.outletCount) || 2;
                    onChange('outletCount', current < 2 ? 2 : current);
                  } else {
                    onChange('outletCount', 1);
                  }
                }}
                className={`px-3 py-1.5 rounded text-xs border transition-colors ${
                  active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'
                }`}
              >
                {o.l}
              </button>
            );
          })}
        </div>
        {(data.multiOutletEnabled as boolean) === true && (
          <div className="mt-3 p-3 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
            <div>
              <Label className="text-xs">Roughly how many outlets right now?</Label>
              <Input
                type="number"
                min={2}
                max={50}
                value={(data.outletCount as number) || 2}
                onChange={(e) => {
                  const n = Math.max(2, Math.min(50, parseInt(e.target.value, 10) || 2));
                  onChange('outletCount', n);
                }}
                className="mt-1 w-24"
              />
            </div>
            <p className="text-[11px] leading-relaxed">
              After signup, you&apos;ll see <b>Settings → Outlets</b> in your
              dashboard. Add each outlet (name, address, FSSAI, manager
              email, delivery radius). One WhatsApp number serves all
              outlets — the bot auto-routes orders by QR scan, customer
              location, or a quick branch picker.
            </p>
          </div>
        )}
      </div>

      <div>
        <Label>Cuisine Type *</Label>
        <Input placeholder="North Indian, Chinese, Mughlai" value={(data.cuisineType as string) || ''} onChange={(e) => onChange('cuisineType', e.target.value)} />
      </div>

      {/* Compliance */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Compliance</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>FSSAI License Number</Label>
          <Input
            placeholder="14-digit FSSAI number"
            value={(data.fssaiLicenseNumber as string) || ''}
            onChange={(e) => onChange('fssaiLicenseNumber', e.target.value.replace(/\D/g, '').slice(0, 14))}
            inputMode="numeric"
          />
          <p className="text-[10px] text-muted-foreground mt-1">Mandatory for any food business in India.</p>
        </div>
        <div>
          <Label>FSSAI Expiry Date</Label>
          <Input
            type="date"
            value={(data.fssaiExpiryDate as string) || ''}
            onChange={(e) => onChange('fssaiExpiryDate', e.target.value)}
          />
        </div>
        <div>
          <Label>GSTIN (optional)</Label>
          <Input placeholder="29XXXXX1234X1Z5" value={(data.gstin as string) || ''} onChange={(e) => onChange('gstin', e.target.value.toUpperCase())} />
        </div>
        <div>
          <Label>PAN (optional)</Label>
          <Input placeholder="ABCDE1234F" value={(data.panNumber as string) || ''} onChange={(e) => onChange('panNumber', e.target.value.toUpperCase())} />
          <p className="text-[10px] text-muted-foreground mt-1">Stored for invoicing only.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <Switch checked={(data.jainCertified as boolean) ?? false} onCheckedChange={(v) => onChange('jainCertified', v)} />
          <Label className="text-xs">Jain-certified menu</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.servesAlcohol as boolean) ?? false} onCheckedChange={(v) => onChange('servesAlcohol', v)} />
          <Label className="text-xs">Serves alcohol (legal context only)</Label>
        </div>
      </div>
      {(data.servesAlcohol as boolean) && (
        <div>
          <Label>Alcohol licence number</Label>
          <Input value={(data.alcoholLicenseNumber as string) || ''} onChange={(e) => onChange('alcoholLicenseNumber', e.target.value)} />
          <p className="text-[10px] text-amber-700 mt-1">⚠️ Bot will NEVER promote alcohol on WhatsApp (Meta Commerce Policy). This is for your records only.</p>
        </div>
      )}

      {/* Cloud-kitchen multi-brand — each brand front gets its OWN menu.
          Brands store: { name, cuisineType, website, menuCategories: [{ category, items: [...] }] }.
          The prompt-generator + client dashboard read this same shape. */}
      {isCloudKitchenMultiBrand && (
        <>
          <h3 className="text-lg font-semibold border-b border-border pb-2">Cloud-Kitchen Brands</h3>
          <p className="text-xs text-muted-foreground">
            List each brand-front you operate from this kitchen (Rebel / Charcoal Eats pattern).
            Each brand keeps its <b>own menu</b> — categories, items, prices — exactly like a separate restaurant.
            The bot serves the right brand&apos;s menu based on which brand the customer asked for.
          </p>
          <DynamicList
            items={brands}
            onChange={(items) => onChange('brands', items)}
            newItem={() => ({
              name: '',
              cuisineType: '',
              website: '',
              menuCategories: [{ category: '', items: [{ name: '', price: '', description: '', isVeg: true, isBestseller: false }] }],
            })}
            addLabel="+ Add another brand"
            renderItem={(item, _, update) => {
              const brandCats = (item.menuCategories as Array<Record<string, unknown>>) || [];
              const setBrandCats = (next: Array<Record<string, unknown>>) => update('menuCategories', next);
              return (
                <div className="space-y-3 rounded-md border border-border bg-card p-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label>Brand name *</Label>
                      <Input
                        placeholder="Biryani by Kilo"
                        value={(item.name as string) || ''}
                        onChange={(e) => update('name', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Cuisine</Label>
                      <Input
                        placeholder="Hyderabadi biryani"
                        value={(item.cuisineType as string) || ''}
                        onChange={(e) => update('cuisineType', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Brand website (optional)</Label>
                      <Input
                        placeholder="https://brand.com"
                        value={(item.website as string) || ''}
                        onChange={(e) => update('website', e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label className="text-[12px] font-semibold">
                        Menu for <span className="text-primary">{(item.name as string) || 'this brand'}</span>
                      </Label>
                      <span className="text-[10.5px] text-muted-foreground">
                        {brandCats.length} category / {brandCats.reduce((acc, c) => acc + (((c.items as Array<unknown>) || []).length), 0)} items
                      </span>
                    </div>

                    {brandCats.map((cat, catIdx) => (
                      <div key={catIdx} className="border border-border rounded-md p-3 space-y-2 mb-2 bg-background">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1">
                            <Label className="text-[11px]">Category name</Label>
                            <Input
                              placeholder="Biryani / Starters / Desserts"
                              value={(cat.category as string) || ''}
                              onChange={(e) => {
                                const next = [...brandCats];
                                next[catIdx] = { ...next[catIdx], category: e.target.value };
                                setBrandCats(next);
                              }}
                            />
                          </div>
                          {brandCats.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setBrandCats(brandCats.filter((_, i) => i !== catIdx))}
                              className="text-muted-foreground hover:text-destructive text-sm self-end pb-1.5"
                              title="Remove category"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        <DynamicList
                          items={(cat.items as Array<Record<string, unknown>>) || []}
                          onChange={(items) => {
                            const next = [...brandCats];
                            next[catIdx] = { ...next[catIdx], items };
                            setBrandCats(next);
                          }}
                          newItem={() => ({ name: '', price: '', description: '', isVeg: true, isBestseller: false })}
                          addLabel="+ Add item"
                          renderItem={(it, _ix, upd) => (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-[11px]">Item</Label>
                                  <Input
                                    placeholder="Mutton biryani"
                                    value={(it.name as string) || ''}
                                    onChange={(e) => upd('name', e.target.value)}
                                  />
                                </div>
                                <div>
                                  <Label className="text-[11px]">Price</Label>
                                  <Input
                                    placeholder="₹349"
                                    value={(it.price as string) || ''}
                                    onChange={(e) => upd('price', e.target.value)}
                                  />
                                </div>
                              </div>
                              <div>
                                <Label className="text-[11px]">Description (optional)</Label>
                                <Input
                                  placeholder="Slow-dum-cooked Hyderabadi style"
                                  value={(it.description as string) || ''}
                                  onChange={(e) => upd('description', e.target.value)}
                                />
                              </div>
                              <div className="flex gap-4 items-end">
                                <div>
                                  <Label className="text-[11px]">Type</Label>
                                  <div className="flex gap-1.5 mt-1">
                                    {[
                                      { key: 'veg', label: '🟢 Veg' },
                                      { key: 'non-veg', label: '🔴 Non-Veg' },
                                      { key: 'egg', label: '🟡 Egg' },
                                    ].map((opt) => {
                                      const currentType = (it as Record<string, unknown>).foodType as string | undefined;
                                      const resolvedType = currentType || (it.isVeg ? 'veg' : 'non-veg');
                                      const active = resolvedType === opt.key;
                                      return (
                                        <button
                                          key={opt.key}
                                          type="button"
                                          onClick={() => {
                                            upd('foodType', opt.key);
                                            upd('isVeg', opt.key === 'veg');
                                          }}
                                          className={`px-2 py-1 rounded text-[11px] border transition-colors ${
                                            active
                                              ? 'bg-primary text-primary-foreground border-primary'
                                              : 'bg-secondary border-border hover:border-primary/50'
                                          }`}
                                        >
                                          {opt.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={(it.isBestseller as boolean) ?? false}
                                    onCheckedChange={(v) => upd('isBestseller', v)}
                                  />
                                  <Label className="text-[11px]">Bestseller</Label>
                                </div>
                              </div>
                            </div>
                          )}
                        />
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() =>
                        setBrandCats([
                          ...brandCats,
                          { category: '', items: [{ name: '', price: '', description: '', isVeg: true, isBestseller: false }] },
                        ])
                      }
                      className="w-full border border-dashed border-border rounded-md py-1.5 text-[11.5px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      + Add menu category for this brand
                    </button>
                  </div>
                </div>
              );
            }}
          />
        </>
      )}

      {/* Service windows */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Service Windows (optional)</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <div><Label className="text-xs">Breakfast</Label><Input placeholder="7-10:30 AM" value={(data.serviceBreakfastWindow as string) || ''} onChange={(e) => onChange('serviceBreakfastWindow', e.target.value)} /></div>
        <div><Label className="text-xs">Lunch</Label><Input placeholder="12-3 PM" value={(data.serviceLunchWindow as string) || ''} onChange={(e) => onChange('serviceLunchWindow', e.target.value)} /></div>
        <div><Label className="text-xs">Snacks</Label><Input placeholder="4-6 PM" value={(data.serviceSnacksWindow as string) || ''} onChange={(e) => onChange('serviceSnacksWindow', e.target.value)} /></div>
        <div><Label className="text-xs">Dinner</Label><Input placeholder="7-11 PM" value={(data.serviceDinnerWindow as string) || ''} onChange={(e) => onChange('serviceDinnerWindow', e.target.value)} /></div>
        <div><Label className="text-xs">Late-night</Label><Input placeholder="11 PM-2 AM" value={(data.serviceLateNightWindow as string) || ''} onChange={(e) => onChange('serviceLateNightWindow', e.target.value)} /></div>
      </div>

      {/* Table booking */}
      {serviceModes.includes('dine_in') && (
        <>
          <h3 className="text-lg font-semibold border-b border-border pb-2">Table Booking</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={(data.tableBookingEnabled as boolean) ?? false} onCheckedChange={(v) => onChange('tableBookingEnabled', v)} />
              <Label className="text-xs">Allow table reservations via the bot</Label>
            </div>
            {(data.tableBookingEnabled as boolean) && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Min party size</Label>
                    <Input
                      type="number"
                      placeholder="2"
                      value={(data.tableMinPartySize as number | undefined) ?? ''}
                      onChange={(e) => onChange('tableMinPartySize', e.target.value === '' ? undefined : Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Max party size</Label>
                    <Input
                      type="number"
                      placeholder="12"
                      value={(data.tableMaxPartySize as number | undefined) ?? ''}
                      onChange={(e) => onChange('tableMaxPartySize', e.target.value === '' ? undefined : Number(e.target.value))}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Advance booking days</Label>
                  <Input
                    type="number"
                    placeholder="14"
                    value={(data.tableAdvanceBookingDays as number | undefined) ?? ''}
                    onChange={(e) => onChange('tableAdvanceBookingDays', e.target.value === '' ? undefined : Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Deposit required</Label>
                  <Input placeholder="₹500 for groups of 6+" value={(data.tableDepositRequired as string) || ''} onChange={(e) => onChange('tableDepositRequired', e.target.value)} />
                </div>
              </>
            )}
          </div>

          {/* Dine-in QR auto setup — drives auto-creation of tables + QRs
              on first visit to /client/restaurant/qr-codes, and the daily
              auto-rotation cron. Each table gets its own QR encoding a
              wa.me link → customer scan opens WhatsApp directly. */}
          <h3 className="text-lg font-semibold border-b border-border pb-2">Dine-in QR codes (auto setup)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Number of tables (auto-generates QRs)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="10"
                value={(data.numberOfTables as number | undefined) ?? ''}
                onChange={(e) => onChange('numberOfTables', e.target.value === '' ? undefined : Number(e.target.value))}
              />
              <p className="text-[10.5px] text-muted-foreground mt-1 m-0">
                Bot will create tables 1, 2, 3... with unique QR each. You can add more later.
              </p>
            </div>
            <div className="flex items-center gap-2 mt-5">
              <Switch
                checked={(data.qrAutoRotateEnabled as boolean) ?? false}
                onCheckedChange={(v) => onChange('qrAutoRotateEnabled', v)}
              />
              <Label className="text-xs">Auto-rotate QR tokens daily</Label>
            </div>
            <div>
              <Label className="text-xs">Rotation interval (hours)</Label>
              <Input
                type="number"
                min={6}
                max={168}
                placeholder="24"
                value={(data.qrAutoRotateIntervalHours as number | undefined) ?? ''}
                onChange={(e) => onChange('qrAutoRotateIntervalHours', e.target.value === '' ? undefined : Number(e.target.value))}
                disabled={!(data.qrAutoRotateEnabled as boolean)}
              />
              <p className="text-[10.5px] text-muted-foreground mt-1 m-0">
                Old printed QRs stop working after rotation — you&apos;ll be notified to reprint.
              </p>
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center gap-3">
          <Switch checked={(data.deliveryAvailable as boolean) ?? true} onCheckedChange={(v) => onChange('deliveryAvailable', v)} />
          <Label>Delivery Available</Label>
        </div>
        <div>
          <Label>Delivery Radius</Label>
          <Input placeholder="5 km" value={(data.deliveryRadius as string) || ''} onChange={(e) => onChange('deliveryRadius', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Delivery Charges</Label>
          <Input placeholder="Rs.30 below Rs.300" value={(data.deliveryCharges as string) || ''} onChange={(e) => onChange('deliveryCharges', e.target.value)} />
        </div>
        <div>
          <Label>Minimum Order</Label>
          <Input placeholder="Rs.200" value={(data.minimumOrder as string) || ''} onChange={(e) => onChange('minimumOrder', e.target.value)} />
        </div>
        <div>
          <Label>Payment Methods <span className="text-[10px] uppercase tracking-wide text-amber-700 ml-1">COD only</span></Label>
          <Input value="Cash on Delivery" disabled readOnly />
          <p className="text-[10px] text-muted-foreground mt-1">Online payments roll out in a future release.</p>
        </div>
      </div>

      <div>
        <Label>Special Offers</Label>
        <Input placeholder="20% off on orders above Rs.500" value={(data.specialOffers as string) || ''} onChange={(e) => onChange('specialOffers', e.target.value)} />
      </div>

      <div className="flex items-center justify-between border-b border-border pb-2">
        <h3 className="text-lg font-semibold">Menu</h3>
        <RestaurantMenuBulkImport data={data} onChange={onChange} />
      </div>
      {menuCategories.map((cat, catIndex) => (
        <div key={catIndex} className="border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex-1 mr-4">
              <Label>Category Name</Label>
              <Input placeholder="Starters" value={(cat.category as string) || ''} onChange={(e) => {
                const updated = [...menuCategories];
                updated[catIndex] = { ...updated[catIndex], category: e.target.value };
                onChange('menuCategories', updated);
              }} />
            </div>
            {menuCategories.length > 1 && (
              <button type="button" onClick={() => onChange('menuCategories', menuCategories.filter((_, i) => i !== catIndex))} className="text-muted-foreground hover:text-destructive">x</button>
            )}
          </div>
          <DynamicList
            items={(cat.items as Array<Record<string, unknown>>) || []}
            onChange={(items) => {
              const updated = [...menuCategories];
              updated[catIndex] = { ...updated[catIndex], items };
              onChange('menuCategories', updated);
            }}
            newItem={() => ({ name: '', price: '', description: '', isVeg: true, isBestseller: false })}
            addLabel="Add Item"
            renderItem={(item, _, update) => (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Item Name</Label>
                    <Input placeholder="Paneer Tikka" value={(item.name as string) || ''} onChange={(e) => update('name', e.target.value)} />
                  </div>
                  <div>
                    <Label>Price</Label>
                    <Input placeholder="Rs.249" value={(item.price as string) || ''} onChange={(e) => update('price', e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Input placeholder="Marinated cottage cheese grilled in tandoor" value={(item.description as string) || ''} onChange={(e) => update('description', e.target.value)} />
                </div>
                <div>
                  <Label>Image URL (optional)</Label>
                  <Input placeholder="https://i.imgur.com/abc.jpg" value={(item.imageUrl as string) || ''} onChange={(e) => update('imageUrl', e.target.value)} />
                  <p className="text-[10px] text-muted-foreground mt-1">Upload to imgur.com or similar, paste public URL here</p>
                </div>
                <div className="flex gap-6 items-end flex-wrap">
                  <div>
                    <Label>Type</Label>
                    <div className="flex gap-2 mt-1">
                      {[
                        { key: 'veg', label: '🟢 Veg' },
                        { key: 'non-veg', label: '🔴 Non-Veg' },
                        { key: 'egg', label: '🟡 Egg' },
                      ].map((opt) => {
                        const currentType = (item as Record<string, unknown>).foodType as string | undefined;
                        const resolvedType = currentType || (item.isVeg ? 'veg' : 'non-veg');
                        const active = resolvedType === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => {
                              update('foodType', opt.key);
                              update('isVeg', opt.key === 'veg');
                            }}
                            className={`px-3 py-1.5 rounded text-xs border transition-colors ${
                              active
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-secondary border-border hover:border-primary/50'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={(item.isBestseller as boolean) ?? false} onCheckedChange={(v) => update('isBestseller', v)} />
                    <Label>Bestseller</Label>
                  </div>
                </div>
              </div>
            )}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange('menuCategories', [...menuCategories, { category: '', items: [{ name: '', price: '', description: '', isVeg: true, isBestseller: false }] }])}
        className="w-full border border-dashed border-border rounded-lg p-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        + Add Menu Category
      </button>

      {/* Delivery partners + packaging */}
      {serviceModes.includes('delivery') && (
        <>
          <h3 className="text-lg font-semibold border-b border-border pb-2">Delivery & Packaging</h3>
          <div>
            <Label>Delivery partners</Label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {[
                { v: 'own_rider', l: '🛵 Own rider' },
                { v: 'zomato', l: 'Zomato' },
                { v: 'swiggy', l: 'Swiggy' },
                { v: 'dunzo', l: 'Dunzo' },
                { v: 'shadowfax', l: 'Shadowfax' },
                { v: 'borzo', l: 'Borzo' },
                { v: 'porter', l: 'Porter' },
                { v: 'rapido', l: 'Rapido' },
                { v: 'wefast', l: 'WeFast' },
                { v: 'pidge', l: 'Pidge' },
              ].map((o) => {
                const active = deliveryPartners.includes(o.v);
                return (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => {
                      const next = active ? deliveryPartners.filter((p) => p !== o.v) : [...deliveryPartners, o.v];
                      onChange('deliveryPartners', next);
                    }}
                    className={`px-2 py-1 rounded text-xs border transition-colors ${
                      active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'
                    }`}
                  >
                    {o.l}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Packaging charges per order</Label>
              <Input placeholder="₹15" value={(data.packagingChargesPerOrder as string) || ''} onChange={(e) => onChange('packagingChargesPerOrder', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Packaging charges per item</Label>
              <Input placeholder="₹5 (curry) / ₹10 (biryani box)" value={(data.packagingChargesPerItem as string) || ''} onChange={(e) => onChange('packagingChargesPerItem', e.target.value)} />
            </div>
          </div>
        </>
      )}

      {/* Surge pricing */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Surge Pricing (optional)</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs">Rain surcharge %</Label>
          <Input
            type="number"
            placeholder="10"
            value={(data.rainSurchargePercent as number | undefined) ?? ''}
            onChange={(e) => onChange('rainSurchargePercent', e.target.value === '' ? undefined : Number(e.target.value))}
          />
        </div>
        <div>
          <Label className="text-xs">Peak hour surcharge %</Label>
          <Input
            type="number"
            placeholder="15"
            value={(data.peakHourSurchargePercent as number | undefined) ?? ''}
            onChange={(e) => onChange('peakHourSurchargePercent', e.target.value === '' ? undefined : Number(e.target.value))}
          />
        </div>
        <div>
          <Label className="text-xs">Festival surcharge %</Label>
          <Input
            type="number"
            placeholder="20"
            value={(data.festivalSurchargePercent as number | undefined) ?? ''}
            onChange={(e) => onChange('festivalSurchargePercent', e.target.value === '' ? undefined : Number(e.target.value))}
          />
        </div>
      </div>

      {/* Bulk / corporate orders */}
      {(data.bulkOrdersEnabled as boolean) && (
        <>
          <h3 className="text-lg font-semibold border-b border-border pb-2">Bulk / Corporate Orders</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Minimum people</Label>
              <Input
                type="number"
                placeholder="30"
                value={(data.bulkOrdersMinPax as number | undefined) ?? ''}
                onChange={(e) => onChange('bulkOrdersMinPax', e.target.value === '' ? undefined : Number(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs">Bulk-order contact</Label>
              <Input placeholder="+91 98765 43210" value={(data.bulkOrdersContactNumber as string) || ''} onChange={(e) => onChange('bulkOrdersContactNumber', e.target.value)} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={(data.bulkOrdersInvoiceWithGst as boolean) ?? true} onCheckedChange={(v) => onChange('bulkOrdersInvoiceWithGst', v)} />
              <Label className="text-xs">GST invoice on request</Label>
            </div>
          </div>
        </>
      )}

      {/* Sub-type-specific extras */}
      {isCustomCake && (
        <>
          <h3 className="text-lg font-semibold border-b border-border pb-2">Custom Cake / Bakery</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Lead time (hours)</Label>
              <Input
                type="number"
                placeholder="24"
                value={(data.customCakeLeadTimeHours as number | undefined) ?? ''}
                onChange={(e) => onChange('customCakeLeadTimeHours', e.target.value === '' ? undefined : Number(e.target.value))}
              />
              <p className="text-[10px] text-muted-foreground mt-1">Bot refuses same-day custom cake if &lt; lead time.</p>
            </div>
            <div>
              <Label className="text-xs">Advance deposit %</Label>
              <Input
                type="number"
                placeholder="50"
                value={(data.customCakeAdvanceDepositPercent as number | undefined) ?? ''}
                onChange={(e) => onChange('customCakeAdvanceDepositPercent', e.target.value === '' ? undefined : Number(e.target.value))}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={(data.customCakeEgglessAvailable as boolean) ?? true} onCheckedChange={(v) => onChange('customCakeEgglessAvailable', v)} />
              <Label className="text-xs">Eggless option available</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={(data.customCakePhotoOnCake as boolean) ?? false} onCheckedChange={(v) => onChange('customCakePhotoOnCake', v)} />
              <Label className="text-xs">Photo-on-cake supported</Label>
            </div>
          </div>
        </>
      )}

      {isIceCream && (
        <>
          <h3 className="text-lg font-semibold border-b border-border pb-2">Ice Cream Parlour</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={(data.iceCreamSellsTubs as boolean) ?? true} onCheckedChange={(v) => onChange('iceCreamSellsTubs', v)} />
              <Label className="text-xs">Sells tubs (take-home)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={(data.iceCreamSellsScoops as boolean) ?? true} onCheckedChange={(v) => onChange('iceCreamSellsScoops', v)} />
              <Label className="text-xs">Sells scoops (in-store)</Label>
            </div>
            <div>
              <Label className="text-xs">Today&apos;s flavour-of-the-day</Label>
              <Input placeholder="Mango Sorbet" value={(data.iceCreamFlavorOfTheDay as string) || ''} onChange={(e) => onChange('iceCreamFlavorOfTheDay', e.target.value)} />
            </div>
          </div>
        </>
      )}

      {isJuiceBar && (
        <>
          <h3 className="text-lg font-semibold border-b border-border pb-2">Juice Bar</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Today&apos;s fruit-of-the-day</Label>
              <Input placeholder="Pomegranate" value={(data.juiceFruitOfTheDay as string) || ''} onChange={(e) => onChange('juiceFruitOfTheDay', e.target.value)} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={(data.juiceColdPressedAvailable as boolean) ?? false} onCheckedChange={(v) => onChange('juiceColdPressedAvailable', v)} />
              <Label className="text-xs">Cold-pressed available</Label>
            </div>
          </div>
        </>
      )}

      {isMithai && (
        <>
          <h3 className="text-lg font-semibold border-b border-border pb-2">Mithai / Sweet Shop</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Festival gift boxes</Label>
              <Input placeholder="Diwali ₹999 / ₹1,499 / ₹2,499" value={(data.mithaiFestivalGiftBoxes as string) || ''} onChange={(e) => onChange('mithaiFestivalGiftBoxes', e.target.value)} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={(data.mithaiInterstateShipping as boolean) ?? false} onCheckedChange={(v) => onChange('mithaiInterstateShipping', v)} />
              <Label className="text-xs">Interstate shipping (cold-chain)</Label>
            </div>
          </div>
        </>
      )}

      {/* Truthful claims */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Quality Claims</h3>
      <p className="text-[10px] text-amber-700">Only enable claims that are TRUTHFULLY met. The bot will quote these to customers.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <Switch checked={(data.noPreservativesClaim as boolean) ?? false} onCheckedChange={(v) => onChange('noPreservativesClaim', v)} />
          <Label className="text-xs">No preservatives</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.noMsgClaim as boolean) ?? false} onCheckedChange={(v) => onChange('noMsgClaim', v)} />
          <Label className="text-xs">No MSG / Ajinomoto</Label>
        </div>
      </div>
    </div>
  );
}

// ─── Coaching Form ───
function CoachingForm({ data, onChange }: { data: Record<string, unknown>; onChange: (f: string, v: unknown) => void }) {
  const courses = (data.coursesOffered as Array<Record<string, unknown>>) || [{ name: '', targetAudience: '', duration: '', fee: '', schedule: '', mode: '' }];
  // Multi-select sub-types — institutes commonly cover JEE + NEET + CAT
  const subTypes = (data.subTypes as string[]) || ((data.subType as string) ? [data.subType as string] : []);
  const subType = subTypes[0] || '';
  const setSubTypes = (next: string[]) => {
    onChange('subTypes', next);
    onChange('subType', next[0] || '');
  };
  const boards = (data.boardAffiliations as string[]) || [];
  const exams = (data.entranceExamsCovered as string[]) || [];
  const faculty = (data.faculty as Array<Record<string, unknown>>) || [];
  const emiPartners = (data.emiPartnersList as string[]) || [];
  const branches = (data.branches as Array<Record<string, unknown>>) || [];
  const pastResults = (data.pastResultsStructured as Array<Record<string, unknown>>) || [];

  const SUB_TYPES: Array<{ value: string; label: string; emoji: string }> = [
    { value: 'school-tuition-primary', label: 'School tuition (primary)', emoji: '🎒' },
    { value: 'school-tuition-middle', label: 'School tuition (middle)', emoji: '📓' },
    { value: 'board-prep', label: 'Board exam prep (10/12)', emoji: '📜' },
    { value: 'jee-main', label: 'JEE Main', emoji: '📐' },
    { value: 'jee-advanced', label: 'JEE Advanced', emoji: '🧪' },
    { value: 'neet-ug', label: 'NEET UG', emoji: '🩺' },
    { value: 'cat-mba', label: 'CAT / MBA', emoji: '📊' },
    { value: 'upsc', label: 'UPSC', emoji: '🏛️' },
    { value: 'state-pcs', label: 'State PCS', emoji: '🏤' },
    { value: 'ssc-banking-railway', label: 'SSC / Banking / Railway', emoji: '🚆' },
    { value: 'ca-cs-cma', label: 'CA / CS / CMA', emoji: '📈' },
    { value: 'gate-psu', label: 'GATE / PSU', emoji: '🛠️' },
    { value: 'clat-law', label: 'CLAT / Law', emoji: '⚖️' },
    { value: 'nift-nid-ceed', label: 'NIFT / NID / CEED', emoji: '🎨' },
    { value: 'foreign-language', label: 'Foreign language', emoji: '🌍' },
    { value: 'overseas-test-prep', label: 'IELTS/SAT/GRE/GMAT', emoji: '✈️' },
    { value: 'coding-bootcamp', label: 'Coding bootcamp (adult)', emoji: '💻' },
    { value: 'coding-kids', label: 'Coding for kids', emoji: '🧒' },
    { value: 'abacus-vedic', label: 'Abacus / Vedic Math', emoji: '🧮' },
    { value: 'chess', label: 'Chess (FIDE)', emoji: '♟️' },
    { value: 'music', label: 'Music (Trinity/RSL/ABRSM)', emoji: '🎼' },
    { value: 'dance', label: 'Dance', emoji: '💃' },
    { value: 'art-calligraphy', label: 'Art / calligraphy', emoji: '🖌️' },
    { value: 'robotics-stem', label: 'Robotics / STEM', emoji: '🤖' },
    { value: 'public-speaking', label: 'Public speaking', emoji: '🎤' },
  ];

  const isEntranceCoaching = subTypes.some((s) => ['jee-main', 'jee-advanced', 'neet-ug', 'cat-mba', 'upsc', 'state-pcs', 'ssc-banking-railway', 'ca-cs-cma', 'gate-psu', 'clat-law', 'nift-nid-ceed', 'overseas-test-prep'].includes(s));
  const isHobby = subTypes.some((s) => ['music', 'dance', 'art-calligraphy', 'chess', 'robotics-stem', 'public-speaking', 'abacus-vedic'].includes(s));
  const isCoding = subTypes.includes('coding-bootcamp') || subTypes.includes('coding-kids');
  const isUnder18 = isEntranceCoaching || subTypes.some((s) => ['school-tuition-primary', 'school-tuition-middle', 'board-prep', 'coding-kids'].includes(s)) || isHobby;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold border-b border-border pb-2">Institute Details</h3>

      {/* Sub-type chooser */}
      <div>
        <Label>What kind of coaching? * <span className="text-[10px] text-muted-foreground font-normal">(pick all that apply)</span></Label>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
          {SUB_TYPES.map((st) => {
            const active = subTypes.includes(st.value);
            return (
              <button
                key={st.value}
                type="button"
                onClick={() => {
                  const next = active ? subTypes.filter((s) => s !== st.value) : [...subTypes, st.value];
                  setSubTypes(next);
                }}
                className={`text-left rounded-md border px-3 py-2 text-xs transition-colors ${
                  active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border hover:border-primary/50'
                }`}
              >
                <span className="mr-1">{st.emoji}</span>
                {st.label}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Picks affect bot tone, compliance gates (DPDPA minor consent, Raj Coaching Bill), and which extra fields appear below.
          {subTypes.length > 1 && <span className="ml-1 text-[var(--ink)]">{subTypes.length} selected.</span>}
        </p>
      </div>

      <div>
        <Label>Institute Name *</Label>
        <Input placeholder="Sharma Classes" value={(data.instituteName as string) || ''} onChange={(e) => onChange('instituteName', e.target.value)} />
      </div>

      {(subTypes.some((s) => ['school-tuition-primary', 'school-tuition-middle', 'board-prep', 'coding-kids'].includes(s))) && (
        <div>
          <Label>Boards covered</Label>
          <div className="flex gap-1 mt-1 flex-wrap">
            {['CBSE', 'ICSE', 'IB', 'IGCSE', 'NIOS', 'StateBoard_Maharashtra', 'StateBoard_Karnataka', 'StateBoard_TamilNadu', 'StateBoard_Delhi', 'StateBoard_UP', 'StateBoard_Other'].map((b) => {
              const active = boards.includes(b);
              return (
                <button key={b} type="button" onClick={() => {
                  const next = active ? boards.filter((x) => x !== b) : [...boards, b];
                  onChange('boardAffiliations', next);
                }} className={`px-2 py-1 rounded text-[10px] border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'}`}>
                  {b.replace('StateBoard_', '')}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isEntranceCoaching && (
        <div>
          <Label>Entrance exams covered</Label>
          <div className="flex gap-1 mt-1 flex-wrap">
            {['JEE_MAIN', 'JEE_ADVANCED', 'NEET_UG', 'NEET_PG', 'CAT', 'XAT', 'UPSC_CSE', 'STATE_PCS', 'SSC_CGL', 'BANKING_PO', 'RAILWAY_NTPC', 'NDA_DEFENCE', 'CA_FOUNDATION', 'GATE', 'CLAT', 'NIFT', 'IELTS', 'TOEFL', 'SAT', 'GRE', 'GMAT', 'OTHER'].map((e) => {
              const active = exams.includes(e);
              return (
                <button key={e} type="button" onClick={() => {
                  const next = active ? exams.filter((x) => x !== e) : [...exams, e];
                  onChange('entranceExamsCovered', next);
                }} className={`px-2 py-1 rounded text-[10px] border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'}`}>
                  {e.replace(/_/g, ' ')}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <h3 className="text-lg font-semibold border-b border-border pb-2">Regulator Registration</h3>
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-3">
        <p className="text-[10px] text-amber-900">
          ⚠️ <b>Rajasthan Coaching Centres Act + Central MOE Guidelines (Jan 2024)</b>: registration mandatory for centres with 50+ students in Rajasthan. Bot will REFUSE guaranteed-rank claims when these flags are off.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={(data.rajCoachingActRegistered as boolean) ?? false} onCheckedChange={(v) => onChange('rajCoachingActRegistered', v)} />
            <Label className="text-xs">Rajasthan Coaching Act registered</Label>
          </div>
          <div>
            <Label className="text-xs">Raj registration number</Label>
            <Input value={(data.rajCoachingActRegNo as string) || ''} onChange={(e) => onChange('rajCoachingActRegNo', e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={(data.centralMoeGuidelineCompliant as boolean) ?? false} onCheckedChange={(v) => onChange('centralMoeGuidelineCompliant', v)} />
            <Label className="text-xs">Central MOE Guidelines (2024) compliant</Label>
          </div>
          <div>
            <Label className="text-xs">AICTE / NGO / Society reg #</Label>
            <Input placeholder="if applicable" value={(data.aicteId as string) || (data.ngoOrSocietyRegNo as string) || ''} onChange={(e) => onChange('aicteId', e.target.value)} />
          </div>
        </div>
      </div>

      <h3 className="text-lg font-semibold border-b border-border pb-2">Faculty</h3>
      <div>
        <Label className="text-xs">Faculty info (free-text legacy)</Label>
        <Input placeholder="IIT/NIT alumni with 10+ years experience" value={(data.facultyInfo as string) || ''} onChange={(e) => onChange('facultyInfo', e.target.value)} />
      </div>
      <DynamicList
        items={faculty}
        onChange={(items) => onChange('faculty', items)}
        newItem={() => ({ id: `f-${Date.now()}`, name: '', subject: '', backgroundVerificationStatus: 'pending' })}
        addLabel="Add faculty member"
        renderItem={(item, _, update) => (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Name</Label><Input placeholder="Dr. Sharma" value={(item.name as string) || ''} onChange={(e) => update('name', e.target.value)} /></div>
              <div><Label className="text-xs">Subject</Label><Input placeholder="Physics" value={(item.subject as string) || ''} onChange={(e) => update('subject', e.target.value)} /></div>
              <div><Label className="text-xs">Experience (years)</Label><Input type="number" placeholder="12" value={(item.experienceYears as number | undefined) ?? ''} onChange={(e) => update('experienceYears', e.target.value === '' ? undefined : Number(e.target.value))} /></div>
              <div><Label className="text-xs">Alma mater</Label><Input placeholder="IIT Delhi" value={(item.almaMater as string) || ''} onChange={(e) => update('almaMater', e.target.value)} /></div>
              <div><Label className="text-xs">Past affiliations</Label><Input placeholder="Allen Kota 2018-22" value={(item.pastAffiliations as string) || ''} onChange={(e) => update('pastAffiliations', e.target.value)} /></div>
              <div>
                <Label className="text-xs">Background verification</Label>
                <select className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs" value={(item.backgroundVerificationStatus as string) || 'pending'} onChange={(e) => update('backgroundVerificationStatus', e.target.value)}>
                  <option value="pending">Pending</option>
                  <option value="verified">Verified (Raj Bill compliant)</option>
                  <option value="na">Not applicable</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={(item.isHeadOfDepartment as boolean) ?? false} onCheckedChange={(v) => update('isHeadOfDepartment', v)} />
              <Label className="text-xs">Head of department</Label>
            </div>
          </div>
        )}
      />

      <h3 className="text-lg font-semibold border-b border-border pb-2">Demo & Admission</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-2">
          <Switch checked={(data.demoClassAvailable as boolean) ?? true} onCheckedChange={(v) => onChange('demoClassAvailable', v)} />
          <Label className="text-xs">Demo class available</Label>
        </div>
        <div>
          <Label className="text-xs">Demo class price</Label>
          <Input placeholder="Free or ₹500" value={(data.demoClassPrice as string) || ''} onChange={(e) => onChange('demoClassPrice', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Demo batch hold (hours)</Label>
          <Input type="number" placeholder="48" value={(data.demoBatchHoldHours as number | undefined) ?? ''} onChange={(e) => onChange('demoBatchHoldHours', e.target.value === '' ? undefined : Number(e.target.value))} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Admission type</Label>
          <select className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" value={(data.admissionType as string) || ''} onChange={(e) => onChange('admissionType', e.target.value)}>
            <option value="">--</option>
            <option value="open">Open admission</option>
            <option value="screening_test">Screening test</option>
            <option value="interview">Interview</option>
            <option value="scholarship_test">Scholarship test</option>
            <option value="merit_marks">Merit-based</option>
          </select>
        </div>
        <div>
          <Label className="text-xs">Documents required</Label>
          <Input placeholder="ID proof, last marksheet, address proof" value={(data.admissionDocumentsRequired as string) || ''} onChange={(e) => onChange('admissionDocumentsRequired', e.target.value)} />
        </div>
      </div>
      <div>
        <Label className="text-xs">Admission process (free-text)</Label>
        <Input placeholder="Fill form -> entrance test -> counseling" value={(data.admissionProcess as string) || ''} onChange={(e) => onChange('admissionProcess', e.target.value)} />
      </div>

      {(data.admissionType === 'scholarship_test' || isEntranceCoaching) && (
        <div className="rounded-md border border-blue-300 bg-blue-50 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Switch checked={(data.scholarshipTestEnabled as boolean) ?? false} onCheckedChange={(v) => onChange('scholarshipTestEnabled', v)} />
            <Label className="text-xs font-semibold">Scholarship test offered</Label>
          </div>
          {(data.scholarshipTestEnabled as boolean) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><Label className="text-xs">Test name</Label><Input placeholder="ASAT" value={(data.scholarshipTestName as string) || ''} onChange={(e) => onChange('scholarshipTestName', e.target.value)} /></div>
              <div><Label className="text-xs">Schedule</Label><Input placeholder="Every Sunday" value={(data.scholarshipTestSchedule as string) || ''} onChange={(e) => onChange('scholarshipTestSchedule', e.target.value)} /></div>
              <div><Label className="text-xs">Max waiver %</Label><Input type="number" placeholder="100" value={(data.scholarshipTestMaxWaiverPercent as number | undefined) ?? ''} onChange={(e) => onChange('scholarshipTestMaxWaiverPercent', e.target.value === '' ? undefined : Number(e.target.value))} /></div>
            </div>
          )}
        </div>
      )}

      <h3 className="text-lg font-semibold border-b border-border pb-2">Past Results</h3>
      <p className="text-[10px] text-amber-700">⚠️ Raj Bill prohibits guaranteed-rank ads. Provide PROVABLE results only.</p>
      <DynamicList
        items={pastResults}
        onChange={(items) => onChange('pastResultsStructured', items)}
        newItem={() => ({ examName: '', year: '', totalCleared: '', topRank: '' })}
        addLabel="Add past result"
        renderItem={(item, _, update) => (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><Label className="text-xs">Exam</Label><Input placeholder="JEE Main" value={(item.examName as string) || ''} onChange={(e) => update('examName', e.target.value)} /></div>
            <div><Label className="text-xs">Year</Label><Input placeholder="2024" value={(item.year as string) || ''} onChange={(e) => update('year', e.target.value)} /></div>
            <div><Label className="text-xs">Top rank</Label><Input placeholder="AIR 47" value={(item.topRank as string) || ''} onChange={(e) => update('topRank', e.target.value)} /></div>
            <div><Label className="text-xs">Top ranker name</Label><Input placeholder="Aryan Verma" value={(item.topRankerName as string) || ''} onChange={(e) => update('topRankerName', e.target.value)} /></div>
            <div><Label className="text-xs"># Total cleared</Label><Input placeholder="78" value={(item.totalCleared as string) || ''} onChange={(e) => update('totalCleared', e.target.value)} /></div>
            <div><Label className="text-xs">Proof URL</Label><Input placeholder="https://..." value={(item.proofUrl as string) || ''} onChange={(e) => update('proofUrl', e.target.value)} /></div>
          </div>
        )}
      />
      <div>
        <Label className="text-xs">Results / achievements (free-text legacy)</Label>
        <Textarea placeholder="50+ IIT selections in 2025" value={(data.results as string) || ''} onChange={(e) => onChange('results', e.target.value)} rows={2} />
      </div>

      <h3 className="text-lg font-semibold border-b border-border pb-2">Refund Policy</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-2">
          <Switch checked={(data.proRataRefundEnabled as boolean) ?? true} onCheckedChange={(v) => onChange('proRataRefundEnabled', v)} />
          <Label className="text-xs">Pro-rata refund (Raj Bill compliant)</Label>
        </div>
        <div>
          <Label className="text-xs">Refund window (days)</Label>
          <Input type="number" placeholder="10" value={(data.refundWindowDays as number | undefined) ?? ''} onChange={(e) => onChange('refundWindowDays', e.target.value === '' ? undefined : Number(e.target.value))} />
        </div>
        <div>
          <Label className="text-xs">Cancellation fee %</Label>
          <Input type="number" placeholder="10" value={(data.cancellationFeePct as number | undefined) ?? ''} onChange={(e) => onChange('cancellationFeePct', e.target.value === '' ? undefined : Number(e.target.value))} />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.failureRepeatFreeAvailable as boolean) ?? false} onCheckedChange={(v) => onChange('failureRepeatFreeAvailable', v)} />
          <Label className="text-xs">Repeat-year free if student fails</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.lateJoinAllowed as boolean) ?? true} onCheckedChange={(v) => onChange('lateJoinAllowed', v)} />
          <Label className="text-xs">Late-join allowed</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.lateJoinProRataApplied as boolean) ?? true} onCheckedChange={(v) => onChange('lateJoinProRataApplied', v)} />
          <Label className="text-xs">Late-join fee pro-rated</Label>
        </div>
      </div>
      <div>
        <Label className="text-xs">Refund policy URL</Label>
        <Input placeholder="https://your-site.com/refund" value={(data.refundPolicyUrl as string) || ''} onChange={(e) => onChange('refundPolicyUrl', e.target.value)} />
      </div>

      <h3 className="text-lg font-semibold border-b border-border pb-2">
        EMI / Payment Plans <span className="text-xs font-normal uppercase tracking-wide bg-amber-100 text-amber-900 px-2 py-0.5 rounded ml-2">Coming soon</span>
      </h3>
      <p className="text-[10px] text-amber-800">Bot is in COD-only mode &mdash; EMI / online-payment fields below are stored for future activation but are NOT shared with customers right now.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-60">
        <div className="flex items-center gap-2">
          <Switch checked={(data.emiDisclosureEnabled as boolean) ?? false} onCheckedChange={(v) => onChange('emiDisclosureEnabled', v)} disabled />
          <Label className="text-xs">Offer EMI / instalments (Raj Bill: min 4)</Label>
        </div>
        <div>
          <Label className="text-xs">EMI agreement URL (RBI Digital Lending)</Label>
          <Input placeholder="https://..." value={(data.emiAgreementUrl as string) || ''} onChange={(e) => onChange('emiAgreementUrl', e.target.value)} disabled />
        </div>
      </div>
      {(data.emiDisclosureEnabled as boolean) && (
        <div>
          <Label className="text-xs">EMI partners</Label>
          <div className="flex gap-2 mt-1 flex-wrap">
            {['BajajFinserv', 'EduFund', 'GrayQuest', 'Propelld', 'EarlySalary', 'Other'].map((p) => {
              const active = emiPartners.includes(p);
              return (
                <button key={p} type="button" onClick={() => {
                  const next = active ? emiPartners.filter((x) => x !== p) : [...emiPartners, p];
                  onChange('emiPartnersList', next);
                }} className={`px-2 py-1 rounded text-xs border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'}`}>
                  {p}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <h3 className="text-lg font-semibold border-b border-border pb-2">Hostel / PG Referrals</h3>
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-3">
        <p className="text-[10px] text-amber-900">
          ⚠️ Truth-in-advertising: if you take a commission from referred hostels/PGs, the bot must DISCLOSE this when sharing the link.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={(data.hostelPGReferralOffered as boolean) ?? false} onCheckedChange={(v) => onChange('hostelPGReferralOffered', v)} />
            <Label className="text-xs">Refer students to hostels / PGs</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={(data.hostelPGCommissionDisclosed as boolean) ?? false} onCheckedChange={(v) => onChange('hostelPGCommissionDisclosed', v)} />
            <Label className="text-xs">I take a referral commission</Label>
          </div>
          <div>
            <Label className="text-xs">Partner hostel / PG names</Label>
            <Input placeholder="Allen Hostel, Hostelworld" value={(data.hostelPGPartnerNames as string) || ''} onChange={(e) => onChange('hostelPGPartnerNames', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Monthly rate range</Label>
            <Input placeholder="₹8,000 - ₹15,000/month" value={(data.hostelPGMonthlyRangeINR as string) || ''} onChange={(e) => onChange('hostelPGMonthlyRangeINR', e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Referral link</Label>
            <Input placeholder="https://..." value={(data.hostelPGReferralLink as string) || ''} onChange={(e) => onChange('hostelPGReferralLink', e.target.value)} />
          </div>
        </div>
      </div>

      <h3 className="text-lg font-semibold border-b border-border pb-2">Study Material & Mocks</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs">Study material mode</Label>
          <select className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" value={(data.studyMaterialMode as string) || ''} onChange={(e) => onChange('studyMaterialMode', e.target.value)}>
            <option value="">--</option>
            <option value="physical_only">Physical only</option>
            <option value="digital_only">Digital only</option>
            <option value="both">Both</option>
            <option value="none_self_arrange">Student arranges</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.pyqAccessIncluded as boolean) ?? true} onCheckedChange={(v) => onChange('pyqAccessIncluded', v)} />
          <Label className="text-xs">PYQ access</Label>
        </div>
        <div>
          <Label className="text-xs">Mock test frequency</Label>
          <Input placeholder="weekly" value={(data.mockTestFrequency as string) || ''} onChange={(e) => onChange('mockTestFrequency', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Total mocks per course</Label>
          <Input type="number" placeholder="20" value={(data.mockTestsTotalPerCourse as number | undefined) ?? ''} onChange={(e) => onChange('mockTestsTotalPerCourse', e.target.value === '' ? undefined : Number(e.target.value))} />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.aiTSeriesIncluded as boolean) ?? false} onCheckedChange={(v) => onChange('aiTSeriesIncluded', v)} />
          <Label className="text-xs">AI test-series</Label>
        </div>
      </div>
      <div>
        <Label className="text-xs">Study material (free-text legacy)</Label>
        <Input placeholder="Included in fee, DPPs + test series" value={(data.studyMaterial as string) || ''} onChange={(e) => onChange('studyMaterial', e.target.value)} />
      </div>

      {isUnder18 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Parent-teacher meet frequency</Label>
            <Input placeholder="Monthly" value={(data.parentTeacherMeetFrequency as string) || ''} onChange={(e) => onChange('parentTeacherMeetFrequency', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">PTM mode</Label>
            <select className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" value={(data.parentTeacherMeetMode as string) || ''} onChange={(e) => onChange('parentTeacherMeetMode', e.target.value)}>
              <option value="">--</option>
              <option value="offline">Offline</option>
              <option value="online">Online</option>
              <option value="both">Both</option>
            </select>
          </div>
        </div>
      )}

      <h3 className="text-lg font-semibold border-b border-border pb-2">Discounts</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs">Sibling discount %</Label>
          <Input type="number" placeholder="10" value={(data.siblingDiscountPct as number | undefined) ?? ''} onChange={(e) => onChange('siblingDiscountPct', e.target.value === '' ? undefined : Number(e.target.value))} />
        </div>
        <div>
          <Label className="text-xs">Early bird %</Label>
          <Input type="number" placeholder="15" value={(data.earlyBirdDiscountPct as number | undefined) ?? ''} onChange={(e) => onChange('earlyBirdDiscountPct', e.target.value === '' ? undefined : Number(e.target.value))} />
        </div>
        <div>
          <Label className="text-xs">Early bird deadline</Label>
          <Input placeholder="2026-06-30" value={(data.earlyBirdDeadline as string) || ''} onChange={(e) => onChange('earlyBirdDeadline', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Referral bonus</Label>
          <Input placeholder="₹2,000 wallet credit" value={(data.referralBonus as string) || ''} onChange={(e) => onChange('referralBonus', e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.scholarshipBasedDiscount as boolean) ?? false} onCheckedChange={(v) => onChange('scholarshipBasedDiscount', v)} />
          <Label className="text-xs">Scholarship-based discount</Label>
        </div>
      </div>

      {isHobby && (
        <>
          <h3 className="text-lg font-semibold border-b border-border pb-2">Hobby Extras</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={(data.instrumentRentalAvailable as boolean) ?? false} onCheckedChange={(v) => onChange('instrumentRentalAvailable', v)} />
              <Label className="text-xs">Instrument rental available</Label>
            </div>
            <div>
              <Label className="text-xs">Material kit fee</Label>
              <Input placeholder="₹1,500" value={(data.materialKitFee as string) || ''} onChange={(e) => onChange('materialKitFee', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Annual function fee</Label>
              <Input placeholder="₹1,000" value={(data.annualFunctionFee as string) || ''} onChange={(e) => onChange('annualFunctionFee', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Arangetram / recital fee</Label>
              <Input placeholder="₹25,000" value={(data.arangetramOrRecitalFee as string) || ''} onChange={(e) => onChange('arangetramOrRecitalFee', e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">External exam fee (Trinity / ABRSM / FIDE)</Label>
              <Input placeholder="₹2,500 per grade" value={(data.externalExamFee as string) || ''} onChange={(e) => onChange('externalExamFee', e.target.value)} />
            </div>
          </div>
        </>
      )}

      {isCoding && (
        <>
          <h3 className="text-lg font-semibold border-b border-border pb-2">Coding-Specific</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={(data.corporateTrainingArm as boolean) ?? false} onCheckedChange={(v) => onChange('corporateTrainingArm', v)} />
              <Label className="text-xs">Corporate training arm</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={(data.overseasPrepAddon as boolean) ?? false} onCheckedChange={(v) => onChange('overseasPrepAddon', v)} />
              <Label className="text-xs">Overseas prep add-on</Label>
            </div>
          </div>
        </>
      )}

      <h3 className="text-lg font-semibold border-b border-border pb-2">Multi-Location (optional)</h3>
      <div className="flex items-center gap-2">
        <Switch checked={(data.multiLocationEnabled as boolean) ?? false} onCheckedChange={(v) => onChange('multiLocationEnabled', v)} />
        <Label className="text-xs">Multi-centre institute</Label>
      </div>
      {(data.multiLocationEnabled as boolean) && (
        <DynamicList
          items={branches}
          onChange={(items) => onChange('branches', items)}
          newItem={() => ({ id: `b-${Date.now()}`, name: '', city: '', address: '' })}
          addLabel="Add branch"
          renderItem={(item, _, update) => (
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Branch name</Label><Input placeholder="Allen - Kota Main" value={(item.name as string) || ''} onChange={(e) => update('name', e.target.value)} /></div>
              <div><Label className="text-xs">City</Label><Input placeholder="Kota" value={(item.city as string) || ''} onChange={(e) => update('city', e.target.value)} /></div>
              <div className="col-span-2"><Label className="text-xs">Address</Label><Input value={(item.address as string) || ''} onChange={(e) => update('address', e.target.value)} /></div>
              <div><Label className="text-xs">Manager</Label><Input value={(item.managerName as string) || ''} onChange={(e) => update('managerName', e.target.value)} /></div>
              <div><Label className="text-xs">Contact #</Label><Input value={(item.contactNumber as string) || ''} onChange={(e) => update('contactNumber', e.target.value)} /></div>
            </div>
          )}
        />
      )}

      <h3 className="text-lg font-semibold border-b border-border pb-2">Compliance Gates</h3>
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-3">
        <p className="text-[10px] text-amber-900">
          ⚠️ Bot enforces these compliance flags strictly. Refusing to enable a flag below means the bot will treat that workflow as non-compliant.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isUnder18 && (
            <div className="flex items-center gap-2">
              <Switch checked={(data.minorConsentCollected as boolean) ?? false} onCheckedChange={(v) => onChange('minorConsentCollected', v)} />
              <Label className="text-xs">Verifiable parent consent flow set up (DPDPA Section 9)</Label>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Switch checked={(data.noFalseRankClaim as boolean) ?? true} onCheckedChange={(v) => onChange('noFalseRankClaim', v)} />
            <Label className="text-xs">No guaranteed-rank ads (Raj Bill)</Label>
          </div>
          <div>
            <Label className="text-xs">Max class hours per day (Raj Bill cap: 5)</Label>
            <Input type="number" placeholder="5" value={(data.maxClassHoursPerDay as number | undefined) ?? ''} onChange={(e) => onChange('maxClassHoursPerDay', e.target.value === '' ? undefined : Number(e.target.value))} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={(data.mentalHealthCounsellorAvailable as boolean) ?? false} onCheckedChange={(v) => onChange('mentalHealthCounsellorAvailable', v)} />
            <Label className="text-xs">Mental-health counsellor on staff (mandatory for 100+)</Label>
          </div>
          <div>
            <Label className="text-xs">Batch size (free-text legacy)</Label>
            <Input placeholder="Max 30 students" value={(data.batchSize as string) || ''} onChange={(e) => onChange('batchSize', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">GSTIN (optional)</Label>
            <Input placeholder="29XXXXX1234X1Z5" value={(data.gstin as string) || ''} onChange={(e) => onChange('gstin', e.target.value.toUpperCase())} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-border pb-2">
        <h3 className="text-lg font-semibold">Courses</h3>
        <CoachingCoursesBulkImport data={data} onChange={onChange} />
      </div>
      <DynamicList
        items={courses}
        onChange={(items) => onChange('coursesOffered', items)}
        newItem={() => ({ name: '', targetAudience: '', duration: '', fee: '', schedule: '', mode: '' })}
        addLabel="Add Course"
        renderItem={(item, _, update) => (
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Course Name</Label><Input placeholder="IIT-JEE Crash Course" value={(item.name as string) || ''} onChange={(e) => update('name', e.target.value)} /></div>
            <div><Label>Target Audience</Label><Input placeholder="Class 11-12" value={(item.targetAudience as string) || ''} onChange={(e) => update('targetAudience', e.target.value)} /></div>
            <div><Label>Duration</Label><Input placeholder="6 months" value={(item.duration as string) || ''} onChange={(e) => update('duration', e.target.value)} /></div>
            <div><Label>Fee</Label><Input placeholder="Rs.45,000" value={(item.fee as string) || ''} onChange={(e) => update('fee', e.target.value)} /></div>
            <div><Label>Schedule</Label><Input placeholder="Mon-Fri, 4-7 PM" value={(item.schedule as string) || ''} onChange={(e) => update('schedule', e.target.value)} /></div>
            <div><Label>Mode</Label><Input placeholder="Offline + Online" value={(item.mode as string) || ''} onChange={(e) => update('mode', e.target.value)} /></div>
          </div>
        )}
      />
    </div>
  );
}

// ─── Real Estate Form ───
function RealEstateForm({ data, onChange }: { data: Record<string, unknown>; onChange: (f: string, v: unknown) => void }) {
  const listings = (data.currentListings as Array<Record<string, unknown>>) || [{ title: '', type: '', price: '', area: '', highlights: '' }];
  const operatingAreas = (data.operatingAreas as string[]) || [];
  const propertyTypes = (data.propertyTypes as string[]) || [];
  const servicesList = (data.services as string[]) || ['Buy', 'Sell', 'Rent'];
  const banks = (data.homeLoanBanks as string[]) || [];
  // Multi-select sub-types — channel-partners often also do resale + rental
  const subTypes = (data.subTypes as string[]) || ((data.subType as string) ? [data.subType as string] : []);
  const subType = subTypes[0] || '';
  const setSubTypes = (next: string[]) => {
    onChange('subTypes', next);
    onChange('subType', next[0] || '');
  };
  const builderProjects = (data.builderProjects as Array<Record<string, unknown>>) || [];
  const homeLoanPartners = (data.homeLoanPartners as Array<Record<string, unknown>>) || [];
  const staffMembers = (data.staffMembers as Array<Record<string, unknown>>) || [];
  const tenantPref = (data.rentalTenantPreference as string[]) || [];
  const pgSharing = (data.pgSharingTypes as string[]) || [];
  const nriCurrencies = (data.nriCurrencyDisplay as string[]) || ['INR'];
  const redevCities = (data.redevelopmentCityScope as string[]) || [];
  const redevSocieties = (data.redevelopmentSocietyTypes as string[]) || [];

  const SUB_TYPES: Array<{ value: string; label: string; emoji: string }> = [
    { value: 'solo-broker-rental', label: 'Solo broker (rental focus)', emoji: '🏘️' },
    { value: 'broker-firm-5-50', label: 'Broker firm (5-50 agents)', emoji: '🏢' },
    { value: 'builder-developer', label: 'Builder / developer', emoji: '🏗️' },
    { value: 'channel-partner-agency', label: 'Channel-partner agency', emoji: '🤝' },
    { value: 'commercial-only', label: 'Commercial only', emoji: '🏬' },
    { value: 'nri-focused', label: 'NRI-focused', emoji: '🌐' },
    { value: 'pg-aggregator', label: 'PG aggregator (Stanza/Zolo)', emoji: '🛏️' },
    { value: 'co-living-operator', label: 'Co-living operator (Colive/CoHo)', emoji: '🏨' },
    { value: 'short-term-rental', label: 'Short-term / Airbnb', emoji: '🏝️' },
    { value: 'plot-and-land', label: 'Plot & land', emoji: '🌳' },
    { value: 'farmhouse-villa', label: 'Farmhouse / villa', emoji: '🏡' },
    { value: 'luxury-5cr-plus', label: 'Luxury (>₹5 Cr)', emoji: '💎' },
    { value: 'industrial-warehouse', label: 'Industrial / warehouse', emoji: '🏭' },
    { value: 'property-management', label: 'Property management', emoji: '🔧' },
    { value: 'home-loan-dsa', label: 'Home loan DSA', emoji: '💰' },
    { value: 'redevelopment-specialist', label: 'Redevelopment (Mumbai PAAA)', emoji: '🔁' },
    { value: 'resale-only', label: 'Resale-only', emoji: '🔄' },
    { value: 'affordable-pmay-dsa', label: 'Affordable / PMAY DSA', emoji: '🏠' },
  ];

  const isBuilder = subTypes.includes('builder-developer') || subTypes.includes('channel-partner-agency');
  const isPG = subTypes.includes('pg-aggregator') || subTypes.includes('co-living-operator');
  const isNRI = subTypes.includes('nri-focused');
  const isRedev = subTypes.includes('redevelopment-specialist');
  const isRental = subTypes.includes('solo-broker-rental') || subTypes.includes('short-term-rental');

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold border-b border-border pb-2">Real Estate Details</h3>

      {/* Sub-type chooser — MULTI-SELECT */}
      <div>
        <Label>What kind of real estate business? * <span className="text-[10px] text-muted-foreground font-normal">(pick all that apply)</span></Label>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
          {SUB_TYPES.map((st) => {
            const active = subTypes.includes(st.value);
            return (
              <button
                key={st.value}
                type="button"
                onClick={() => {
                  const next = active ? subTypes.filter((s) => s !== st.value) : [...subTypes, st.value];
                  setSubTypes(next);
                }}
                className={`text-left rounded-md border px-3 py-2 text-xs transition-colors ${
                  active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border hover:border-primary/50'
                }`}
              >
                <span className="mr-1">{st.emoji}</span>
                {st.label}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">Real estate is the most legally-complex vertical (RERA + GST + DPDPA + FEMA). Pick precisely &mdash; bot rules adapt.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Agent / Firm Name *</Label>
          <Input placeholder="Rahul Verma / Verma Realty" value={(data.agentName as string) || ''} onChange={(e) => onChange('agentName', e.target.value)} />
        </div>
        <div>
          <Label>Exclusive / Co-broking</Label>
          <select className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" value={(data.exclusiveOrCoBroking as string) || ''} onChange={(e) => onChange('exclusiveOrCoBroking', e.target.value)}>
            <option value="">--</option>
            <option value="exclusive">Exclusive listings only</option>
            <option value="co_broking">Co-broking (open with other agents)</option>
            <option value="both">Both</option>
          </select>
        </div>
      </div>

      {/* RERA registration block — MANDATORY */}
      <div className="rounded-md border border-red-300 bg-red-50 p-3 space-y-3">
        <div className="text-xs font-semibold text-red-900">⚠️ RERA Registration (MANDATORY — Real Estate (Regulation &amp; Development) Act 2016 §62)</div>
        <p className="text-[10px] text-red-900">
          Every real-estate intermediary must register with state RERA. Bot will REFUSE to send replies that mention property listings without an active RERA number on file.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs">Agent RERA Number *</Label>
            <Input placeholder="A51900000123" value={(data.reraNumber as string) || ''} onChange={(e) => onChange('reraNumber', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">RERA State</Label>
            <Input placeholder="Maharashtra" value={(data.agentReraState as string) || ''} onChange={(e) => onChange('agentReraState', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">RERA Expiry Date</Label>
            <Input type="date" value={(data.agentReraExpiry as string) || ''} onChange={(e) => onChange('agentReraExpiry', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">PAN</Label>
            <Input placeholder="ABCDE1234F" value={(data.panNumber as string) || ''} onChange={(e) => onChange('panNumber', e.target.value.toUpperCase())} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">GSTIN (optional)</Label>
            <Input placeholder="29XXXXX1234X1Z5" value={(data.gstin as string) || ''} onChange={(e) => onChange('gstin', e.target.value.toUpperCase())} />
          </div>
        </div>
      </div>

      <div>
        <Label>Operating Areas (comma-separated)</Label>
        <Input placeholder="Dwarka, Gurgaon, Noida" value={operatingAreas.join(', ')} onChange={(e) => onChange('operatingAreas', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
      </div>
      <div>
        <Label>Property Types (comma-separated)</Label>
        <Input placeholder="2BHK, 3BHK, Villa, Commercial" value={propertyTypes.join(', ')} onChange={(e) => onChange('propertyTypes', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
      </div>
      <div>
        <Label>Services (comma-separated)</Label>
        <Input placeholder="Buy, Sell, Rent, Home Loan" value={servicesList.join(', ')} onChange={(e) => onChange('services', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
      </div>

      {/* Legal documentation services */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Legal Documentation Services</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Switch checked={(data.ocSupportAvailable as boolean) ?? false} onCheckedChange={(v) => onChange('ocSupportAvailable', v)} />
          <Label className="text-xs">OC support</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.ccSupportAvailable as boolean) ?? false} onCheckedChange={(v) => onChange('ccSupportAvailable', v)} />
          <Label className="text-xs">CC support</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.encumbranceCertSupport as boolean) ?? false} onCheckedChange={(v) => onChange('encumbranceCertSupport', v)} />
          <Label className="text-xs">Encumbrance Certificate</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.saleDeedDraftingSupport as boolean) ?? false} onCheckedChange={(v) => onChange('saleDeedDraftingSupport', v)} />
          <Label className="text-xs">Sale-deed drafting</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.khataExpertiseBangalore as boolean) ?? false} onCheckedChange={(v) => onChange('khataExpertiseBangalore', v)} />
          <Label className="text-xs">Bangalore A/B Khata</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.vastuConsultantAvailable as boolean) ?? false} onCheckedChange={(v) => onChange('vastuConsultantAvailable', v)} />
          <Label className="text-xs">Vastu consultant</Label>
        </div>
      </div>

      {/* Builder projects (when sub-type matches) */}
      {isBuilder && (
        <>
          <h3 className="text-lg font-semibold border-b border-border pb-2">Builder Projects</h3>
          <p className="text-[10px] text-amber-700">⚠️ Each project needs its OWN RERA number. The bot will refuse to share a project that&apos;s missing RERA.</p>
          <DynamicList
            items={builderProjects}
            onChange={(items) => onChange('builderProjects', items)}
            newItem={() => ({ id: `p-${Date.now()}`, name: '', reraNumber: '', developerName: '', projectType: 'residential', ocStatus: 'na_under_construction' })}
            addLabel="Add project"
            renderItem={(item, _, update) => (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Project name</Label><Input placeholder="Prestige Skyline" value={(item.name as string) || ''} onChange={(e) => update('name', e.target.value)} /></div>
                  <div><Label className="text-xs">Developer</Label><Input placeholder="Prestige Group" value={(item.developerName as string) || ''} onChange={(e) => update('developerName', e.target.value)} /></div>
                  <div><Label className="text-xs">RERA number *</Label><Input placeholder="P51800012345" value={(item.reraNumber as string) || ''} onChange={(e) => update('reraNumber', e.target.value)} /></div>
                  <div><Label className="text-xs">RERA QR URL</Label><Input placeholder="https://maharera..." value={(item.reraQrUrl as string) || ''} onChange={(e) => update('reraQrUrl', e.target.value)} /></div>
                  <div><Label className="text-xs">RERA expiry</Label><Input type="date" value={(item.reraExpiryDate as string) || ''} onChange={(e) => update('reraExpiryDate', e.target.value)} /></div>
                  <div>
                    <Label className="text-xs">Project type</Label>
                    <select className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs" value={(item.projectType as string) || 'residential'} onChange={(e) => update('projectType', e.target.value)}>
                      <option value="residential">Residential</option>
                      <option value="commercial">Commercial</option>
                      <option value="mixed">Mixed-use</option>
                      <option value="plotted">Plotted</option>
                    </select>
                  </div>
                  <div><Label className="text-xs">Possession date</Label><Input placeholder="Dec 2027" value={(item.possessionDate as string) || ''} onChange={(e) => update('possessionDate', e.target.value)} /></div>
                  <div>
                    <Label className="text-xs">OC status</Label>
                    <select className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs" value={(item.ocStatus as string) || 'na_under_construction'} onChange={(e) => update('ocStatus', e.target.value)}>
                      <option value="received">OC received</option>
                      <option value="applied">Applied</option>
                      <option value="pending">Pending</option>
                      <option value="na_under_construction">Under construction</option>
                    </select>
                  </div>
                  <div><Label className="text-xs">Total units</Label><Input type="number" placeholder="450" value={(item.totalUnits as number | undefined) ?? ''} onChange={(e) => update('totalUnits', e.target.value === '' ? undefined : Number(e.target.value))} /></div>
                  <div><Label className="text-xs">Total towers</Label><Input type="number" placeholder="6" value={(item.totalTowers as number | undefined) ?? ''} onChange={(e) => update('totalTowers', e.target.value === '' ? undefined : Number(e.target.value))} /></div>
                </div>
                <div>
                  <Label className="text-xs">Configurations available</Label>
                  <Input placeholder="1BHK / 2BHK / 3BHK / 4BHK" value={(item.configurationsAvailable as string) || ''} onChange={(e) => update('configurationsAvailable', e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Amenities (comma)</Label>
                  <Input placeholder="Pool, gym, clubhouse, kids' play, jogging track" value={(item.amenities as string) || ''} onChange={(e) => update('amenities', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><Label className="text-xs">Distance metro</Label><Input placeholder="800m" value={(item.distanceMetro as string) || ''} onChange={(e) => update('distanceMetro', e.target.value)} /></div>
                  <div><Label className="text-xs">Distance school</Label><Input placeholder="1.2km" value={(item.distanceSchool as string) || ''} onChange={(e) => update('distanceSchool', e.target.value)} /></div>
                  <div><Label className="text-xs">Distance airport</Label><Input placeholder="22km" value={(item.distanceAirport as string) || ''} onChange={(e) => update('distanceAirport', e.target.value)} /></div>
                  <div><Label className="text-xs">Distance IT park</Label><Input placeholder="3km Whitefield" value={(item.distanceItPark as string) || ''} onChange={(e) => update('distanceItPark', e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={(item.gatedCommunity as boolean) ?? false} onCheckedChange={(v) => update('gatedCommunity', v)} />
                    <Label className="text-xs">Gated community</Label>
                  </div>
                  <div><Label className="text-xs">Maintenance / sqft / month</Label><Input placeholder="₹4.5/sqft" value={(item.societyMaintenancePerSqft as string) || ''} onChange={(e) => update('societyMaintenancePerSqft', e.target.value)} /></div>
                  <div className="col-span-2"><Label className="text-xs">Approved by banks</Label><Input placeholder="SBI, HDFC, ICICI, Axis, Kotak" value={(item.approvedByBanks as string) || ''} onChange={(e) => update('approvedByBanks', e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Brochure URL</Label><Input placeholder="https://..." value={(item.brochureUrl as string) || ''} onChange={(e) => update('brochureUrl', e.target.value)} /></div>
                  <div><Label className="text-xs">Walkthrough video URL</Label><Input placeholder="https://youtu.be/..." value={(item.walkthroughVideoUrl as string) || ''} onChange={(e) => update('walkthroughVideoUrl', e.target.value)} /></div>
                </div>
              </div>
            )}
          />
        </>
      )}

      {/* Rental policy */}
      {(isRental || servicesList.includes('Rent')) && (
        <>
          <h3 className="text-lg font-semibold border-b border-border pb-2">Rental Policy</h3>
          <p className="text-[10px] text-muted-foreground">Deposit norms vary by city. Bot uses these defaults when answering rental queries.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { k: 'rentalDepositMonthsBLR', l: 'Bangalore (5-10)' },
              { k: 'rentalDepositMonthsMUM', l: 'Mumbai (1-6)' },
              { k: 'rentalDepositMonthsDEL', l: 'Delhi NCR (2-3)' },
              { k: 'rentalDepositMonthsPUN', l: 'Pune (2-6)' },
              { k: 'rentalDepositMonthsHYD', l: 'Hyderabad (2-6)' },
              { k: 'rentalDepositMonthsCHE', l: 'Chennai (2-6)' },
              { k: 'rentalDepositMonthsOther', l: 'Other cities' },
            ].map((c) => (
              <div key={c.k}>
                <Label className="text-xs">{c.l}</Label>
                <Input
                  type="number"
                  placeholder="months"
                  value={(data[c.k] as number | undefined) ?? ''}
                  onChange={(e) => onChange(c.k, e.target.value === '' ? undefined : Number(e.target.value))}
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Lock-in (months)</Label>
              <Input type="number" placeholder="11" value={(data.rentalLockInMonths as number | undefined) ?? ''} onChange={(e) => onChange('rentalLockInMonths', e.target.value === '' ? undefined : Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs">Notice period</Label>
              <select className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" value={String((data.rentalNoticePeriodMonths as number) || '')} onChange={(e) => onChange('rentalNoticePeriodMonths', e.target.value === '' ? undefined : Number(e.target.value))}>
                <option value="">--</option>
                <option value="1">1 month</option>
                <option value="2">2 months</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Pets allowed</Label>
              <select className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" value={(data.rentalPetsAllowed as string) || ''} onChange={(e) => onChange('rentalPetsAllowed', e.target.value)}>
                <option value="">--</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="case_by_case">Case by case</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Default furnishing</Label>
              <select className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" value={(data.rentalFurnishingDefault as string) || ''} onChange={(e) => onChange('rentalFurnishingDefault', e.target.value)}>
                <option value="">--</option>
                <option value="unfurnished">Unfurnished</option>
                <option value="semi_furnished">Semi-furnished</option>
                <option value="fully_furnished">Fully furnished</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Agreement type</Label>
              <select className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" value={(data.rentalAgreementType as string) || ''} onChange={(e) => onChange('rentalAgreementType', e.target.value)}>
                <option value="">--</option>
                <option value="leave_and_licence">Leave &amp; Licence</option>
                <option value="rent_agreement">Rent agreement</option>
                <option value="company_lease">Company lease</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={(data.rentalRegistrationByOwner as boolean) ?? true} onCheckedChange={(v) => onChange('rentalRegistrationByOwner', v)} />
              <Label className="text-xs">Registration by owner</Label>
            </div>
          </div>
          <div>
            <Label className="text-xs">Tenant preference (multi-select)</Label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {['bachelor', 'family', 'working_pro', 'student', 'company_lease'].map((p) => {
                const active = tenantPref.includes(p);
                return (
                  <button key={p} type="button" onClick={() => {
                    const next = active ? tenantPref.filter((x) => x !== p) : [...tenantPref, p];
                    onChange('rentalTenantPreference', next);
                  }} className={`px-2 py-1 rounded text-xs border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'}`}>
                    {p.replace(/_/g, ' ')}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* PG / Co-living */}
      {isPG && (
        <>
          <h3 className="text-lg font-semibold border-b border-border pb-2">PG / Co-living Configuration</h3>
          <div>
            <Label className="text-xs">Sharing types offered</Label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {[
                { v: '1_share', l: '1-share (private)' },
                { v: '2_share', l: '2-share' },
                { v: '3_share', l: '3-share' },
                { v: '4_share', l: '4-share' },
                { v: 'private', l: 'Private suite' },
              ].map((o) => {
                const active = pgSharing.includes(o.v);
                return (
                  <button key={o.v} type="button" onClick={() => {
                    const next = active ? pgSharing.filter((x) => x !== o.v) : [...pgSharing, o.v];
                    onChange('pgSharingTypes', next);
                  }} className={`px-2 py-1 rounded text-xs border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'}`}>
                    {o.l}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Gender policy</Label>
              <select className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" value={(data.pgGenderPolicy as string) || ''} onChange={(e) => onChange('pgGenderPolicy', e.target.value)}>
                <option value="">--</option>
                <option value="male">Male only</option>
                <option value="female">Female only</option>
                <option value="unisex">Unisex (separate floors)</option>
                <option value="couples_ok">Couples OK</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={(data.pgFoodIncluded as boolean) ?? true} onCheckedChange={(v) => onChange('pgFoodIncluded', v)} />
              <Label className="text-xs">Food included</Label>
            </div>
            {(data.pgFoodIncluded as boolean) && (
              <>
                <div>
                  <Label className="text-xs">Meals per day</Label>
                  <select className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" value={String((data.pgMealsPerDay as number | undefined) ?? '')} onChange={(e) => onChange('pgMealsPerDay', e.target.value === '' ? undefined : Number(e.target.value))}>
                    <option value="">--</option>
                    <option value="0">0</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Food type</Label>
                  <select className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" value={(data.pgFoodType as string) || ''} onChange={(e) => onChange('pgFoodType', e.target.value)}>
                    <option value="">--</option>
                    <option value="veg">Veg</option>
                    <option value="non-veg">Non-veg</option>
                    <option value="jain">Jain</option>
                    <option value="mixed">Mixed</option>
                  </select>
                </div>
              </>
            )}
            <div>
              <Label className="text-xs">Electricity billing</Label>
              <select className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" value={(data.pgElectricityBilling as string) || ''} onChange={(e) => onChange('pgElectricityBilling', e.target.value)}>
                <option value="">--</option>
                <option value="included">Included</option>
                <option value="submeter_actuals">Sub-meter (actuals)</option>
                <option value="flat_addon">Flat add-on</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Exit fee</Label>
              <Input placeholder="₹2,500 + 18% GST (Zolo norm)" value={(data.pgExitFeeInr as string) || ''} onChange={(e) => onChange('pgExitFeeInr', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Notice period (days)</Label>
              <Input type="number" placeholder="30" value={(data.pgNoticePeriodDays as number | undefined) ?? ''} onChange={(e) => onChange('pgNoticePeriodDays', e.target.value === '' ? undefined : Number(e.target.value))} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={(data.pgInAppMaintenance as boolean) ?? false} onCheckedChange={(v) => onChange('pgInAppMaintenance', v)} />
              <Label className="text-xs">In-app maintenance</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={(data.pgGroAvailable as boolean) ?? false} onCheckedChange={(v) => onChange('pgGroAvailable', v)} />
              <Label className="text-xs">Grievance Redressal Officer</Label>
            </div>
          </div>
          <div>
            <Label className="text-xs">Amenities included</Label>
            <Input placeholder="WiFi, AC, fridge, geyser, housekeeping" value={(data.pgAmenitiesIncluded as string) || ''} onChange={(e) => onChange('pgAmenitiesIncluded', e.target.value)} />
          </div>
        </>
      )}

      {/* NRI support */}
      {isNRI && (
        <>
          <h3 className="text-lg font-semibold border-b border-border pb-2">NRI Support</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={(data.nriSupportEnabled as boolean) ?? true} onCheckedChange={(v) => onChange('nriSupportEnabled', v)} />
              <Label className="text-xs">NRI desk active</Label>
            </div>
            <div>
              <Label className="text-xs">Countries served (comma)</Label>
              <Input placeholder="USA, UAE, UK, Singapore" value={(data.nriCountriesServed as string) || ''} onChange={(e) => onChange('nriCountriesServed', e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Currency display</Label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {['INR', 'USD', 'AED', 'GBP', 'SGD'].map((c) => {
                  const active = nriCurrencies.includes(c);
                  return (
                    <button key={c} type="button" onClick={() => {
                      const next = active ? nriCurrencies.filter((x) => x !== c) : [...nriCurrencies, c];
                      onChange('nriCurrencyDisplay', next);
                    }} className={`px-2 py-1 rounded text-xs border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'}`}>
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={(data.nriPoaSupportEnabled as boolean) ?? false} onCheckedChange={(v) => onChange('nriPoaSupportEnabled', v)} />
              <Label className="text-xs">Power of Attorney support</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={(data.nriVideoSiteVisit as boolean) ?? true} onCheckedChange={(v) => onChange('nriVideoSiteVisit', v)} />
              <Label className="text-xs">Video site visit</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={(data.nriFcnrNreNroAdvisory as boolean) ?? true} onCheckedChange={(v) => onChange('nriFcnrNreNroAdvisory', v)} />
              <Label className="text-xs">FCNR / NRE / NRO advisory</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={(data.nriTdsAdvisoryOnly as boolean) ?? true} onCheckedChange={(v) => onChange('nriTdsAdvisoryOnly', v)} />
              <Label className="text-xs">TDS advisory (verify with CA)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={(data.nriRepatriationAdvisoryOnly as boolean) ?? true} onCheckedChange={(v) => onChange('nriRepatriationAdvisoryOnly', v)} />
              <Label className="text-xs">Repatriation advisory only</Label>
            </div>
          </div>
          <p className="text-[10px] text-amber-700">
            ⚠️ FEMA + RBI: Bot will mark TDS / repatriation / FCNR-NRE-NRO advice as ADVISORY ONLY and ask the customer to verify with their CA / banker. Never offers binding tax / regulatory advice.
          </p>
        </>
      )}

      {/* Redevelopment */}
      {isRedev && (
        <>
          <h3 className="text-lg font-semibold border-b border-border pb-2">Redevelopment Expertise</h3>
          <div>
            <Label className="text-xs">City scope</Label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {['MUM', 'PUN', 'DEL', 'OTHER'].map((c) => {
                const active = redevCities.includes(c);
                return (
                  <button key={c} type="button" onClick={() => {
                    const next = active ? redevCities.filter((x) => x !== c) : [...redevCities, c];
                    onChange('redevelopmentCityScope', next);
                  }} className={`px-2 py-1 rounded text-xs border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'}`}>
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Label className="text-xs">Society types handled</Label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {['cooperative', 'mhada', 'cessed', 'slum_redev_sra'].map((s) => {
                const active = redevSocieties.includes(s);
                return (
                  <button key={s} type="button" onClick={() => {
                    const next = active ? redevSocieties.filter((x) => x !== s) : [...redevSocieties, s];
                    onChange('redevelopmentSocietyTypes', next);
                  }} className={`px-2 py-1 rounded text-xs border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'}`}>
                    {s.replace(/_/g, ' ')}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Switch checked={(data.redevelopmentPaaaSupported as boolean) ?? true} onCheckedChange={(v) => onChange('redevelopmentPaaaSupported', v)} />
              <Label className="text-xs">PAAA support (Mumbai)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={(data.redevelopmentFsiTdrAdvisory as boolean) ?? true} onCheckedChange={(v) => onChange('redevelopmentFsiTdrAdvisory', v)} />
              <Label className="text-xs">FSI / TDR advisory</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={(data.redevelopmentTransitRentNegotiation as boolean) ?? true} onCheckedChange={(v) => onChange('redevelopmentTransitRentNegotiation', v)} />
              <Label className="text-xs">Transit-rent negotiation</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={(data.redevelopmentCorpusNegotiation as boolean) ?? true} onCheckedChange={(v) => onChange('redevelopmentCorpusNegotiation', v)} />
              <Label className="text-xs">Corpus negotiation</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={(data.redevelopmentSelfRedevAdvisory as boolean) ?? false} onCheckedChange={(v) => onChange('redevelopmentSelfRedevAdvisory', v)} />
              <Label className="text-xs">Self-redev advisory</Label>
            </div>
          </div>
        </>
      )}

      {/* Brokerage structure */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Brokerage Structure</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs">Rental brokerage (months)</Label>
          <select className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" value={String((data.rentalBrokerageMonths as number) || '')} onChange={(e) => onChange('rentalBrokerageMonths', e.target.value === '' ? undefined : Number(e.target.value))}>
            <option value="">--</option>
            <option value="0.5">0.5 month</option>
            <option value="1">1 month</option>
            <option value="2">2 months</option>
          </select>
        </div>
        <div>
          <Label className="text-xs">Rental brokerage % (alt)</Label>
          <Input placeholder="8.33% of annual rent" value={(data.rentalBrokeragePct as string) || ''} onChange={(e) => onChange('rentalBrokeragePct', e.target.value)} />
        </div>
        <div className="md:col-span-1" />
        <div>
          <Label className="text-xs">Sale brokerage % min</Label>
          <Input placeholder="1" value={(data.saleBrokeragePctMin as string) || ''} onChange={(e) => onChange('saleBrokeragePctMin', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Sale brokerage % max</Label>
          <Input placeholder="2" value={(data.saleBrokeragePctMax as string) || ''} onChange={(e) => onChange('saleBrokeragePctMax', e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.saleBrokerageGstApplicable as boolean) ?? true} onCheckedChange={(v) => onChange('saleBrokerageGstApplicable', v)} />
          <Label className="text-xs">GST 18% applicable on brokerage</Label>
        </div>
        {subType === 'channel-partner-agency' && (
          <div>
            <Label className="text-xs">Builder brokerage (% of deal)</Label>
            <Input placeholder="2-3% of deal value" value={(data.builderBrokeragePctOfDeal as string) || ''} onChange={(e) => onChange('builderBrokeragePctOfDeal', e.target.value)} />
          </div>
        )}
        <div className="flex items-center gap-2">
          <Switch checked={(data.noBrokerageSchemeAvailable as boolean) ?? false} onCheckedChange={(v) => onChange('noBrokerageSchemeAvailable', v)} />
          <Label className="text-xs">No-brokerage scheme available</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.brokerageNegotiable as boolean) ?? true} onCheckedChange={(v) => onChange('brokerageNegotiable', v)} />
          <Label className="text-xs">Brokerage negotiable</Label>
        </div>
      </div>

      {/* Tax & charges */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Tax &amp; Charges Advisory</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">GST applicability hint (default)</Label>
          <select className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" value={(data.gstApplicabilityHint as string) || ''} onChange={(e) => onChange('gstApplicabilityHint', e.target.value)}>
            <option value="">--</option>
            <option value="under_construction_affordable_1pct">Under-construction affordable: 1%</option>
            <option value="under_construction_non_affordable_5pct">Under-construction non-affordable: 5%</option>
            <option value="commercial_uc_12pct">Commercial under-construction: 12%</option>
            <option value="ready_to_move_nil">Ready-to-move: NIL</option>
            <option value="rental_residential_nil">Residential rent: NIL</option>
            <option value="rental_commercial_18pct">Commercial rent: 18%</option>
            <option value="st_rental_above_7500_12pct">Short-term &gt; ₹7,500/day: 12%</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.stampDutyAdvisoryEnabled as boolean) ?? true} onCheckedChange={(v) => onChange('stampDutyAdvisoryEnabled', v)} />
          <Label className="text-xs">Stamp-duty advisory</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.registrationChargeAdvisoryEnabled as boolean) ?? true} onCheckedChange={(v) => onChange('registrationChargeAdvisoryEnabled', v)} />
          <Label className="text-xs">Registration-charge advisory</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.womenBuyerConcessionFlag as boolean) ?? true} onCheckedChange={(v) => onChange('womenBuyerConcessionFlag', v)} />
          <Label className="text-xs">Women-buyer stamp-duty concession (1-2% in many states)</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.pmayClssEligibility as boolean) ?? false} onCheckedChange={(v) => onChange('pmayClssEligibility', v)} />
          <Label className="text-xs">PMAY CLSS eligibility check</Label>
        </div>
      </div>

      {/* Site visit */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Site Visit</h3>
      <div>
        <Label>Site Visit Process (free-text)</Label>
        <Input placeholder="Book via WhatsApp, free cab pickup within 5km" value={(data.siteVisitProcess as string) || ''} onChange={(e) => onChange('siteVisitProcess', e.target.value)} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs">Pickup supported (km radius)</Label>
          <Input type="number" placeholder="5" value={(data.siteVisitPickupSupportedKm as number | undefined) ?? ''} onChange={(e) => onChange('siteVisitPickupSupportedKm', e.target.value === '' ? undefined : Number(e.target.value))} />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.siteVisitVirtualTourEnabled as boolean) ?? false} onCheckedChange={(v) => onChange('siteVisitVirtualTourEnabled', v)} />
          <Label className="text-xs">Virtual tour available</Label>
        </div>
        <div>
          <Label className="text-xs">Weekend hours</Label>
          <Input placeholder="Sat-Sun 10 AM-7 PM" value={(data.siteVisitWeekendHours as string) || ''} onChange={(e) => onChange('siteVisitWeekendHours', e.target.value)} />
        </div>
        <div className="md:col-span-3">
          <Label className="text-xs">Outstation cancellation fee</Label>
          <Input placeholder="₹2,000 (refundable on visit)" value={(data.siteVisitOutstationCancellationFee as string) || ''} onChange={(e) => onChange('siteVisitOutstationCancellationFee', e.target.value)} />
        </div>
      </div>

      {/* Home loan */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Home Loan</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center gap-3">
          <Switch checked={(data.homeLoanAssistance as boolean) ?? false} onCheckedChange={(v) => onChange('homeLoanAssistance', v)} />
          <Label>Home loan assistance offered</Label>
        </div>
        <div>
          <Label className="text-xs">Partner banks (free-text legacy)</Label>
          <Input placeholder="SBI, HDFC, ICICI" value={banks.join(', ')} onChange={(e) => onChange('homeLoanBanks', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
        </div>
      </div>
      {(data.homeLoanAssistance as boolean) && (
        <DynamicList
          items={homeLoanPartners}
          onChange={(items) => onChange('homeLoanPartners', items)}
          newItem={() => ({ bankName: 'SBI', partnerType: 'preferred', salariedOk: true, selfEmployedOk: false })}
          addLabel="Add bank partner"
          renderItem={(item, _, update) => (
            <div className="space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Bank</Label>
                  <select className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs" value={(item.bankName as string) || 'SBI'} onChange={(e) => update('bankName', e.target.value)}>
                    {['SBI', 'HDFC', 'ICICI', 'Axis', 'Kotak', 'PNB', 'BOB', 'LIC_HF', 'Bajaj_HF', 'Tata_Cap', 'OTHER'].map((b) => (
                      <option key={b} value={b}>{b.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Partnership type</Label>
                  <select className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs" value={(item.partnerType as string) || 'preferred'} onChange={(e) => update('partnerType', e.target.value)}>
                    <option value="tied_up">Tied-up (referral)</option>
                    <option value="preferred">Preferred</option>
                    <option value="dsa_attached">DSA-attached</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Max tenure (years)</Label>
                  <Input type="number" placeholder="30" value={(item.maxTenureYears as number | undefined) ?? ''} onChange={(e) => update('maxTenureYears', e.target.value === '' ? undefined : Number(e.target.value))} />
                </div>
                <div><Label className="text-xs">ROI min %</Label><Input placeholder="8.5" value={(item.currentRoiMin as string) || ''} onChange={(e) => update('currentRoiMin', e.target.value)} /></div>
                <div><Label className="text-xs">ROI max %</Label><Input placeholder="9.5" value={(item.currentRoiMax as string) || ''} onChange={(e) => update('currentRoiMax', e.target.value)} /></div>
                <div><Label className="text-xs">ROI as-of date</Label><Input type="date" value={(item.roiAsOfDate as string) || ''} onChange={(e) => update('roiAsOfDate', e.target.value)} /></div>
                <div><Label className="text-xs">Processing fee %</Label><Input placeholder="0.5" value={(item.processingFeePct as string) || ''} onChange={(e) => update('processingFeePct', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Switch checked={(item.salariedOk as boolean) ?? true} onCheckedChange={(v) => update('salariedOk', v)} />
                  <Label className="text-xs">Salaried OK</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={(item.selfEmployedOk as boolean) ?? false} onCheckedChange={(v) => update('selfEmployedOk', v)} />
                  <Label className="text-xs">Self-employed OK</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={(item.nriOk as boolean) ?? false} onCheckedChange={(v) => update('nriOk', v)} />
                  <Label className="text-xs">NRI OK</Label>
                </div>
              </div>
            </div>
          )}
        />
      )}

      {/* Staff */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Team / Brokers (each needs RERA)</h3>
      <DynamicList
        items={staffMembers}
        onChange={(items) => onChange('staffMembers', items)}
        newItem={() => ({ id: `s-${Date.now()}`, name: '', role: 'rm', commissionStructure: 'commission_only' })}
        addLabel="Add team member"
        renderItem={(item, _, update) => (
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Name</Label><Input placeholder="Sunita Sharma" value={(item.name as string) || ''} onChange={(e) => update('name', e.target.value)} /></div>
            <div><Label className="text-xs">Their RERA number</Label><Input placeholder="A51900012345" value={(item.agentReraNumber as string) || ''} onChange={(e) => update('agentReraNumber', e.target.value)} /></div>
            <div>
              <Label className="text-xs">Role</Label>
              <select className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs" value={(item.role as string) || 'rm'} onChange={(e) => update('role', e.target.value)}>
                <option value="principal_agent">Principal agent</option>
                <option value="rm">Relationship manager</option>
                <option value="site_visit_executive">Site-visit executive</option>
                <option value="channel_partner">Channel partner</option>
              </select>
            </div>
            <div><Label className="text-xs">Experience (years)</Label><Input type="number" placeholder="5" value={(item.experienceYears as number | undefined) ?? ''} onChange={(e) => update('experienceYears', e.target.value === '' ? undefined : Number(e.target.value))} /></div>
            <div className="col-span-2"><Label className="text-xs">Specialties</Label><Input placeholder="Whitefield 2BHK / NRI / commercial" value={(item.specialties as string) || ''} onChange={(e) => update('specialties', e.target.value)} /></div>
            <div>
              <Label className="text-xs">Commission</Label>
              <select className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs" value={(item.commissionStructure as string) || 'commission_only'} onChange={(e) => update('commissionStructure', e.target.value)}>
                <option value="salary">Salary</option>
                <option value="commission_only">Commission only</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
            <div><Label className="text-xs">WhatsApp</Label><Input placeholder="+91 98765 43210" value={(item.whatsappNumber as string) || ''} onChange={(e) => update('whatsappNumber', e.target.value)} /></div>
          </div>
        )}
      />

      {/* Listings — extended */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <h3 className="text-lg font-semibold">Current Listings</h3>
        <RealEstateListingsBulkImport data={data} onChange={onChange} />
      </div>
      <p className="text-[10px] text-amber-700">⚠️ RERA Act §11: every property advertisement must carry a valid RERA registration number. Add it per listing.</p>
      <DynamicList
        items={listings}
        onChange={(items) => onChange('currentListings', items)}
        newItem={() => ({ title: '', type: '', price: '', area: '', highlights: '', priceBasis: 'carpet' })}
        addLabel="Add Listing"
        renderItem={(item, _, update) => (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label className="text-xs">Title</Label><Input placeholder="3BHK in Dwarka Sector 12" value={(item.title as string) || ''} onChange={(e) => update('title', e.target.value)} /></div>
              <div>
                <Label className="text-xs">Configuration</Label>
                <select className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs" value={(item.configuration as string) || ''} onChange={(e) => update('configuration', e.target.value)}>
                  <option value="">--</option>
                  <option value="1RK">1RK</option>
                  <option value="1BHK">1BHK</option>
                  <option value="2BHK">2BHK</option>
                  <option value="2.5BHK">2.5BHK</option>
                  <option value="3BHK">3BHK</option>
                  <option value="3.5BHK">3.5BHK</option>
                  <option value="4BHK">4BHK</option>
                  <option value="Penthouse">Penthouse</option>
                  <option value="Plot">Plot</option>
                  <option value="Commercial">Commercial</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div><Label className="text-xs">Type</Label><Input placeholder="Apartment" value={(item.type as string) || ''} onChange={(e) => update('type', e.target.value)} /></div>
              <div><Label className="text-xs">Price</Label><Input placeholder="₹1.2 Cr" value={(item.price as string) || ''} onChange={(e) => update('price', e.target.value)} /></div>
              <div><Label className="text-xs">Price per sqft</Label><Input placeholder="₹8,200" value={(item.pricePerSqft as string) || ''} onChange={(e) => update('pricePerSqft', e.target.value)} /></div>
              <div>
                <Label className="text-xs">Price basis (RERA-mandated disclosure)</Label>
                <select className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs" value={(item.priceBasis as string) || 'carpet'} onChange={(e) => update('priceBasis', e.target.value)}>
                  <option value="carpet">Carpet area</option>
                  <option value="rera_carpet">RERA carpet</option>
                  <option value="super_built_up">Super built-up (disclose loading factor)</option>
                </select>
              </div>
              <div><Label className="text-xs">Carpet area (sqft)</Label><Input placeholder="1,150" value={(item.carpetAreaSqft as string) || ''} onChange={(e) => update('carpetAreaSqft', e.target.value)} /></div>
              <div><Label className="text-xs">Built-up area (sqft)</Label><Input placeholder="1,300" value={(item.builtUpAreaSqft as string) || ''} onChange={(e) => update('builtUpAreaSqft', e.target.value)} /></div>
              <div><Label className="text-xs">Super built-up (sqft)</Label><Input placeholder="1,450" value={(item.superBuiltUpAreaSqft as string) || ''} onChange={(e) => update('superBuiltUpAreaSqft', e.target.value)} /></div>
              <div><Label className="text-xs">Loading factor %</Label><Input type="number" placeholder="26" value={(item.loadingFactorPct as number | undefined) ?? ''} onChange={(e) => update('loadingFactorPct', e.target.value === '' ? undefined : Number(e.target.value))} /></div>
              <div><Label className="text-xs">Area (legacy free-text)</Label><Input placeholder="1,450 sqft super" value={(item.area as string) || ''} onChange={(e) => update('area', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Listing RERA number</Label><Input placeholder="P51800012345" value={(item.reraNumber as string) || ''} onChange={(e) => update('reraNumber', e.target.value)} /></div>
              <div><Label className="text-xs">RERA QR URL</Label><Input placeholder="https://maharera..." value={(item.reraQrUrl as string) || ''} onChange={(e) => update('reraQrUrl', e.target.value)} /></div>
              <div><Label className="text-xs">Possession date</Label><Input placeholder="Mar 2026" value={(item.possessionDate as string) || ''} onChange={(e) => update('possessionDate', e.target.value)} /></div>
              <div>
                <Label className="text-xs">OC status</Label>
                <select className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs" value={(item.ocStatus as string) || ''} onChange={(e) => update('ocStatus', e.target.value)}>
                  <option value="">--</option>
                  <option value="received">OC received</option>
                  <option value="applied">Applied</option>
                  <option value="pending">Pending</option>
                  <option value="na_under_construction">Under construction</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">CC status</Label>
                <select className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs" value={(item.ccStatus as string) || ''} onChange={(e) => update('ccStatus', e.target.value)}>
                  <option value="">--</option>
                  <option value="received">Received</option>
                  <option value="partial">Partial</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Khata (Bangalore only)</Label>
                <select className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs" value={(item.khataAOrB as string) || ''} onChange={(e) => update('khataAOrB', e.target.value)}>
                  <option value="">--</option>
                  <option value="A">A-Khata (loans OK)</option>
                  <option value="B">B-Khata (blocks bank loans)</option>
                  <option value="na">N/A (outside BLR)</option>
                </select>
              </div>
              <div><Label className="text-xs">Parking count</Label><Input type="number" placeholder="2" value={(item.parkingCount as number | undefined) ?? ''} onChange={(e) => update('parkingCount', e.target.value === '' ? undefined : Number(e.target.value))} /></div>
              <div>
                <Label className="text-xs">Parking type</Label>
                <select className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs" value={(item.parkingType as string) || ''} onChange={(e) => update('parkingType', e.target.value)}>
                  <option value="">--</option>
                  <option value="covered">Covered</option>
                  <option value="open">Open</option>
                  <option value="mechanical">Mechanical</option>
                  <option value="none">None</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Facing</Label>
                <select className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs" value={(item.facing as string) || ''} onChange={(e) => update('facing', e.target.value)}>
                  <option value="">--</option>
                  {['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'].map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={(item.vastuCompliant as boolean) ?? false} onCheckedChange={(v) => update('vastuCompliant', v)} />
                <Label className="text-xs">Vastu-compliant</Label>
              </div>
              <div><Label className="text-xs">Floor range</Label><Input placeholder="5-10 (out of 22)" value={(item.floorRange as string) || ''} onChange={(e) => update('floorRange', e.target.value)} /></div>
              <div><Label className="text-xs">Units available</Label><Input type="number" placeholder="4" value={(item.unitsAvailable as number | undefined) ?? ''} onChange={(e) => update('unitsAvailable', e.target.value === '' ? undefined : Number(e.target.value))} /></div>
              <div>
                <Label className="text-xs">Furnishing</Label>
                <select className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs" value={(item.furnishingStatus as string) || ''} onChange={(e) => update('furnishingStatus', e.target.value)}>
                  <option value="">--</option>
                  <option value="unfurnished">Unfurnished</option>
                  <option value="semi_furnished">Semi-furnished</option>
                  <option value="fully_furnished">Fully furnished</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Brochure URL</Label><Input placeholder="https://..." value={(item.brochureUrl as string) || ''} onChange={(e) => update('brochureUrl', e.target.value)} /></div>
              <div><Label className="text-xs">Walkthrough video URL</Label><Input placeholder="https://youtu.be/..." value={(item.walkthroughVideoUrl as string) || ''} onChange={(e) => update('walkthroughVideoUrl', e.target.value)} /></div>
            </div>
            <div><Label className="text-xs">Highlights</Label><Input placeholder="Near metro, gated society, OC received" value={(item.highlights as string) || ''} onChange={(e) => update('highlights', e.target.value)} /></div>
          </div>
        )}
      />

      {/* Source attribution */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Listing Source (optional)</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Imported from</Label>
          <select className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" value={(data.importedFromSource as string) || ''} onChange={(e) => onChange('importedFromSource', e.target.value)}>
            <option value="">--</option>
            <option value="99acres">99acres</option>
            <option value="magicbricks">MagicBricks</option>
            <option value="housing">Housing.com</option>
            <option value="nobroker">NoBroker</option>
            <option value="manual">Manual entry</option>
          </select>
        </div>
        <div>
          <Label className="text-xs">Source URL</Label>
          <Input placeholder="https://..." value={(data.importedFromUrl as string) || ''} onChange={(e) => onChange('importedFromUrl', e.target.value)} />
        </div>
      </div>

      {/* Compliance gates */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Compliance Gates</h3>
      <div className="rounded-md border border-red-300 bg-red-50 p-3 space-y-3">
        <p className="text-[10px] text-red-900">
          ⚠️ Real estate is the most regulated vertical. Bot enforces these gates STRICTLY. Disabling them voids your indemnity under our Terms.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={(data.noGuaranteedReturnsClaim as boolean) ?? true} onCheckedChange={(v) => onChange('noGuaranteedReturnsClaim', v)} />
            <Label className="text-xs">Block guaranteed-return / "100% sure" / "definitely double" claims</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={(data.reraQrAutoInjectEnabled as boolean) ?? true} onCheckedChange={(v) => onChange('reraQrAutoInjectEnabled', v)} />
            <Label className="text-xs">Auto-inject RERA QR on every property reply (recommended ON)</Label>
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <Switch checked={(data.blockSendIfReraMissing as boolean) ?? true} onCheckedChange={(v) => onChange('blockSendIfReraMissing', v)} />
            <Label className="text-xs">REFUSE to send replies that mention a listing missing RERA number (strongly recommended)</Label>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Salon Form ───
function SalonForm({ data, onChange }: { data: Record<string, unknown>; onChange: (f: string, v: unknown) => void }) {
  const services = (data.services as Array<Record<string, unknown>>) || [{ category: '', items: [{ name: '', price: '', duration: '' }] }];
  const packages = (data.packages as Array<Record<string, unknown>>) || [{ name: '', includes: '', price: '' }];
  const brands = (data.brands as string[]) || [];
  // Multi-select sub-types — bridal studios commonly add mehendi + party makeup
  const subTypes = (data.subTypes as string[]) || ((data.subType as string) ? [data.subType as string] : []);
  const subType = subTypes[0] || '';
  const setSubTypes = (next: string[]) => {
    onChange('subTypes', next);
    onChange('subType', next[0] || '');
  };
  const staffMembers = (data.staffMembers as Array<Record<string, unknown>>) || [];
  const prepaidPacks = (data.prepaidPacks as Array<Record<string, unknown>>) || [];
  const consentRequired = (data.consentFormRequiredFor as string[]) || [];
  const giftCardOn = (data.giftCardRedeemableOn as string[]) || [];
  const noteFields = (data.privateClientNoteFields as string[]) || [];

  const SUB_TYPES: Array<{ value: string; label: string; emoji: string }> = [
    { value: 'unisex-chain', label: 'Unisex chain (Lakme/Naturals)', emoji: '💇' },
    { value: 'women-only-parlour', label: 'Women-only parlour', emoji: '🚺' },
    { value: 'mens-barber', label: "Men's barber", emoji: '✂️' },
    { value: 'premium-mens-grooming', label: 'Premium men\'s grooming', emoji: '🎩' },
    { value: 'home-service-stylist', label: 'Home-service stylist', emoji: '🏠' },
    { value: 'bridal-makeup-studio', label: 'Bridal makeup studio', emoji: '👰' },
    { value: 'mehendi-studio', label: 'Mehendi studio', emoji: '🖐️' },
    { value: 'party-makeup', label: 'Party makeup', emoji: '💄' },
    { value: 'hair-only', label: 'Hair-only studio', emoji: '💇‍♀️' },
    { value: 'nail-bar', label: 'Nail bar', emoji: '💅' },
    { value: 'tattoo-piercing', label: 'Tattoo + piercing', emoji: '🖋️' },
    { value: 'spa-general', label: 'Spa (general)', emoji: '🧖' },
    { value: 'spa-ayurvedic', label: 'Ayurvedic spa', emoji: '🌿' },
    { value: 'wellness-yoga-reiki', label: 'Wellness (yoga / reiki)', emoji: '🧘' },
    { value: 'kids-salon', label: "Kids' salon", emoji: '🧒' },
    { value: 'threading-express', label: 'Threading express', emoji: '🧵' },
    { value: 'mens-grooming-subscription', label: "Men's grooming subscription", emoji: '🔁' },
  ];

  const isBridal = subTypes.includes('bridal-makeup-studio');
  const isMehendi = subTypes.includes('mehendi-studio');
  const isAyurvedic = subTypes.includes('spa-ayurvedic');
  const isTattoo = subTypes.includes('tattoo-piercing');
  const isHomeService = subTypes.includes('home-service-stylist') || (data.homeServiceAvailable as boolean);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold border-b border-border pb-2">Salon Details</h3>

      {/* Sub-type chooser — MULTI-SELECT (bridal + mehendi + party makeup is common) */}
      <div>
        <Label>What kind of salon? * <span className="text-[10px] text-muted-foreground font-normal">(pick all that apply)</span></Label>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
          {SUB_TYPES.map((st) => {
            const active = subTypes.includes(st.value);
            return (
              <button
                key={st.value}
                type="button"
                onClick={() => {
                  const next = active ? subTypes.filter((s) => s !== st.value) : [...subTypes, st.value];
                  setSubTypes(next);
                }}
                className={`text-left rounded-md border px-3 py-2 text-xs transition-colors ${
                  active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border hover:border-primary/50'
                }`}
              >
                <span className="mr-1">{st.emoji}</span>
                {st.label}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Picks affect bot tone, compliance gates (AYUSH / tattoo), and which extra fields appear below.
          {subTypes.length > 1 && <span className="ml-1 text-[var(--ink)]">{subTypes.length} selected.</span>}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Salon Name *</Label>
          <Input placeholder="Glamour Studio" value={(data.salonName as string) || ''} onChange={(e) => onChange('salonName', e.target.value)} />
        </div>
        <div>
          <Label>Type</Label>
          <div className="flex gap-2 mt-1">
            {['Unisex', 'Women only', 'Men only'].map((g) => (
              <button key={g} type="button" onClick={() => onChange('gender', g)}
                className={`px-3 py-1.5 rounded text-sm border transition-colors ${(data.gender as string) === g ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'}`}>
                {g}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div>
        <Label>Brands Used (comma-separated)</Label>
        <Input placeholder="L'Oreal, Schwarzkopf, Wella" value={brands.join(', ')} onChange={(e) => onChange('brands', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-3">
          <Switch checked={(data.bookingRequired as boolean) ?? true} onCheckedChange={(v) => onChange('bookingRequired', v)} />
          <Label>Booking Required</Label>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={(data.homeServiceAvailable as boolean) ?? false} onCheckedChange={(v) => onChange('homeServiceAvailable', v)} />
          <Label>Home Service</Label>
        </div>
        <div>
          <Label>Home Service Charges</Label>
          <Input placeholder="Rs.200 extra" value={(data.homeServiceCharges as string) || ''} onChange={(e) => onChange('homeServiceCharges', e.target.value)} />
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-border pb-2">
        <h3 className="text-lg font-semibold">Services</h3>
        <SalonServicesBulkImport data={data} onChange={onChange} />
      </div>
      {services.map((cat, catIndex) => (
        <div key={catIndex} className="border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex-1 mr-4">
              <Label>Category (e.g., Hair, Skin, Nails)</Label>
              <Input placeholder="Hair" value={(cat.category as string) || ''} onChange={(e) => {
                const updated = [...services];
                updated[catIndex] = { ...updated[catIndex], category: e.target.value };
                onChange('services', updated);
              }} />
            </div>
            {services.length > 1 && (
              <button type="button" onClick={() => onChange('services', services.filter((_, i) => i !== catIndex))} className="text-muted-foreground hover:text-destructive">x</button>
            )}
          </div>
          <DynamicList
            items={(cat.items as Array<Record<string, string>>) || []}
            onChange={(items) => {
              const updated = [...services];
              updated[catIndex] = { ...updated[catIndex], items };
              onChange('services', updated);
            }}
            newItem={() => ({ name: '', price: '', duration: '' })}
            addLabel="Add Service"
            renderItem={(item, _, update) => (
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Name</Label><Input placeholder="Hair Smoothening" value={item.name} onChange={(e) => update('name', e.target.value)} /></div>
                <div><Label>Price</Label><Input placeholder="Rs.3,500" value={item.price} onChange={(e) => update('price', e.target.value)} /></div>
                <div><Label>Duration</Label><Input placeholder="2-3 hours" value={item.duration} onChange={(e) => update('duration', e.target.value)} /></div>
              </div>
            )}
          />
        </div>
      ))}
      <button type="button" onClick={() => onChange('services', [...services, { category: '', items: [{ name: '', price: '', duration: '' }] }])}
        className="w-full border border-dashed border-border rounded-lg p-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        + Add Service Category
      </button>

      <h3 className="text-lg font-semibold border-b border-border pb-2">Packages</h3>
      <DynamicList
        items={packages}
        onChange={(items) => onChange('packages', items)}
        newItem={() => ({ name: '', includes: '', price: '', packageType: 'regular' })}
        addLabel="Add Package"
        renderItem={(item, _, update) => (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Package Name</Label><Input placeholder="Bridal Package" value={(item.name as string) || ''} onChange={(e) => update('name', e.target.value)} /></div>
              <div><Label>Includes</Label><Input placeholder="Makeup + Hair + Draping" value={(item.includes as string) || ''} onChange={(e) => update('includes', e.target.value)} /></div>
              <div><Label>Price</Label><Input placeholder="Rs.25,000" value={(item.price as string) || ''} onChange={(e) => update('price', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Type</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                  value={(item.packageType as string) || 'regular'}
                  onChange={(e) => update('packageType', e.target.value)}
                >
                  <option value="regular">Regular</option>
                  <option value="bridal">Bridal</option>
                  <option value="party">Party</option>
                  <option value="couple">Couple</option>
                  <option value="sibling_combo">Sibling combo</option>
                  <option value="first_time">First-time offer</option>
                  <option value="monsoon_offer">Monsoon offer</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Duration (hours)</Label>
                <Input type="number" placeholder="3" value={(item.durationHours as number | undefined) ?? ''} onChange={(e) => update('durationHours', e.target.value === '' ? undefined : Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Advance booking days</Label>
                <Input type="number" placeholder="7" value={(item.advanceBookingDays as number | undefined) ?? ''} onChange={(e) => update('advanceBookingDays', e.target.value === '' ? undefined : Number(e.target.value))} />
              </div>
            </div>
          </div>
        )}
      />

      {/* Slot config + walk-ins + peak surcharge */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Booking & Slots</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-2">
          <Switch checked={(data.walkInsAccepted as boolean) ?? true} onCheckedChange={(v) => onChange('walkInsAccepted', v)} />
          <Label className="text-xs">Walk-ins accepted</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.walkInQueueDigital as boolean) ?? false} onCheckedChange={(v) => onChange('walkInQueueDigital', v)} />
          <Label className="text-xs">Digital walk-in queue</Label>
        </div>
        <div>
          <Label className="text-xs">Advance deposit %</Label>
          <Input type="number" placeholder="25" value={(data.advanceDepositPercent as number | undefined) ?? ''} onChange={(e) => onChange('advanceDepositPercent', e.target.value === '' ? undefined : Number(e.target.value))} />
        </div>
        <div>
          <Label className="text-xs">Min advance deposit ₹</Label>
          <Input placeholder="₹500" value={(data.advanceDepositMinAmount as string) || ''} onChange={(e) => onChange('advanceDepositMinAmount', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Weekend slots filled how many days ahead?</Label>
          <Input type="number" placeholder="5" value={(data.weekendsBookedOutDays as number | undefined) ?? ''} onChange={(e) => onChange('weekendsBookedOutDays', e.target.value === '' ? undefined : Number(e.target.value))} />
        </div>
        <div>
          <Label className="text-xs">Weekend uplift %</Label>
          <Input type="number" placeholder="10" value={(data.weekendUpliftPercent as number | undefined) ?? ''} onChange={(e) => onChange('weekendUpliftPercent', e.target.value === '' ? undefined : Number(e.target.value))} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-2">
          <Switch checked={(data.diwaliWeekSurcharge as boolean) ?? false} onCheckedChange={(v) => onChange('diwaliWeekSurcharge', v)} />
          <Label className="text-xs">Diwali-week surcharge</Label>
        </div>
        <div>
          <Label className="text-xs">Wedding-season months</Label>
          <Input placeholder="Oct-Feb" value={(data.weddingSeasonMonths as string) || ''} onChange={(e) => onChange('weddingSeasonMonths', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Women-only hours</Label>
          <Input placeholder="10 AM-2 PM Wed/Fri" value={(data.womenOnlyHours as string) || ''} onChange={(e) => onChange('womenOnlyHours', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Kids-haircut days</Label>
          <Input placeholder="Sundays only" value={(data.kidsHaircutDays as string) || ''} onChange={(e) => onChange('kidsHaircutDays', e.target.value)} />
        </div>
      </div>

      {/* Bridal config */}
      {isBridal && (
        <>
          <h3 className="text-lg font-semibold border-b border-border pb-2">Bridal Package</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={(data.bridalTrialIncluded as boolean) ?? true} onCheckedChange={(v) => onChange('bridalTrialIncluded', v)} />
              <Label className="text-xs">Trial included in price</Label>
            </div>
            <div>
              <Label className="text-xs">Trial min days before wedding</Label>
              <Input type="number" placeholder="30" value={(data.bridalTrialMinDaysBefore as number | undefined) ?? ''} onChange={(e) => onChange('bridalTrialMinDaysBefore', e.target.value === '' ? undefined : Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs">Trial price (if extra)</Label>
              <Input placeholder="₹3,000" value={(data.bridalTrialPrice as string) || ''} onChange={(e) => onChange('bridalTrialPrice', e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={(data.bridalTrialRefundedOnBooking as boolean) ?? false} onCheckedChange={(v) => onChange('bridalTrialRefundedOnBooking', v)} />
              <Label className="text-xs">Trial fee refunded if customer books</Label>
            </div>
          </div>
          <div>
            <Label className="text-xs">Per-event pricing (multi-day weddings)</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-1">
              {[
                { k: 'haldi', l: 'Haldi' },
                { k: 'mehendi', l: 'Mehendi' },
                { k: 'sangeet', l: 'Sangeet' },
                { k: 'wedding', l: 'Wedding (anchor)' },
                { k: 'reception', l: 'Reception' },
                { k: 'cocktail', l: 'Cocktail' },
              ].map((ev) => {
                const ep = (data.bridalEventPricing as Record<string, string>) || {};
                return (
                  <div key={ev.k}>
                    <Label className="text-[10px]">{ev.l}</Label>
                    <Input
                      placeholder="₹15,000"
                      value={ep[ev.k] || ''}
                      onChange={(e) => onChange('bridalEventPricing', { ...ep, [ev.k]: e.target.value })}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Bundle discount %</Label>
              <Input type="number" placeholder="15" value={(data.bridalBundleDiscountPercent as number | undefined) ?? ''} onChange={(e) => onChange('bridalBundleDiscountPercent', e.target.value === '' ? undefined : Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs">Refund cutoff (days before)</Label>
              <Input type="number" placeholder="60" value={(data.bridalRefundCutoffDays as number | undefined) ?? ''} onChange={(e) => onChange('bridalRefundCutoffDays', e.target.value === '' ? undefined : Number(e.target.value))} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={(data.bridalAdvanceRefundable as boolean) ?? false} onCheckedChange={(v) => onChange('bridalAdvanceRefundable', v)} />
              <Label className="text-xs">Advance refundable</Label>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={(data.bridalOutstationAvailable as boolean) ?? false} onCheckedChange={(v) => onChange('bridalOutstationAvailable', v)} />
              <Label className="text-xs">Outstation bridal available</Label>
            </div>
            {(data.bridalOutstationAvailable as boolean) && (
              <>
                <div>
                  <Label className="text-xs">Travel charges per km</Label>
                  <Input placeholder="₹15/km" value={(data.bridalOutstationTravelChargesPerKm as string) || ''} onChange={(e) => onChange('bridalOutstationTravelChargesPerKm', e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Team size</Label>
                  <Input placeholder="2 makeup + 1 hair" value={(data.bridalOutstationTeamSize as string) || ''} onChange={(e) => onChange('bridalOutstationTeamSize', e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={(data.bridalOutstationStaySeparate as boolean) ?? true} onCheckedChange={(v) => onChange('bridalOutstationStaySeparate', v)} />
                  <Label className="text-xs">Stay billed separately</Label>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Mehendi config */}
      {isMehendi && (
        <>
          <h3 className="text-lg font-semibold border-b border-border pb-2">Mehendi Pricing</h3>
          <p className="text-[10px] text-muted-foreground">Indian customers ask precisely about per-pair figures and per-hand guest pricing — bot quotes only what&apos;s set here.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Bridal flat rate</Label>
              <Input
                placeholder="₹15,000"
                value={((data.mehendiConfig as Record<string, unknown>)?.bridalFlatRate as string) || ''}
                onChange={(e) => onChange('mehendiConfig', { ...(data.mehendiConfig as Record<string, unknown>), bridalFlatRate: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Bridal includes</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                value={((data.mehendiConfig as Record<string, unknown>)?.bridalIncludes as string) || ''}
                onChange={(e) => onChange('mehendiConfig', { ...(data.mehendiConfig as Record<string, unknown>), bridalIncludes: e.target.value })}
              >
                <option value="">--</option>
                <option value="hands_only">Hands only</option>
                <option value="hands_feet">Hands + feet</option>
                <option value="hands_feet_arms_elbow">Hands + feet + arms (up to elbow)</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Figures extra (per pair)</Label>
              <Input
                placeholder="₹2,000"
                value={((data.mehendiConfig as Record<string, unknown>)?.figuresExtraPerPair as string) || ''}
                onChange={(e) => onChange('mehendiConfig', { ...(data.mehendiConfig as Record<string, unknown>), figuresExtraPerPair: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Groom mehendi price</Label>
              <Input
                placeholder="₹2,500"
                value={((data.mehendiConfig as Record<string, unknown>)?.groomMehendiPrice as string) || ''}
                onChange={(e) => onChange('mehendiConfig', { ...(data.mehendiConfig as Record<string, unknown>), groomMehendiPrice: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Per-hand guest price</Label>
              <Input
                placeholder="₹150/hand"
                value={((data.mehendiConfig as Record<string, unknown>)?.perHandGuestPrice as string) || ''}
                onChange={(e) => onChange('mehendiConfig', { ...(data.mehendiConfig as Record<string, unknown>), perHandGuestPrice: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Arabic-simple per hand</Label>
              <Input
                placeholder="₹100"
                value={((data.mehendiConfig as Record<string, unknown>)?.arabicSimplePerHand as string) || ''}
                onChange={(e) => onChange('mehendiConfig', { ...(data.mehendiConfig as Record<string, unknown>), arabicSimplePerHand: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Team size options</Label>
              <Input
                placeholder="1, 2, 4, 8 artists"
                value={((data.mehendiConfig as Record<string, unknown>)?.teamSizeOptions as string) || ''}
                onChange={(e) => onChange('mehendiConfig', { ...(data.mehendiConfig as Record<string, unknown>), teamSizeOptions: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Hands per artist per hour</Label>
              <Input
                type="number"
                placeholder="10"
                value={((data.mehendiConfig as Record<string, unknown>)?.handlesPerArtistPerHour as number | undefined) ?? ''}
                onChange={(e) => onChange('mehendiConfig', { ...(data.mehendiConfig as Record<string, unknown>), handlesPerArtistPerHour: e.target.value === '' ? undefined : Number(e.target.value) })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={((data.mehendiConfig as Record<string, unknown>)?.organicHennaOnly as boolean) ?? false}
                onCheckedChange={(v) => onChange('mehendiConfig', { ...(data.mehendiConfig as Record<string, unknown>), organicHennaOnly: v })}
              />
              <Label className="text-xs">Organic henna only</Label>
            </div>
          </div>
        </>
      )}

      {/* Staff with tier pricing */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Staff (senior / junior tiers)</h3>
      <DynamicList
        items={staffMembers}
        onChange={(items) => onChange('staffMembers', items)}
        newItem={() => ({ id: `s-${Date.now()}`, name: '', role: 'senior_stylist', perServiceUpcharge: 0 })}
        addLabel="Add stylist / artist"
        renderItem={(item, _, update) => (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Name</Label><Input placeholder="Priya didi" value={(item.name as string) || ''} onChange={(e) => update('name', e.target.value)} /></div>
              <div>
                <Label className="text-xs">Role</Label>
                <select className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs" value={(item.role as string) || 'senior_stylist'} onChange={(e) => update('role', e.target.value)}>
                  <option value="creative_director">Creative Director</option>
                  <option value="senior_stylist">Senior Stylist</option>
                  <option value="junior_stylist">Junior Stylist</option>
                  <option value="apprentice">Apprentice</option>
                  <option value="specialist">Specialist (color/keratin)</option>
                  <option value="mehendi_artist">Mehendi Artist</option>
                  <option value="makeup_artist">Makeup Artist</option>
                  <option value="tattoo_artist">Tattoo Artist</option>
                  <option value="therapist">Therapist (spa)</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Per-service upcharge ₹</Label>
                <Input type="number" placeholder="500" value={(item.perServiceUpcharge as number | undefined) ?? ''} onChange={(e) => update('perServiceUpcharge', e.target.value === '' ? undefined : Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Experience (years)</Label>
                <Input type="number" placeholder="5" value={(item.experienceYears as number | undefined) ?? ''} onChange={(e) => update('experienceYears', e.target.value === '' ? undefined : Number(e.target.value))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Specialties (comma)</Label>
              <Input placeholder="bridal, color correction, keratin" value={Array.isArray(item.specialties) ? (item.specialties as string[]).join(', ') : ''} onChange={(e) => update('specialties', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
            </div>
          </div>
        )}
      />

      {/* Home service + outstation */}
      {isHomeService && (
        <>
          <h3 className="text-lg font-semibold border-b border-border pb-2">Home Service</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Service radius (km)</Label>
              <Input type="number" placeholder="10" value={(data.homeServiceRadiusKm as number | undefined) ?? ''} onChange={(e) => onChange('homeServiceRadiusKm', e.target.value === '' ? undefined : Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs">Charges per km</Label>
              <Input placeholder="₹10/km" value={(data.homeServiceChargesPerKm as string) || ''} onChange={(e) => onChange('homeServiceChargesPerKm', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Flat home-service charge</Label>
              <Input placeholder="₹200" value={(data.homeServiceFlatCharge as string) || ''} onChange={(e) => onChange('homeServiceFlatCharge', e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={(data.outstationAvailable as boolean) ?? false} onCheckedChange={(v) => onChange('outstationAvailable', v)} />
              <Label className="text-xs">Outstation available</Label>
            </div>
            {(data.outstationAvailable as boolean) && (
              <>
                <div>
                  <Label className="text-xs">Outstation pickup-drop charges</Label>
                  <Input placeholder="₹3,000" value={(data.outstationPickupDropCharges as string) || ''} onChange={(e) => onChange('outstationPickupDropCharges', e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={(data.outstationStayBilledExtra as boolean) ?? true} onCheckedChange={(v) => onChange('outstationStayBilledExtra', v)} />
                  <Label className="text-xs">Stay billed extra</Label>
                </div>
              </>
            )}
            <div className="md:col-span-3">
              <Label className="text-xs">Hygiene SOP (kit sterilisation)</Label>
              <Input placeholder="UV-sterilised tools, single-use razor blades, disposable spatulas" value={(data.kitHygieneSOP as string) || ''} onChange={(e) => onChange('kitHygieneSOP', e.target.value)} />
            </div>
          </div>
        </>
      )}

      {/* Recurring / membership / loyalty */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Memberships & Loyalty</h3>
      <DynamicList
        items={prepaidPacks}
        onChange={(items) => onChange('prepaidPacks', items)}
        newItem={() => ({ name: '', payAmount: '', walletValue: '', validityMonths: 6 })}
        addLabel="Add prepaid pack"
        renderItem={(item, _, update) => (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><Label className="text-xs">Pack name</Label><Input placeholder="Beauty Wallet" value={(item.name as string) || ''} onChange={(e) => update('name', e.target.value)} /></div>
            <div><Label className="text-xs">Pay amount</Label><Input placeholder="₹5,000" value={(item.payAmount as string) || ''} onChange={(e) => update('payAmount', e.target.value)} /></div>
            <div><Label className="text-xs">Wallet value</Label><Input placeholder="₹6,000" value={(item.walletValue as string) || ''} onChange={(e) => update('walletValue', e.target.value)} /></div>
            <div><Label className="text-xs">Validity (months)</Label><Input type="number" placeholder="6" value={(item.validityMonths as number | undefined) ?? ''} onChange={(e) => update('validityMonths', e.target.value === '' ? undefined : Number(e.target.value))} /></div>
          </div>
        )}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Monthly membership fee</Label>
          <Input placeholder="₹1,499/month (unlimited threading)" value={(data.membershipMonthlyFee as string) || ''} onChange={(e) => onChange('membershipMonthlyFee', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Loyalty milestone</Label>
          <Input placeholder="Free haircut on 10th visit" value={(data.loyaltyVisitMilestone as string) || ''} onChange={(e) => onChange('loyaltyVisitMilestone', e.target.value)} />
        </div>
      </div>

      {/* Cancellation + consent */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Cancellation & Consent</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs">Cancel notice (hours before)</Label>
          <Input type="number" placeholder="24" value={(data.cancellationHoursBefore as number | undefined) ?? ''} onChange={(e) => onChange('cancellationHoursBefore', e.target.value === '' ? undefined : Number(e.target.value))} />
        </div>
        <div>
          <Label className="text-xs">Cancellation fee %</Label>
          <Input type="number" placeholder="50" value={(data.cancellationFeePercent as number | undefined) ?? ''} onChange={(e) => onChange('cancellationFeePercent', e.target.value === '' ? undefined : Number(e.target.value))} />
        </div>
        <div>
          <Label className="text-xs">No-show fee</Label>
          <Input placeholder="₹500" value={(data.noShowFee as string) || ''} onChange={(e) => onChange('noShowFee', e.target.value)} />
        </div>
      </div>
      <div>
        <Label className="text-xs">Signed consent required for</Label>
        <div className="flex gap-2 mt-1 flex-wrap">
          {['bridal', 'tattoo', 'piercing', 'chemical', 'extensions'].map((c) => {
            const active = consentRequired.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => {
                  const next = active ? consentRequired.filter((x) => x !== c) : [...consentRequired, c];
                  onChange('consentFormRequiredFor', next);
                }}
                className={`px-2 py-1 rounded text-xs border transition-colors ${
                  active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {/* Gift cards */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Gift Cards (optional)</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-2">
          <Switch checked={(data.giftCardsEnabled as boolean) ?? false} onCheckedChange={(v) => onChange('giftCardsEnabled', v)} />
          <Label className="text-xs">Sell gift cards</Label>
        </div>
        {(data.giftCardsEnabled as boolean) && (
          <>
            <div>
              <Label className="text-xs">Min amount</Label>
              <Input placeholder="₹500" value={(data.giftCardMinAmount as string) || ''} onChange={(e) => onChange('giftCardMinAmount', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Validity (months)</Label>
              <Input type="number" placeholder="12" value={(data.giftCardExpiryMonths as number | undefined) ?? ''} onChange={(e) => onChange('giftCardExpiryMonths', e.target.value === '' ? undefined : Number(e.target.value))} />
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs">Redeemable on</Label>
              <div className="flex gap-2 mt-1">
                {['services', 'products', 'both'].map((o) => {
                  const active = giftCardOn.includes(o);
                  return (
                    <button key={o} type="button" onClick={() => {
                      const next = active ? giftCardOn.filter((x) => x !== o) : [...giftCardOn, o];
                      onChange('giftCardRedeemableOn', next);
                    }} className={`px-2 py-1 rounded text-xs border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'}`}>
                      {o}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Compliance */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Compliance</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">GSTIN (optional)</Label>
          <Input placeholder="29XXXXX1234X1Z5" value={(data.gstin as string) || ''} onChange={(e) => onChange('gstin', e.target.value.toUpperCase())} />
        </div>
        <div>
          <Label className="text-xs">Beautician registration / state licence</Label>
          <Input placeholder="State-issued cosmetology licence #" value={(data.beauticianRegistrationStateLicence as string) || ''} onChange={(e) => onChange('beauticianRegistrationStateLicence', e.target.value)} />
        </div>
      </div>
      {isAyurvedic && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-3">
          <div className="text-xs font-semibold text-amber-900">⚠️ Ayurvedic spa — AYUSH licence required</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={(data.ayushRegistered as boolean) ?? false} onCheckedChange={(v) => onChange('ayushRegistered', v)} />
              <Label className="text-xs">AYUSH-registered</Label>
            </div>
            <div>
              <Label className="text-xs">AYUSH licence number</Label>
              <Input value={(data.ayushLicenceNumber as string) || ''} onChange={(e) => onChange('ayushLicenceNumber', e.target.value)} />
            </div>
          </div>
          <p className="text-[10px] text-amber-800">
            If AYUSH licence is missing, the bot will REFUSE to use words like &quot;cure&quot;, &quot;treatment&quot;, &quot;heal&quot;, &quot;therapy&quot; on WhatsApp (Drugs &amp; Magic Remedies Act compliance).
          </p>
        </div>
      )}
      {isTattoo && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-3">
          <div className="text-xs font-semibold text-amber-900">⚠️ Tattoo / piercing — health licence + age-18 gate</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Health licence number</Label>
              <Input value={(data.tattooStudioHealthLicence as string) || ''} onChange={(e) => onChange('tattooStudioHealthLicence', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Sterilisation SOP</Label>
              <select className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs" value={(data.sterilizationSOP as string) || ''} onChange={(e) => onChange('sterilizationSOP', e.target.value)}>
                <option value="">--</option>
                <option value="autoclave_weekly_spore_test">Autoclave + weekly spore test</option>
                <option value="single_use_only">Single-use only</option>
                <option value="none">None (not recommended)</option>
              </select>
            </div>
          </div>
          <p className="text-[10px] text-amber-800">
            Bot will require age-18+ confirmation and signed consent before booking tattoo or piercing.
          </p>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Switch checked={(data.medicalClaimsAvoided as boolean) ?? true} onCheckedChange={(v) => onChange('medicalClaimsAvoided', v)} />
        <Label className="text-xs">Bot must avoid medical / therapeutic claims (recommended ON)</Label>
      </div>

      {/* Private client notes */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Private Client Notes (optional)</h3>
      <div className="flex items-center gap-2">
        <Switch checked={(data.privateClientNotesEnabled as boolean) ?? false} onCheckedChange={(v) => onChange('privateClientNotesEnabled', v)} />
        <Label className="text-xs">Enable per-client private notes (allergies, do-not-book, etc.)</Label>
      </div>
      {(data.privateClientNotesEnabled as boolean) && (
        <div>
          <Label className="text-xs">What to track</Label>
          <div className="flex gap-2 mt-1 flex-wrap">
            {['allergies', 'preferred_stylist', 'do_not_book', 'past_disputes'].map((f) => {
              const active = noteFields.includes(f);
              return (
                <button key={f} type="button" onClick={() => {
                  const next = active ? noteFields.filter((x) => x !== f) : [...noteFields, f];
                  onChange('privateClientNoteFields', next);
                }} className={`px-2 py-1 rounded text-xs border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'}`}>
                  {f.replace('_', ' ')}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Bot will NEVER share these in customer chat. Auto-purged after 30 days (DPDPA).</p>
        </div>
      )}
    </div>
  );
}

// ─── D2C Form ───
function D2CForm({ data, onChange }: { data: Record<string, unknown>; onChange: (f: string, v: unknown) => void }) {
  const products = (data.products as Array<Record<string, unknown>>) || [{ name: '', price: '', description: '', bestseller: false }];
  const paymentMethods = (data.paymentMethods as string[]) || ['Cash on Delivery'];

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold border-b border-border pb-2">Brand Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Brand Name *</Label>
          <Input placeholder="GlowUp Skincare" value={(data.brandName as string) || ''} onChange={(e) => onChange('brandName', e.target.value)} />
        </div>
        <div>
          <Label>Product Category *</Label>
          <Input placeholder="Skincare / Fashion / Food" value={(data.productCategory as string) || ''} onChange={(e) => onChange('productCategory', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Website URL</Label>
          <Input placeholder="https://glowup.in" value={(data.websiteUrl as string) || ''} onChange={(e) => onChange('websiteUrl', e.target.value)} />
        </div>
        <div>
          <Label>Instagram Handle</Label>
          <Input placeholder="@glowup.skincare" value={(data.instagramHandle as string) || ''} onChange={(e) => onChange('instagramHandle', e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Shipping Policy</Label>
        <Input placeholder="Free delivery above Rs.499, 3-5 days" value={(data.shippingPolicy as string) || ''} onChange={(e) => onChange('shippingPolicy', e.target.value)} />
      </div>
      <div>
        <Label>Return Policy</Label>
        <Input placeholder="7-day easy returns, no questions asked" value={(data.returnPolicy as string) || ''} onChange={(e) => onChange('returnPolicy', e.target.value)} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-3">
          <Switch checked={(data.codAvailable as boolean) ?? true} onCheckedChange={(v) => onChange('codAvailable', v)} />
          <Label>COD Available</Label>
        </div>
        <div className="col-span-2">
          <Label>Payment Methods <span className="text-[10px] uppercase tracking-wide text-amber-700 ml-1">COD only</span></Label>
          <Input value="Cash on Delivery" disabled readOnly />
          <p className="text-[10px] text-muted-foreground mt-1">Online payments roll out in a future release.</p>
        </div>
      </div>
      <div>
        <Label>Current Offers</Label>
        <Input placeholder="Buy 2 Get 1 Free on all serums" value={(data.currentOffers as string) || ''} onChange={(e) => onChange('currentOffers', e.target.value)} />
      </div>
      <div>
        <Label>Order Tracking Process</Label>
        <Input placeholder="Share order ID, we'll send tracking link" value={(data.orderTrackingProcess as string) || ''} onChange={(e) => onChange('orderTrackingProcess', e.target.value)} />
      </div>

      <h3 className="text-lg font-semibold border-b border-border pb-2">Products</h3>
      <DynamicList
        items={products}
        onChange={(items) => onChange('products', items)}
        newItem={() => ({ name: '', price: '', description: '', bestseller: false })}
        addLabel="Add Product"
        renderItem={(item, _, update) => (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Product Name</Label><Input placeholder="Vitamin C Serum" value={(item.name as string) || ''} onChange={(e) => update('name', e.target.value)} /></div>
              <div><Label>Price</Label><Input placeholder="Rs.599" value={(item.price as string) || ''} onChange={(e) => update('price', e.target.value)} /></div>
            </div>
            <div><Label>Description</Label><Input placeholder="Brightening serum with 20% Vitamin C" value={(item.description as string) || ''} onChange={(e) => update('description', e.target.value)} /></div>
            <div>
              <Label>Image URL (optional)</Label>
              <Input placeholder="https://i.imgur.com/abc.jpg" value={(item.imageUrl as string) || ''} onChange={(e) => update('imageUrl', e.target.value)} />
              <p className="text-[10px] text-muted-foreground mt-1">Upload to imgur.com or similar, paste public URL here</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={(item.bestseller as boolean) ?? false} onCheckedChange={(v) => update('bestseller', v)} />
              <Label>Bestseller</Label>
            </div>
          </div>
        )}
      />
    </div>
  );
}

// ─── Gym Form ───
function GymForm({ data, onChange }: { data: Record<string, unknown>; onChange: (f: string, v: unknown) => void }) {
  const plans = (data.membershipPlans as Array<Record<string, unknown>>) || [{ name: '', duration: '', price: '', includes: '' }];
  const facilities = (data.facilities as string[]) || [];
  const classes = (data.groupClasses as string[]) || [];
  const pt = (data.personalTraining as Record<string, unknown>) || { available: false, pricePerSession: '', trainerInfo: '' };
  // Multi-select sub-types — many studios run yoga + pilates, gym + functional, etc.
  const subTypes = (data.subTypes as string[]) || ((data.subType as string) ? [data.subType as string] : []);
  const subType = subTypes[0] || '';
  const setSubTypes = (next: string[]) => {
    onChange('subTypes', next);
    onChange('subType', next[0] || '');
  };
  const trainers = (data.trainers as Array<Record<string, unknown>>) || [];
  const corporatePartners = (data.corporatePartners as Array<Record<string, unknown>>) || [];
  const aggregators = (data.aggregatorPartners as string[]) || [];
  const programs = (data.programs as Array<Record<string, unknown>>) || [];
  const medClearance = (data.medicalClearanceRequired as string[]) || [];

  const SUB_TYPES: Array<{ value: string; label: string; emoji: string }> = [
    { value: 'full-service-chain', label: 'Full-service chain (Gold\'s/Anytime)', emoji: '🏢' },
    { value: 'neighbourhood-gym', label: 'Neighbourhood gym', emoji: '🏋️' },
    { value: 'women-only', label: 'Women-only (Pink Fitness)', emoji: '🚺' },
    { value: 'crossfit-box', label: 'CrossFit box', emoji: '🤸' },
    { value: 'yoga-hatha-ashtanga', label: 'Yoga (Hatha/Ashtanga)', emoji: '🧘' },
    { value: 'yoga-power-vinyasa', label: 'Power yoga / Vinyasa', emoji: '🧘‍♀️' },
    { value: 'iyengar-lineage', label: 'Iyengar yoga', emoji: '🪷' },
    { value: 'pilates-reformer', label: 'Pilates reformer', emoji: '🤽' },
    { value: 'zumba-dance-fitness', label: 'Zumba / dance fitness', emoji: '💃' },
    { value: 'mma-boxing', label: 'MMA / boxing', emoji: '🥊' },
    { value: 'kickboxing', label: 'Kickboxing', emoji: '🦵' },
    { value: 'kalaripayattu', label: 'Kalaripayattu', emoji: '⚔️' },
    { value: 'multi-sport-academy', label: 'Multi-sport academy', emoji: '🏆' },
    { value: 'kids-academy', label: 'Kids\' academy', emoji: '🧒' },
    { value: 'senior-yoga', label: 'Senior yoga', emoji: '🧓' },
    { value: 'prenatal-postnatal', label: 'Prenatal / postnatal', emoji: '🤰' },
    { value: 'ems-studio', label: 'EMS studio (Tecfit20)', emoji: '⚡' },
    { value: 'calisthenics-park', label: 'Calisthenics park', emoji: '💪' },
    { value: 'functional-studio', label: 'Functional studio (Cult-type)', emoji: '🏃' },
    { value: 'online-coach', label: 'Online coach', emoji: '💻' },
  ];

  const isEMS = subTypes.includes('ems-studio');
  const isWomenOnly = subTypes.includes('women-only');
  const isPrenatal = subTypes.includes('prenatal-postnatal');
  const isSeniorOrKids = subTypes.includes('senior-yoga') || subTypes.includes('kids-academy');
  const isHighIntensity = subTypes.some((s) => ['crossfit-box', 'mma-boxing', 'kickboxing', 'ems-studio'].includes(s));

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold border-b border-border pb-2">Gym Details</h3>

      {/* Sub-type chooser — MULTI-SELECT (yoga + pilates, gym + functional, etc.) */}
      <div>
        <Label>What kind of fitness studio? * <span className="text-[10px] text-muted-foreground font-normal">(pick all that apply)</span></Label>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
          {SUB_TYPES.map((st) => {
            const active = subTypes.includes(st.value);
            return (
              <button
                key={st.value}
                type="button"
                onClick={() => {
                  const next = active ? subTypes.filter((s) => s !== st.value) : [...subTypes, st.value];
                  setSubTypes(next);
                }}
                className={`text-left rounded-md border px-3 py-2 text-xs transition-colors ${
                  active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border hover:border-primary/50'
                }`}
              >
                <span className="mr-1">{st.emoji}</span>
                {st.label}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Picks affect bot tone, EMS hard-block, and which medical-clearance flags appear.
          {subTypes.length > 1 && <span className="ml-1 text-[var(--ink)]">{subTypes.length} selected.</span>}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Gym Name *</Label>
          <Input placeholder="Iron Paradise Gym" value={(data.gymName as string) || ''} onChange={(e) => onChange('gymName', e.target.value)} />
        </div>
        <div>
          <Label>Timings *</Label>
          <Input placeholder="5 AM - 11 PM, 365 days" value={(data.timings as string) || ''} onChange={(e) => onChange('timings', e.target.value)} />
        </div>
      </div>

      {/* Registration fee — separate from monthly */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Registration Fee (one-time)</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs">Amount</Label>
          <Input placeholder="₹500-2,500" value={(data.registrationFeeAmount as string) || ''} onChange={(e) => onChange('registrationFeeAmount', e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.registrationFeeRefundable as boolean) ?? false} onCheckedChange={(v) => onChange('registrationFeeRefundable', v)} />
          <Label className="text-xs">Refundable</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.registrationFeeWaivedInPromo as boolean) ?? false} onCheckedChange={(v) => onChange('registrationFeeWaivedInPromo', v)} />
          <Label className="text-xs">Waived in promo offers</Label>
        </div>
        <div className="md:col-span-3">
          <Label className="text-xs">Notes</Label>
          <Input placeholder="Includes access card, biometric registration" value={(data.registrationFeeNotes as string) || ''} onChange={(e) => onChange('registrationFeeNotes', e.target.value)} />
        </div>
      </div>

      <div>
        <Label>Facilities (comma-separated)</Label>
        <Input placeholder="Cardio Zone, Weight Training, Steam Bath, Locker Room" value={facilities.join(', ')} onChange={(e) => onChange('facilities', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        {[
          { k: 'hasGymFloor', l: 'Gym floor' },
          { k: 'hasCardioZone', l: 'Cardio zone' },
          { k: 'hasFreeWeights', l: 'Free weights' },
          { k: 'hasTurf', l: 'Turf' },
          { k: 'hasPool', l: 'Pool' },
          { k: 'hasSteam', l: 'Steam' },
          { k: 'hasSauna', l: 'Sauna' },
          { k: 'hasShower', l: 'Shower' },
          { k: 'hasLocker', l: 'Locker' },
          { k: 'hasWifi', l: 'WiFi' },
          { k: 'hasCafe', l: 'Cafe' },
          { k: 'hasParkingFree', l: 'Free parking' },
          { k: 'hasParkingPaid', l: 'Paid parking' },
          { k: 'hasKidsPlayArea', l: 'Kids play area' },
          { k: 'hasPhysioRoom', l: 'Physio room' },
          { k: 'hasRecoveryZone', l: 'Recovery zone' },
        ].map((f) => (
          <div key={f.k} className="flex items-center gap-2">
            <Switch checked={(data[f.k] as boolean) ?? false} onCheckedChange={(v) => onChange(f.k, v)} />
            <Label className="text-xs">{f.l}</Label>
          </div>
        ))}
      </div>

      <div>
        <Label>Group Classes (comma-separated)</Label>
        <Input placeholder="Yoga, Zumba, CrossFit, Boxing" value={classes.join(', ')} onChange={(e) => onChange('groupClasses', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Class booking window (hours ahead)</Label>
          <Input type="number" placeholder="48" value={(data.classBookingWindowHours as number | undefined) ?? ''} onChange={(e) => onChange('classBookingWindowHours', e.target.value === '' ? undefined : Number(e.target.value))} />
        </div>
        <div>
          <Label className="text-xs">Drop-in price (single class)</Label>
          <Input placeholder="₹400" value={(data.classDropInPriceRupees as string) || ''} onChange={(e) => onChange('classDropInPriceRupees', e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.classWaitlistEnabled as boolean) ?? true} onCheckedChange={(v) => onChange('classWaitlistEnabled', v)} />
          <Label className="text-xs">Waitlist enabled when class full</Label>
        </div>
      </div>

      {/* Personal training */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Personal Training</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-3">
          <Switch checked={(pt.available as boolean) ?? false} onCheckedChange={(v) => onChange('personalTraining', { ...pt, available: v })} />
          <Label>Available</Label>
        </div>
        <div>
          <Label>Default price/session</Label>
          <Input placeholder="₹500-1,500" value={(pt.pricePerSession as string) || ''} onChange={(e) => onChange('personalTraining', { ...pt, pricePerSession: e.target.value })} />
        </div>
        <div>
          <Label>Trainer info (legacy free-text)</Label>
          <Input placeholder="Certified, 5+ years" value={(pt.trainerInfo as string) || ''} onChange={(e) => onChange('personalTraining', { ...pt, trainerInfo: e.target.value })} />
        </div>
      </div>
      <DynamicList
        items={trainers}
        onChange={(items) => onChange('trainers', items)}
        newItem={() => ({ id: `t-${Date.now()}`, name: '', certifications: [], specialisations: [] })}
        addLabel="Add trainer"
        renderItem={(item, _, update) => {
          const certs = (item.certifications as string[]) || [];
          return (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Name</Label><Input placeholder="Rohit Sharma" value={(item.name as string) || ''} onChange={(e) => update('name', e.target.value)} /></div>
                <div>
                  <Label className="text-xs">Gender</Label>
                  <select className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs" value={(item.gender as string) || ''} onChange={(e) => update('gender', e.target.value)}>
                    <option value="">--</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="NB">Non-binary</option>
                  </select>
                </div>
                <div><Label className="text-xs">Experience (years)</Label><Input type="number" placeholder="6" value={(item.experienceYears as number | undefined) ?? ''} onChange={(e) => update('experienceYears', e.target.value === '' ? undefined : Number(e.target.value))} /></div>
                <div><Label className="text-xs">Price per session</Label><Input placeholder="₹800" value={(item.pricePerSessionRupees as string) || ''} onChange={(e) => update('pricePerSessionRupees', e.target.value)} /></div>
                <div><Label className="text-xs">Package sessions</Label><Input type="number" placeholder="12" value={(item.packageSessions as number | undefined) ?? ''} onChange={(e) => update('packageSessions', e.target.value === '' ? undefined : Number(e.target.value))} /></div>
                <div><Label className="text-xs">Package price</Label><Input placeholder="₹8,000" value={(item.packagePriceRupees as string) || ''} onChange={(e) => update('packagePriceRupees', e.target.value)} /></div>
              </div>
              <div>
                <Label className="text-xs">Certifications</Label>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {['ACE', 'NASM', 'REPS_India', 'K11', 'CrossFit_L1', 'CrossFit_L2', 'Yoga_Alliance_RYT200', 'Yoga_Alliance_RYT500', 'Stott_Pilates', 'Polestar_Pilates', 'Zumba_ZIN', 'NSDC_SFSSC', 'ISSA', 'Other'].map((c) => {
                    const active = certs.includes(c);
                    return (
                      <button key={c} type="button" onClick={() => {
                        const next = active ? certs.filter((x) => x !== c) : [...certs, c];
                        update('certifications', next);
                      }} className={`px-1.5 py-1 rounded text-[10px] border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'}`}>
                        {c.replace(/_/g, ' ')}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label className="text-xs">Specialisations (comma)</Label>
                <Input placeholder="weight loss, prenatal, sports-specific" value={Array.isArray(item.specialisations) ? (item.specialisations as string[]).join(', ') : ''} onChange={(e) => update('specialisations', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={(item.femaleOnly as boolean) ?? false} onCheckedChange={(v) => update('femaleOnly', v)} />
                <Label className="text-xs">Trains female clients only</Label>
              </div>
            </div>
          );
        }}
      />

      {/* Trial */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Trial Offer</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-3">
          <Switch checked={(data.trialAvailable as boolean) ?? true} onCheckedChange={(v) => onChange('trialAvailable', v)} />
          <Label className="text-xs">Trial available</Label>
        </div>
        <div>
          <Label className="text-xs">Trial type</Label>
          <select className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" value={(data.trialType as string) || 'free'} onChange={(e) => onChange('trialType', e.target.value)}>
            <option value="free">Free</option>
            <option value="paid">Paid</option>
            <option value="open_day">Open day</option>
          </select>
        </div>
        {(data.trialType as string) === 'paid' && (
          <div>
            <Label className="text-xs">Paid trial price</Label>
            <Input placeholder="₹199" value={(data.trialPaidPriceRupees as string) || ''} onChange={(e) => onChange('trialPaidPriceRupees', e.target.value)} />
          </div>
        )}
        <div>
          <Label className="text-xs">Trial → paid conversion discount %</Label>
          <Input type="number" placeholder="20" value={(data.trialConvertedDiscountPercent as number | undefined) ?? ''} onChange={(e) => onChange('trialConvertedDiscountPercent', e.target.value === '' ? undefined : Number(e.target.value))} />
        </div>
        <div className="md:col-span-3">
          <Label className="text-xs">Trial details</Label>
          <Input placeholder="3-day free trial, no card required" value={(data.trialDetails as string) || ''} onChange={(e) => onChange('trialDetails', e.target.value)} />
        </div>
      </div>

      {/* Membership plans (extended) */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <h3 className="text-lg font-semibold">Membership Plans</h3>
        <GymPlansBulkImport data={data} onChange={onChange} />
      </div>
      <DynamicList
        items={plans}
        onChange={(items) => onChange('membershipPlans', items)}
        newItem={() => ({ name: '', duration: '', price: '', includes: '', peakAccess: true })}
        addLabel="Add Plan"
        renderItem={(item, _, update) => (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Plan Name</Label><Input placeholder="Monthly" value={(item.name as string) || ''} onChange={(e) => update('name', e.target.value)} /></div>
              <div><Label className="text-xs">Duration label</Label><Input placeholder="1 month / 3 months / annual" value={(item.duration as string) || ''} onChange={(e) => update('duration', e.target.value)} /></div>
              <div><Label className="text-xs">Duration (months)</Label><Input type="number" placeholder="1" value={(item.durationMonths as number | undefined) ?? ''} onChange={(e) => update('durationMonths', e.target.value === '' ? undefined : Number(e.target.value))} /></div>
              <div><Label className="text-xs">Price</Label><Input placeholder="₹2,000" value={(item.price as string) || ''} onChange={(e) => update('price', e.target.value)} /></div>
            </div>
            <div><Label className="text-xs">Includes</Label><Input placeholder="Gym access + 1 class/day" value={(item.includes as string) || ''} onChange={(e) => update('includes', e.target.value)} /></div>
            <div><Label className="text-xs">Excludes</Label><Input placeholder="No PT included" value={(item.excludes as string) || ''} onChange={(e) => update('excludes', e.target.value)} /></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={(item.isCouple as boolean) ?? false} onCheckedChange={(v) => update('isCouple', v)} />
                <Label className="text-xs">Couple</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={(item.isFamily as boolean) ?? false} onCheckedChange={(v) => update('isFamily', v)} />
                <Label className="text-xs">Family</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={(item.peakAccess as boolean) ?? true} onCheckedChange={(v) => update('peakAccess', v)} />
                <Label className="text-xs">Peak access</Label>
              </div>
              <div>
                <Label className="text-xs">Off-peak window</Label>
                <Input placeholder="11 AM-4 PM" value={(item.offPeakWindow as string) || ''} onChange={(e) => update('offPeakWindow', e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Accessible locations</Label>
              <select className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs" value={(item.accessibleLocations as string) || 'home_only'} onChange={(e) => update('accessibleLocations', e.target.value)}>
                <option value="home_only">Home gym only</option>
                <option value="all_branches">All branches</option>
                <option value="city">City-wide</option>
                <option value="national">National</option>
              </select>
            </div>
          </div>
        )}
      />

      {/* Freeze policy */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Freeze / Pause Policy</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-2">
          <Switch checked={(data.freezePolicyEnabled as boolean) ?? false} onCheckedChange={(v) => onChange('freezePolicyEnabled', v)} />
          <Label className="text-xs">Allow membership freeze</Label>
        </div>
        {(data.freezePolicyEnabled as boolean) && (
          <>
            <div>
              <Label className="text-xs">Max days/cycle (Cult: 60)</Label>
              <Input type="number" placeholder="60" value={(data.freezeMaxDaysPerCycle as number | undefined) ?? ''} onChange={(e) => onChange('freezeMaxDaysPerCycle', e.target.value === '' ? undefined : Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs">Min plan duration (months)</Label>
              <Input type="number" placeholder="3" value={(data.freezeMinPlanDurationMonths as number | undefined) ?? ''} onChange={(e) => onChange('freezeMinPlanDurationMonths', e.target.value === '' ? undefined : Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs">Advance notice (days)</Label>
              <Input type="number" placeholder="3" value={(data.freezeAdvanceNoticeDays as number | undefined) ?? ''} onChange={(e) => onChange('freezeAdvanceNoticeDays', e.target.value === '' ? undefined : Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs">Freeze fee</Label>
              <Input placeholder="₹0 / ₹500" value={(data.freezeFeeRupees as string) || ''} onChange={(e) => onChange('freezeFeeRupees', e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={(data.freezeMedicalUnlimited as boolean) ?? true} onCheckedChange={(v) => onChange('freezeMedicalUnlimited', v)} />
              <Label className="text-xs">Unlimited freeze with medical cert</Label>
            </div>
          </>
        )}
      </div>

      {/* Discounts + corporate + aggregators */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Discounts & Partners</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs">Couple discount %</Label>
          <Input type="number" placeholder="10" value={(data.couplePercent as number | undefined) ?? ''} onChange={(e) => onChange('couplePercent', e.target.value === '' ? undefined : Number(e.target.value))} />
        </div>
        <div>
          <Label className="text-xs">Family discount %</Label>
          <Input type="number" placeholder="15" value={(data.familyPercent as number | undefined) ?? ''} onChange={(e) => onChange('familyPercent', e.target.value === '' ? undefined : Number(e.target.value))} />
        </div>
        <div>
          <Label className="text-xs">Referral reward</Label>
          <Input placeholder="₹500 wallet credit" value={(data.referralRupees as string) || ''} onChange={(e) => onChange('referralRupees', e.target.value)} />
        </div>
      </div>
      <div>
        <Label className="text-xs">Corporate partners (TCS / Infosys / Wipro etc.)</Label>
        <DynamicList
          items={corporatePartners}
          onChange={(items) => onChange('corporatePartners', items)}
          newItem={() => ({ employer: '', discountPercent: 10, verificationRequired: 'email_domain' })}
          addLabel="Add corporate partner"
          renderItem={(item, _, update) => (
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">Employer</Label><Input placeholder="TCS" value={(item.employer as string) || ''} onChange={(e) => update('employer', e.target.value)} /></div>
              <div><Label className="text-xs">Discount %</Label><Input type="number" placeholder="20" value={(item.discountPercent as number | undefined) ?? ''} onChange={(e) => update('discountPercent', e.target.value === '' ? undefined : Number(e.target.value))} /></div>
              <div>
                <Label className="text-xs">Verification</Label>
                <select className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs" value={(item.verificationRequired as string) || 'email_domain'} onChange={(e) => update('verificationRequired', e.target.value)}>
                  <option value="email_domain">Email domain</option>
                  <option value="id_card">ID card photo</option>
                  <option value="manual">Manual approval</option>
                </select>
              </div>
            </div>
          )}
        />
      </div>
      <div>
        <Label className="text-xs">Aggregator partners</Label>
        <div className="flex gap-2 mt-1 flex-wrap">
          {['FITPASS', 'Cultpass', 'OnePass', 'ClassPass'].map((a) => {
            const active = aggregators.includes(a);
            return (
              <button key={a} type="button" onClick={() => {
                const next = active ? aggregators.filter((x) => x !== a) : [...aggregators, a];
                onChange('aggregatorPartners', next);
              }} className={`px-2 py-1 rounded text-xs border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'}`}>
                {a}
              </button>
            );
          })}
        </div>
      </div>

      {/* Programs */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Programs (Transformation / Marathon prep)</h3>
      <p className="text-[10px] text-amber-700">⚠️ WhatsApp policy: NO outcome guarantees ("lose 10kg in 30 days" is prohibited).</p>
      <DynamicList
        items={programs}
        onChange={(items) => onChange('programs', items)}
        newItem={() => ({ name: '', durationDays: 90, priceRupees: '', cohortBased: false, outcomeDisclaimerShown: true })}
        addLabel="Add program"
        renderItem={(item, _, update) => (
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Program name</Label><Input placeholder="90-Day Transformation" value={(item.name as string) || ''} onChange={(e) => update('name', e.target.value)} /></div>
            <div><Label className="text-xs">Duration (days)</Label><Input type="number" placeholder="90" value={(item.durationDays as number | undefined) ?? ''} onChange={(e) => update('durationDays', e.target.value === '' ? undefined : Number(e.target.value))} /></div>
            <div><Label className="text-xs">Price</Label><Input placeholder="₹15,000" value={(item.priceRupees as string) || ''} onChange={(e) => update('priceRupees', e.target.value)} /></div>
            <div><Label className="text-xs">Next start date</Label><Input type="date" value={(item.nextStartDate as string) || ''} onChange={(e) => update('nextStartDate', e.target.value)} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={(item.cohortBased as boolean) ?? false} onCheckedChange={(v) => update('cohortBased', v)} />
              <Label className="text-xs">Cohort-based</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={(item.medicalAssessmentIncluded as boolean) ?? false} onCheckedChange={(v) => update('medicalAssessmentIncluded', v)} />
              <Label className="text-xs">Medical assessment included</Label>
            </div>
          </div>
        )}
      />

      {/* Day pass */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Day Pass / Guests</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Day pass price</Label>
          <Input placeholder="₹500" value={(data.dayPassPriceRupees as string) || ''} onChange={(e) => onChange('dayPassPriceRupees', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Guest policy</Label>
          <select className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" value={(data.guestPolicy as string) || ''} onChange={(e) => onChange('guestPolicy', e.target.value)}>
            <option value="">--</option>
            <option value="allowed_paid">Guests allowed (paid day-pass)</option>
            <option value="allowed_free_once">Guests allowed (free, once per member)</option>
            <option value="not_allowed">Guests not allowed</option>
          </select>
        </div>
      </div>

      {/* Add-ons */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Add-ons</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Locker rental</Label>
          <Input placeholder="₹500/month" value={(data.lockerRentalRupees as string) || ''} onChange={(e) => onChange('lockerRentalRupees', e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.towelService as boolean) ?? false} onCheckedChange={(v) => onChange('towelService', v)} />
          <Label className="text-xs">Towel service</Label>
        </div>
        <div>
          <Label className="text-xs">Diet plan price</Label>
          <Input placeholder="₹2,000" value={(data.dietPlanRupees as string) || ''} onChange={(e) => onChange('dietPlanRupees', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Body composition scan</Label>
          <Input placeholder="₹500" value={(data.bodyCompositionScanRupees as string) || ''} onChange={(e) => onChange('bodyCompositionScanRupees', e.target.value)} />
        </div>
      </div>

      {/* Audience flags */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Audience</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="flex items-center gap-2">
          <Switch checked={(data.womenOnly as boolean) ?? isWomenOnly} onCheckedChange={(v) => onChange('womenOnly', v)} />
          <Label className="text-xs">Women only</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.prenatalAvailable as boolean) ?? isPrenatal} onCheckedChange={(v) => onChange('prenatalAvailable', v)} />
          <Label className="text-xs">Prenatal classes</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.seniorAvailable as boolean) ?? false} onCheckedChange={(v) => onChange('seniorAvailable', v)} />
          <Label className="text-xs">Senior classes</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.kidsAvailable as boolean) ?? false} onCheckedChange={(v) => onChange('kidsAvailable', v)} />
          <Label className="text-xs">Kids classes</Label>
        </div>
        <div>
          <Label className="text-xs">Women-only timings</Label>
          <Input placeholder="10 AM-2 PM Wed/Fri" value={(data.womenOnlyTimings as string) || ''} onChange={(e) => onChange('womenOnlyTimings', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Kids age groups</Label>
          <Input placeholder="6-12, 13-17" value={(data.kidsAgeGroups as string) || ''} onChange={(e) => onChange('kidsAgeGroups', e.target.value)} />
        </div>
      </div>

      {/* EMS-specific gate */}
      {isEMS && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-3">
          <div className="text-xs font-semibold text-amber-900">⚠️ EMS Studio — pacemaker hard-block</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">EMS suit one-time fee</Label>
              <Input placeholder="₹2,000" value={(data.emsSuitFeeOneTimeRupees as string) || ''} onChange={(e) => onChange('emsSuitFeeOneTimeRupees', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Max sessions per week</Label>
              <Input type="number" placeholder="2" value={(data.emsMaxSessionsPerWeek as number | undefined) ?? ''} onChange={(e) => onChange('emsMaxSessionsPerWeek', e.target.value === '' ? undefined : Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs">Session duration (min)</Label>
              <Input type="number" placeholder="20" value={(data.emsSessionDurationMin as number | undefined) ?? ''} onChange={(e) => onChange('emsSessionDurationMin', e.target.value === '' ? undefined : Number(e.target.value))} />
            </div>
          </div>
          <p className="text-[10px] text-amber-800">
            ⚠️ Bot will REFUSE to book EMS sessions for customers with pacemakers / heart conditions / pregnancy / epilepsy. This is a hard-coded medical safety rule.
          </p>
        </div>
      )}

      {/* Compliance */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Compliance</h3>
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-3">
        <p className="text-[10px] text-amber-900">
          ⚠️ Diet plan + supplement queries are sensitive. Bot will refuse to recommend supplements (Meta Commerce Policy block on whey/BCAA/creatine) and require disclaimers on diet advice.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Liability waiver URL</Label>
            <Input placeholder="https://your-gym.com/waiver.pdf" value={(data.liabilityWaiverUrl as string) || ''} onChange={(e) => onChange('liabilityWaiverUrl', e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={(data.preExistingConditionDisclaimer as boolean) ?? isHighIntensity} onCheckedChange={(v) => onChange('preExistingConditionDisclaimer', v)} />
            <Label className="text-xs">Pre-existing condition disclaimer shown to all signups</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={(data.dietDisclaimerShown as boolean) ?? true} onCheckedChange={(v) => onChange('dietDisclaimerShown', v)} />
            <Label className="text-xs">Diet plan disclaimer shown (mandatory if dietPlan offered)</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={(data.noOutcomeGuaranteeClaim as boolean) ?? true} onCheckedChange={(v) => onChange('noOutcomeGuaranteeClaim', v)} />
            <Label className="text-xs">No outcome-guarantee claims (recommended ON)</Label>
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Medical clearance required for</Label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {['prenatal', 'senior', 'ems', 'crossfit', 'mma'].map((c) => {
                const active = medClearance.includes(c);
                return (
                  <button key={c} type="button" onClick={() => {
                    const next = active ? medClearance.filter((x) => x !== c) : [...medClearance, c];
                    onChange('medicalClearanceRequired', next);
                  }} className={`px-2 py-1 rounded text-xs border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'}`}>
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">GSTIN (optional)</Label>
            <Input placeholder="29XXXXX1234X1Z5" value={(data.gstin as string) || ''} onChange={(e) => onChange('gstin', e.target.value.toUpperCase())} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Equipment list (free-text)</Label>
            <Input placeholder="TechnoGym, Hammer Strength, Concept2 rower" value={(data.equipmentList as string) || ''} onChange={(e) => onChange('equipmentList', e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tiffin Form ───
function TiffinForm({ data, onChange }: { data: Record<string, unknown>; onChange: (f: string, v: unknown) => void }) {
  // Tiffin plans now carry a mix of strings (name, mealType, foodType,
  // includes), numbers (rotiCount, sabziCount), and booleans (riceIncluded
  // etc.). Use Record<string, unknown> so the form can store all three
  // without the casts in renderItem fighting TypeScript.
  const plans = (data.plans as Array<Record<string, unknown>>) || [{ name: '', duration: '', price: '', includes: '', mealType: 'lunch', foodType: 'veg' }];
  const mealsServed = (data.mealsServed as string[]) || ['lunch'];
  const deliveryAreas = (data.deliveryAreas as string[]) || [];
  const paymentMethods = (data.paymentMethods as string[]) || ['Cash on Delivery'];
  // Multi-select sub-types — most tiffins overlap (home-cook + Jain-only,
  // corporate B2B + executive lunch, etc.)
  const subTypes = (data.subTypes as string[]) || ((data.subType as string) ? [data.subType as string] : []);
  const setSubTypes = (next: string[]) => {
    onChange('subTypes', next);
    onChange('subType', next[0] || '');
  };

  const TIFFIN_SUB_TYPES: Array<{ value: string; label: string; emoji: string }> = [
    { value: 'home-kitchen-aunty', label: 'Home-kitchen aunty', emoji: '🏠' },
    { value: 'organised-dabbawala', label: 'Organised dabbawala-linked', emoji: '🍱' },
    { value: 'corporate-b2b', label: 'Corporate B2B', emoji: '🏢' },
    { value: 'pg-mess-contractor', label: 'PG / mess contractor', emoji: '🛏️' },
    { value: 'gym-diet-meal', label: 'Gym / diet meal', emoji: '💪' },
    { value: 'jain-only', label: 'Jain-only', emoji: '🟡' },
    { value: 'satvik-no-onion-garlic', label: 'Satvik (no onion/garlic)', emoji: '🌿' },
    { value: 'regional-maharashtrian', label: 'Regional: Maharashtrian', emoji: '🌶️' },
    { value: 'regional-gujarati', label: 'Regional: Gujarati', emoji: '🥘' },
    { value: 'regional-south-indian', label: 'Regional: South Indian', emoji: '🍛' },
    { value: 'regional-bengali', label: 'Regional: Bengali', emoji: '🐟' },
    { value: 'keto-diabetic', label: 'Keto / diabetic / post-pregnancy', emoji: '🥗' },
    { value: 'executive-lunch', label: 'Executive lunch (₹200+)', emoji: '🍽️' },
    { value: 'multi-kitchen-aggregator', label: 'Multi-kitchen aggregator', emoji: '🌐' },
    { value: 'pickup-only', label: 'Pickup-only', emoji: '🛍️' },
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold border-b border-border pb-2">Tiffin Service Details</h3>

      {/* Sub-type chooser — MULTI-SELECT */}
      <div>
        <Label>What kind of tiffin service? * <span className="text-[10px] text-muted-foreground font-normal">(pick all that apply)</span></Label>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
          {TIFFIN_SUB_TYPES.map((st) => {
            const active = subTypes.includes(st.value);
            return (
              <button
                key={st.value}
                type="button"
                onClick={() => {
                  const next = active ? subTypes.filter((s) => s !== st.value) : [...subTypes, st.value];
                  setSubTypes(next);
                }}
                className={`text-left rounded-md border px-3 py-2 text-xs transition-colors ${
                  active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border hover:border-primary/50'
                }`}
              >
                <span className="mr-1">{st.emoji}</span>
                {st.label}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Picks affect bot tone and which dietary fields appear below.
          {subTypes.length > 1 && <span className="ml-1 text-[var(--ink)]">{subTypes.length} selected.</span>}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Service Name *</Label>
          <Input placeholder="Sharma Tiffin Centre" value={(data.serviceName as string) || ''} onChange={(e) => onChange('serviceName', e.target.value)} />
        </div>
        <div>
          <Label>Cuisine Style *</Label>
          <Input placeholder="Punjabi home-style / South Indian / Gujarati" value={(data.cuisineStyle as string) || ''} onChange={(e) => onChange('cuisineStyle', e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Meals Served (comma-separated)</Label>
        <Input placeholder="lunch, dinner" value={mealsServed.join(', ')} onChange={(e) => onChange('mealsServed', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
        <p className="text-[10px] text-muted-foreground mt-1">Common values: lunch, dinner, breakfast</p>
      </div>
      <div>
        <Label>Weekly Menu (rotation)</Label>
        <Textarea placeholder="Mon: Rajma-Chawal&#10;Tue: Aloo-Paratha&#10;Wed: Chole-Bhature..." value={(data.weeklyMenu as string) || ''} onChange={(e) => onChange('weeklyMenu', e.target.value)} rows={5} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center gap-3">
          <Switch checked={(data.trialAvailable as boolean) ?? true} onCheckedChange={(v) => onChange('trialAvailable', v)} />
          <Label>Trial Available</Label>
        </div>
        <div>
          <Label>Trial Details</Label>
          <Input placeholder="First tiffin free / 50% off first day" value={(data.trialDetails as string) || ''} onChange={(e) => onChange('trialDetails', e.target.value)} />
        </div>
      </div>

      <h3 className="text-lg font-semibold border-b border-border pb-2">Delivery</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center gap-3">
          <Switch checked={(data.deliveryAvailable as boolean) ?? true} onCheckedChange={(v) => onChange('deliveryAvailable', v)} />
          <Label>Delivery Available</Label>
        </div>
        <div>
          <Label>Delivery Charges</Label>
          <Input placeholder="Rs.20 per tiffin / Free above Rs.500" value={(data.deliveryCharges as string) || ''} onChange={(e) => onChange('deliveryCharges', e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Delivery Areas (comma-separated)</Label>
        <Input placeholder="Andheri E, Goregaon W, Powai" value={deliveryAreas.join(', ')} onChange={(e) => onChange('deliveryAreas', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
      </div>
      <div>
        <Label>Delivery Timings</Label>
        <Input placeholder="Lunch: 12-2 PM, Dinner: 8-10 PM" value={(data.deliveryTimings as string) || ''} onChange={(e) => onChange('deliveryTimings', e.target.value)} />
      </div>

      <h3 className="text-lg font-semibold border-b border-border pb-2">Customization & Payment</h3>
      <div className="flex items-center gap-3">
        <Switch checked={(data.customRequestsAllowed as boolean) ?? true} onCheckedChange={(v) => onChange('customRequestsAllowed', v)} />
        <Label>Custom Requests Allowed (no-onion / no-garlic / Jain / less-spicy)</Label>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Payment Cycle</Label>
          <Input placeholder="weekly / monthly / advance" value={(data.paymentCycle as string) || ''} onChange={(e) => onChange('paymentCycle', e.target.value)} />
        </div>
        <div>
          <Label>Payment Methods <span className="text-[10px] uppercase tracking-wide text-amber-700 ml-1">COD only</span></Label>
          <Input value="Cash on Delivery" disabled readOnly />
          <p className="text-[10px] text-muted-foreground mt-1">Online payments roll out in a future release.</p>
        </div>
      </div>
      <div>
        <Label>Holidays / Off-Days</Label>
        <Input placeholder="Sunday off / Diwali week closed" value={(data.holidaysClosed as string) || ''} onChange={(e) => onChange('holidaysClosed', e.target.value)} />
      </div>

      {/* ─── Kitchen + dietary basics (top WhatsApp questions) ─── */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Kitchen &amp; Dietary</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Owner type</Label>
          <div className="flex gap-1 mt-1 flex-wrap">
            {[
              { v: 'home-cook', l: 'Home cook' },
              { v: 'commercial-kitchen', l: 'Commercial kitchen' },
              { v: 'cloud-kitchen', l: 'Cloud kitchen' },
              { v: 'mess-contractor', l: 'Mess / PG' },
              { v: 'aggregator', l: 'Aggregator' },
            ].map((o) => {
              const active = (data.ownerType as string) === o.v;
              return (
                <button key={o.v} type="button" onClick={() => onChange('ownerType', o.v)}
                  className={`px-2 py-1 rounded text-[10px] border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'}`}>
                  {o.l}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <Label>Cooking oil used</Label>
          <div className="flex gap-1 mt-1 flex-wrap">
            {[
              { v: 'refined', l: 'Refined' },
              { v: 'filtered-groundnut', l: 'Filtered groundnut' },
              { v: 'mustard', l: 'Mustard' },
              { v: 'sunflower', l: 'Sunflower' },
              { v: 'olive', l: 'Olive' },
              { v: 'mixed', l: 'Mixed' },
            ].map((o) => {
              const active = (data.oilType as string) === o.v;
              return (
                <button key={o.v} type="button" onClick={() => onChange('oilType', o.v)}
                  className={`px-2 py-1 rounded text-[10px] border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'}`}>
                  {o.l}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <Label>Ghee used</Label>
          <div className="flex gap-1 mt-1 flex-wrap">
            {[
              { v: 'none', l: 'None' },
              { v: 'desi-cow-ghee', l: 'Desi cow ghee' },
              { v: 'buffalo-ghee', l: 'Buffalo ghee' },
              { v: 'vanaspati', l: 'Vanaspati' },
              { v: 'occasional', l: 'Occasional' },
            ].map((o) => {
              const active = (data.gheeUsed as string) === o.v;
              return (
                <button key={o.v} type="button" onClick={() => onChange('gheeUsed', o.v)}
                  className={`px-2 py-1 rounded text-[10px] border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'}`}>
                  {o.l}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div>
        <Label>Egg policy (when does egg appear in non-veg dabba?)</Label>
        <div className="flex gap-1 mt-1 flex-wrap">
          {[
            { v: 'never', l: 'Never (pure veg)' },
            { v: 'on-request', l: 'On request only' },
            { v: 'sunday-only', l: 'Sunday only' },
            { v: 'twice-weekly', l: 'Twice weekly' },
            { v: 'always', l: 'Always (in non-veg)' },
          ].map((o) => {
            const active = (data.eggInclusionOption as string) === o.v;
            return (
              <button key={o.v} type="button" onClick={() => onChange('eggInclusionOption', o.v)}
                className={`px-2 py-1 rounded text-xs border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'}`}>
                {o.l}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="flex items-center gap-2">
          <Switch checked={(data.jainAvailable as boolean) ?? false} onCheckedChange={(v) => onChange('jainAvailable', v)} />
          <Label className="text-xs">Jain plans</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.noOnionGarlicAvailable as boolean) ?? false} onCheckedChange={(v) => onChange('noOnionGarlicAvailable', v)} />
          <Label className="text-xs">No-onion-garlic</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.diabeticPlanAvailable as boolean) ?? false} onCheckedChange={(v) => onChange('diabeticPlanAvailable', v)} />
          <Label className="text-xs">Diabetic plan</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.postPregnancyPlanAvailable as boolean) ?? false} onCheckedChange={(v) => onChange('postPregnancyPlanAvailable', v)} />
          <Label className="text-xs">Post-pregnancy plan</Label>
        </div>
      </div>

      {/* ─── FSSAI compliance ─── */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Compliance</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>FSSAI License Number</Label>
          <Input
            placeholder="14-digit FSSAI number"
            value={(data.fssaiNumber as string) || ''}
            onChange={(e) => onChange('fssaiNumber', e.target.value.replace(/\D/g, '').slice(0, 14))}
            inputMode="numeric"
          />
          <p className="text-[10px] text-muted-foreground mt-1">Mandatory for any food business in India.</p>
        </div>
        <div>
          <Label>FSSAI License Type</Label>
          <div className="flex gap-2 mt-1 flex-wrap">
            {[
              { v: 'basic-registration', l: 'Basic (₹100/yr, < ₹12L)' },
              { v: 'state-license', l: 'State (₹12L-₹20Cr)' },
              { v: 'central-license', l: 'Central (> ₹20Cr)' },
            ].map((o) => {
              const active = (data.fssaiType as string) === o.v;
              return (
                <button key={o.v} type="button" onClick={() => onChange('fssaiType', o.v)}
                  className={`px-2 py-1 rounded text-[10px] border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'}`}>
                  {o.l}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Subscription operations (skip / cutoff / handoff) ─── */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Subscription Operations</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Order cutoff for next day</Label>
          <Input
            placeholder="9:00 PM previous day"
            value={(data.advanceBookingCutoff as string) || ''}
            onChange={(e) => onChange('advanceBookingCutoff', e.target.value)}
          />
          <p className="text-[10px] text-muted-foreground mt-1">Bot rejects new orders past this time.</p>
        </div>
        <div>
          <Label>Where do you hand off the dabba?</Label>
          <div className="flex gap-1 mt-1 flex-wrap">
            {[
              { v: 'door', l: 'Door' },
              { v: 'gate', l: 'Gate' },
              { v: 'pg-reception', l: 'PG reception' },
              { v: 'office-desk', l: 'Office desk' },
              { v: 'flexible', l: 'Flexible' },
            ].map((o) => {
              const active = (data.deliveryHandoffPoint as string) === o.v;
              return (
                <button key={o.v} type="button" onClick={() => onChange('deliveryHandoffPoint', o.v)}
                  className={`px-2 py-1 rounded text-[10px] border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'}`}>
                  {o.l}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div>
        <Label>If subscriber skips a tiffin</Label>
        <div className="flex gap-1 mt-1 flex-wrap">
          {[
            { v: 'prorated-refund', l: 'Prorated refund' },
            { v: 'rolled-over-to-next', l: 'Rolled over to next' },
            { v: 'forfeit', l: 'Forfeit (no refund)' },
            { v: 'wallet-credit', l: 'Wallet credit' },
          ].map((o) => {
            const active = (data.skipBillingPolicy as string) === o.v;
            return (
              <button key={o.v} type="button" onClick={() => onChange('skipBillingPolicy', o.v)}
                className={`px-2 py-1 rounded text-xs border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'}`}>
                {o.l}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Max skips per cycle</Label>
          <Input
            type="number"
            placeholder="4"
            value={(data.maxSkipsPerCycle as number | undefined) ?? ''}
            onChange={(e) => onChange('maxSkipsPerCycle', e.target.value === '' ? undefined : Number(e.target.value))}
          />
        </div>
        <div>
          <Label>Daily capacity (max tiffins)</Label>
          <Input
            type="number"
            placeholder="50"
            value={(data.capacityPerDay as number | undefined) ?? ''}
            onChange={(e) => onChange('capacityPerDay', e.target.value === '' ? undefined : Number(e.target.value))}
          />
          <p className="text-[10px] text-muted-foreground mt-1">Bot refuses new subscriptions past this.</p>
        </div>
        <div className="flex items-center gap-2 pt-6">
          <Switch checked={(data.midCyclePlanSwitchAllowed as boolean) ?? false} onCheckedChange={(v) => onChange('midCyclePlanSwitchAllowed', v)} />
          <Label className="text-xs">Allow mid-cycle plan switch</Label>
        </div>
      </div>

      {/* ─── Container (tiffin box) ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-3">
          <Label>Container type</Label>
          <div className="flex gap-1 mt-1 flex-wrap">
            {[
              { v: 'disposable-bio', l: 'Disposable (bio)' },
              { v: 'disposable-plastic', l: 'Disposable plastic' },
              { v: 'steel-return', l: 'Steel (return next day)' },
              { v: 'multi-tier-tiffin', l: 'Multi-tier tiffin' },
              { v: 'customer-supplied', l: 'Customer supplies' },
            ].map((o) => {
              const active = (data.containerType as string) === o.v;
              return (
                <button key={o.v} type="button" onClick={() => onChange('containerType', o.v)}
                  className={`px-2 py-1 rounded text-[10px] border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'}`}>
                  {o.l}
                </button>
              );
            })}
          </div>
        </div>
        {(data.containerType === 'steel-return' || data.containerType === 'multi-tier-tiffin') && (
          <>
            <div>
              <Label>Container deposit</Label>
              <Input placeholder="₹200" value={(data.containerDeposit as string) || ''} onChange={(e) => onChange('containerDeposit', e.target.value)} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={(data.containerDepositRefundable as boolean) ?? true} onCheckedChange={(v) => onChange('containerDepositRefundable', v)} />
              <Label className="text-xs">Deposit refundable</Label>
            </div>
          </>
        )}
      </div>

      {/* ─── Guest dabba ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-2">
          <Switch checked={(data.guestDabbaSameDayAllowed as boolean) ?? false} onCheckedChange={(v) => onChange('guestDabbaSameDayAllowed', v)} />
          <Label className="text-xs">Same-day guest dabba</Label>
        </div>
        {(data.guestDabbaSameDayAllowed as boolean) && (
          <>
            <div>
              <Label>Cutoff (hours before delivery)</Label>
              <Input
                type="number"
                placeholder="3"
                value={(data.guestDabbaCutoffHours as number | undefined) ?? ''}
                onChange={(e) => onChange('guestDabbaCutoffHours', e.target.value === '' ? undefined : Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Guest dabba price</Label>
              <Input placeholder="₹150" value={(data.guestDabbaPrice as string) || ''} onChange={(e) => onChange('guestDabbaPrice', e.target.value)} />
            </div>
          </>
        )}
      </div>

      <div>
        <Label>Festival overrides (Navratri / Shravan / Paryushan)</Label>
        <Textarea
          placeholder={'Navratri: only satvik menu, no onion-garlic, kuttu/sabudana available\nShravan: Mon/Thu pure veg only'}
          rows={2}
          value={(data.festivalOverrides as string) || ''}
          onChange={(e) => onChange('festivalOverrides', e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between border-b border-border pb-2">
        <h3 className="text-lg font-semibold">Subscription Plans</h3>
        <TiffinPlansBulkImport data={data} onChange={onChange} />
      </div>
      <DynamicList
        items={plans}
        onChange={(items) => onChange('plans', items)}
        newItem={() => ({ name: '', duration: '', price: '', includes: '', mealType: 'lunch', foodType: 'veg' })}
        addLabel="Add Plan"
        renderItem={(item, _, update) => (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Plan Name</Label><Input placeholder="Monthly Lunch" value={(item.name as string) || ''} onChange={(e) => update('name', e.target.value)} /></div>
              <div><Label>Duration</Label><Input placeholder="30 tiffins / 1 month" value={(item.duration as string) || ''} onChange={(e) => update('duration', e.target.value)} /></div>
              <div><Label>Price</Label><Input placeholder="Rs.2,500" value={(item.price as string) || ''} onChange={(e) => update('price', e.target.value)} /></div>
              <div><Label>Meal Type</Label><Input placeholder="lunch / dinner / both" value={(item.mealType as string) || ''} onChange={(e) => update('mealType', e.target.value)} /></div>
              <div><Label>Food Type</Label><Input placeholder="veg / non-veg / jain / egg-included" value={(item.foodType as string) || ''} onChange={(e) => update('foodType', e.target.value)} /></div>
            </div>
            <div><Label>Includes (free-text)</Label><Input placeholder="4 chapati + 1 sabzi + 1 dal + rice + salad" value={(item.includes as string) || ''} onChange={(e) => update('includes', e.target.value)} /></div>
            {/* Structured carb/protein composition — distinguishes plans
                that differ ONLY by rotis/rice */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-border">
              <div>
                <Label className="text-xs">Roti count</Label>
                <Input
                  type="number"
                  placeholder="4"
                  value={(item.rotiCount as number | undefined) ?? ''}
                  onChange={(e) => update('rotiCount', e.target.value === '' ? undefined : Number(e.target.value))}
                />
              </div>
              <div>
                <Label className="text-xs">Roti type</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                  value={(item.rotiType as string) || ''}
                  onChange={(e) => update('rotiType', e.target.value)}
                >
                  <option value="">--</option>
                  <option value="wheat-chapati">Wheat chapati</option>
                  <option value="jowar-bhakri">Jowar bhakri</option>
                  <option value="bajra">Bajra</option>
                  <option value="phulka">Phulka</option>
                  <option value="paratha">Paratha</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Sabzi count</Label>
                <Input
                  type="number"
                  placeholder="1"
                  value={(item.sabziCount as number | undefined) ?? ''}
                  onChange={(e) => update('sabziCount', e.target.value === '' ? undefined : Number(e.target.value))}
                />
              </div>
              <div>
                <Label className="text-xs">Portion size</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                  value={(item.portionSize as string) || ''}
                  onChange={(e) => update('portionSize', e.target.value)}
                >
                  <option value="">--</option>
                  <option value="mini">Mini</option>
                  <option value="regular">Regular</option>
                  <option value="big-belly">Big belly</option>
                  <option value="executive">Executive</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={(item.riceIncluded as boolean) ?? false} onCheckedChange={(v) => update('riceIncluded', v)} />
                <Label className="text-xs">Rice included</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={(item.dalIncluded as boolean) ?? true} onCheckedChange={(v) => update('dalIncluded', v)} />
                <Label className="text-xs">Dal included</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={(item.saladPickleIncluded as boolean) ?? false} onCheckedChange={(v) => update('saladPickleIncluded', v)} />
                <Label className="text-xs">Salad / pickle</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={(item.drinkingWaterIncluded as boolean) ?? false} onCheckedChange={(v) => update('drinkingWaterIncluded', v)} />
                <Label className="text-xs">Drinking water</Label>
              </div>
            </div>
          </div>
        )}
      />
    </div>
  );
}

// ─── Ecommerce Form ───
function EcommerceForm({ data, onChange }: { data: Record<string, unknown>; onChange: (f: string, v: unknown) => void }) {
  const products = (data.products as Array<Record<string, unknown>>) || [{ name: '', price: '', description: '', category: '', bestseller: false, inStock: true }];
  const categories = (data.productCategories as string[]) || [];
  const paymentMethods = (data.paymentMethods as string[]) || ['Cash on Delivery'];
  // Multi-select sub-types — most stores cover fashion + accessories, beauty + gifting, etc.
  const subTypes = (data.subTypes as string[]) || ((data.subType as string) ? [data.subType as string] : []);
  const setSubTypes = (next: string[]) => {
    onChange('subTypes', next);
    onChange('subType', next[0] || '');
  };
  const marketplacePresence = (data.marketplacePresence as Array<Record<string, unknown>>) || [];
  const warehouses = (data.warehouses as Array<Record<string, unknown>>) || [];
  const discountCodes = (data.discountCodes as Array<Record<string, unknown>>) || [];
  const subscriptionIntervals = (data.subscriptionIntervals as string[]) || [];
  const courierPartners = (data.courierPartners as string[]) || [];
  const returnReasons = (data.returnReasonsAccepted as string[]) || ['damaged', 'defective', 'wrong_product', 'size_issue'];

  const SUB_TYPES: Array<{ value: string; label: string; emoji: string }> = [
    { value: 'fashion-d2c', label: 'Fashion D2C', emoji: '👕' },
    { value: 'saree-kurta-ethnic', label: 'Saree / kurta / ethnic', emoji: '🥻' },
    { value: 'beauty-skincare-d2c', label: 'Beauty / skincare D2C', emoji: '💄' },
    { value: 'gold-silver-jewellery', label: 'Gold / silver jewellery (BIS HUID)', emoji: '💎' },
    { value: 'imitation-jewellery', label: 'Imitation jewellery', emoji: '📿' },
    { value: 'home-decor', label: 'Home decor', emoji: '🛋️' },
    { value: 'electronics-reseller', label: 'Electronics reseller', emoji: '📱' },
    { value: 'books-stationery', label: 'Books / stationery', emoji: '📚' },
    { value: 'kids-toys-clothing', label: 'Kids toys + clothing', emoji: '🧸' },
    { value: 'packaged-food', label: 'Packaged food (FSSAI)', emoji: '🍫' },
    { value: 'gifting-hampers', label: 'Gifting / hampers', emoji: '🎁' },
    { value: 'custom-print-on-demand', label: 'Custom-print on demand', emoji: '🖨️' },
    { value: 'handloom-handicraft-gi', label: 'Handloom / GI-tagged', emoji: '🧵' },
    { value: 'instagram-only-seller', label: 'Instagram-only seller', emoji: '📸' },
    { value: 'shopify-store', label: 'Shopify / WooCommerce', emoji: '🛒' },
    { value: 'subscription-box', label: 'Subscription box', emoji: '🔁' },
    { value: 'b2b-wholesale-only', label: 'B2B / wholesale-only', emoji: '📦' },
    { value: 'dropshipper-multi-marketplace', label: 'Dropshipper / multi-marketplace', emoji: '🌐' },
  ];

  const isJewellery = subTypes.includes('gold-silver-jewellery');
  const isPackagedFood = subTypes.includes('packaged-food');
  const isB2B = subTypes.includes('b2b-wholesale-only');
  const isHandloomGI = subTypes.includes('handloom-handicraft-gi');
  const isCustomPrint = subTypes.includes('custom-print-on-demand');
  const isSubscription = subTypes.includes('subscription-box');
  const storefrontType = (data.storefrontType as string) || '';

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold border-b border-border pb-2">Shop Details</h3>

      {/* Sub-type chooser — MULTI-SELECT */}
      <div>
        <Label>What kind of online shop? * <span className="text-[10px] text-muted-foreground font-normal">(pick all that apply)</span></Label>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
          {SUB_TYPES.map((st) => {
            const active = subTypes.includes(st.value);
            return (
              <button
                key={st.value}
                type="button"
                onClick={() => {
                  const next = active ? subTypes.filter((s) => s !== st.value) : [...subTypes, st.value];
                  setSubTypes(next);
                }}
                className={`text-left rounded-md border px-3 py-2 text-xs transition-colors ${
                  active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border hover:border-primary/50'
                }`}
              >
                <span className="mr-1">{st.emoji}</span>
                {st.label}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Picks affect compliance gates (BIS HUID for jewellery, FSSAI for food, GI Act for handloom) and which extra fields appear below.
          {subTypes.length > 1 && <span className="ml-1 text-[var(--ink)]">{subTypes.length} selected.</span>}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Shop Name *</Label>
          <Input placeholder="Trendy Threads" value={(data.shopName as string) || ''} onChange={(e) => onChange('shopName', e.target.value)} />
        </div>
        <div>
          <Label>GST Number (mandatory regardless of turnover — TCS rule)</Label>
          <Input placeholder="07AABCU9603R1ZX" value={(data.gstNumber as string) || ''} onChange={(e) => onChange('gstNumber', e.target.value.toUpperCase())} />
        </div>
        <div>
          <Label>PAN</Label>
          <Input placeholder="ABCDE1234F" value={(data.panNumber as string) || ''} onChange={(e) => onChange('panNumber', e.target.value.toUpperCase())} />
        </div>
        <div>
          <Label>Storefront type</Label>
          <select className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" value={storefrontType} onChange={(e) => onChange('storefrontType', e.target.value)}>
            <option value="">--</option>
            <option value="shopify">Shopify</option>
            <option value="woocommerce">WooCommerce</option>
            <option value="dukaan">Dukaan</option>
            <option value="mydukaan">Mydukaan</option>
            <option value="instagram_only">Instagram only (DM orders)</option>
            <option value="meesho_reseller">Meesho reseller</option>
            <option value="multi_marketplace">Multi-marketplace</option>
            <option value="none">None — direct only</option>
          </select>
        </div>
      </div>
      {storefrontType === 'shopify' && (
        <div>
          <Label>Shopify domain</Label>
          <Input placeholder="my-shop.myshopify.com" value={(data.shopifyDomain as string) || ''} onChange={(e) => onChange('shopifyDomain', e.target.value)} />
        </div>
      )}
      {storefrontType === 'instagram_only' && (
        <div className="flex items-center gap-2">
          <Switch checked={(data.acceptsDmOrders as boolean) ?? true} onCheckedChange={(v) => onChange('acceptsDmOrders', v)} />
          <Label className="text-xs">Accept orders via Instagram DM</Label>
        </div>
      )}
      <div>
        <Label>Product Categories (comma-separated)</Label>
        <Input
          placeholder="Men's clothing, Women's clothing, Kids, Accessories"
          value={categories.join(', ')}
          onChange={(e) => onChange('productCategories', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
        />
        <p className="text-[10px] text-muted-foreground mt-1">List the main categories you sell across</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Website URL</Label>
          <Input placeholder="https://shop.example.com" value={(data.websiteUrl as string) || ''} onChange={(e) => onChange('websiteUrl', e.target.value)} />
        </div>
        <div>
          <Label>Instagram Handle</Label>
          <Input placeholder="@your.shop" value={(data.instagramHandle as string) || ''} onChange={(e) => onChange('instagramHandle', e.target.value)} />
        </div>
      </div>

      {/* Marketplace presence */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Marketplace Presence</h3>
      <DynamicList
        items={marketplacePresence}
        onChange={(items) => onChange('marketplacePresence', items)}
        newItem={() => ({ channel: 'amazon', sellerUrl: '' })}
        addLabel="Add marketplace"
        renderItem={(item, _, update) => (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Channel</Label>
              <select className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs" value={(item.channel as string) || 'amazon'} onChange={(e) => update('channel', e.target.value)}>
                {['amazon', 'flipkart', 'meesho', 'myntra', 'ajio', 'nykaa', 'jiomart', 'snapdeal', 'firstcry', 'tatacliq'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2"><Label className="text-xs">Seller URL</Label><Input placeholder="https://amazon.in/dp/..." value={(item.sellerUrl as string) || ''} onChange={(e) => update('sellerUrl', e.target.value)} /></div>
            <div className="flex items-center gap-2 md:col-span-3">
              <Switch checked={(item.priceVariesByChannel as boolean) ?? false} onCheckedChange={(v) => update('priceVariesByChannel', v)} />
              <Label className="text-xs">Price varies on this channel (different from direct)</Label>
            </div>
          </div>
        )}
      />

      {/* Warehouses */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Warehouses</h3>
      <DynamicList
        items={warehouses}
        onChange={(items) => onChange('warehouses', items)}
        newItem={() => ({ id: `w-${Date.now()}`, name: '', pincode: '', city: '' })}
        addLabel="Add warehouse"
        renderItem={(item, _, update) => (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><Label className="text-xs">Warehouse name</Label><Input placeholder="Mumbai HQ" value={(item.name as string) || ''} onChange={(e) => update('name', e.target.value)} /></div>
            <div><Label className="text-xs">Pincode</Label><Input placeholder="400001" value={(item.pincode as string) || ''} onChange={(e) => update('pincode', e.target.value)} /></div>
            <div><Label className="text-xs">City</Label><Input placeholder="Mumbai" value={(item.city as string) || ''} onChange={(e) => update('city', e.target.value)} /></div>
            <div className="col-span-2 md:col-span-4"><Label className="text-xs">Serves pincodes (comma)</Label><Input placeholder="400001-400099, 411001" value={(item.servesPincodes as string) || ''} onChange={(e) => update('servesPincodes', e.target.value)} /></div>
          </div>
        )}
      />

      <h3 className="text-lg font-semibold border-b border-border pb-2">Shipping & Delivery</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Shipping Charges</Label>
          <Input placeholder="Rs.49 flat / Free above Rs.999" value={(data.shippingCharges as string) || ''} onChange={(e) => onChange('shippingCharges', e.target.value)} />
        </div>
        <div>
          <Label>Free Shipping Above</Label>
          <Input placeholder="Rs.999" value={(data.freeShippingAbove as string) || ''} onChange={(e) => onChange('freeShippingAbove', e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Shipping Policy</Label>
        <Input placeholder="3-5 business days, dispatched within 24 hours" value={(data.shippingPolicy as string) || ''} onChange={(e) => onChange('shippingPolicy', e.target.value)} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Serviceable Areas</Label>
          <Input placeholder="All India / 25,000+ pincodes / Delhi NCR only" value={(data.serviceableAreas as string) || ''} onChange={(e) => onChange('serviceableAreas', e.target.value)} />
        </div>
        <div>
          <Label>Delivery Timeline</Label>
          <Input placeholder="2-5 business days" value={(data.deliveryTimeline as string) || ''} onChange={(e) => onChange('deliveryTimeline', e.target.value)} />
        </div>
      </div>

      <h3 className="text-lg font-semibold border-b border-border pb-2">Payment & Returns</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-3">
          <Switch checked={(data.codAvailable as boolean) ?? true} onCheckedChange={(v) => onChange('codAvailable', v)} />
          <Label>COD Available</Label>
        </div>
        <div>
          <Label>COD Charges</Label>
          <Input placeholder="Rs.40 extra" value={(data.codCharges as string) || ''} onChange={(e) => onChange('codCharges', e.target.value)} />
        </div>
        <div>
          <Label>Support Hours</Label>
          <Input placeholder="Mon-Sat 10 AM - 8 PM" value={(data.supportHours as string) || ''} onChange={(e) => onChange('supportHours', e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Payment Methods <span className="text-[10px] uppercase tracking-wide text-amber-700 ml-1">COD only</span></Label>
        <Input value="Cash on Delivery" disabled readOnly />
        <p className="text-[10px] text-muted-foreground mt-1">Online payments roll out in a future release.</p>
      </div>
      {/* Courier partners */}
      <div>
        <Label>Courier partners</Label>
        <div className="flex gap-2 mt-1 flex-wrap">
          {[
            { v: 'shiprocket', l: 'Shiprocket' },
            { v: 'delhivery', l: 'Delhivery' },
            { v: 'bluedart', l: 'BlueDart' },
            { v: 'ecomexpress', l: 'EcomExpress' },
            { v: 'dtdc', l: 'DTDC' },
            { v: 'xpressbees', l: 'XpressBees' },
            { v: 'shadowfax', l: 'Shadowfax' },
            { v: 'indiapost', l: 'India Post' },
            { v: 'own_rider', l: 'Own rider' },
          ].map((o) => {
            const active = courierPartners.includes(o.v);
            return (
              <button key={o.v} type="button" onClick={() => {
                const next = active ? courierPartners.filter((x) => x !== o.v) : [...courierPartners, o.v];
                onChange('courierPartners', next);
              }} className={`px-2 py-1 rounded text-xs border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'}`}>
                {o.l}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div><Label className="text-xs">Metro days</Label><Input placeholder="2-3" value={(data.deliveryMetroDays as string) || ''} onChange={(e) => onChange('deliveryMetroDays', e.target.value)} /></div>
        <div><Label className="text-xs">Tier-2 days</Label><Input placeholder="3-5" value={(data.deliveryTier2Days as string) || ''} onChange={(e) => onChange('deliveryTier2Days', e.target.value)} /></div>
        <div><Label className="text-xs">Tier-3 days</Label><Input placeholder="5-7" value={(data.deliveryTier3Days as string) || ''} onChange={(e) => onChange('deliveryTier3Days', e.target.value)} /></div>
        <div><Label className="text-xs">Northeast days</Label><Input placeholder="7-10" value={(data.deliveryNortheastDays as string) || ''} onChange={(e) => onChange('deliveryNortheastDays', e.target.value)} /></div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.internationalShippingAvailable as boolean) ?? false} onCheckedChange={(v) => onChange('internationalShippingAvailable', v)} />
          <Label className="text-xs">International shipping</Label>
        </div>
        <div><Label className="text-xs">Fragile packaging extra</Label><Input placeholder="₹50" value={(data.fragilePackagingExtraCharge as string) || ''} onChange={(e) => onChange('fragilePackagingExtraCharge', e.target.value)} /></div>
        <div><Label className="text-xs">Festival packaging extra</Label><Input placeholder="₹40" value={(data.festivalPackagingExtraCharge as string) || ''} onChange={(e) => onChange('festivalPackagingExtraCharge', e.target.value)} /></div>
      </div>

      {/* COD policy */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">COD Policy</h3>
      <p className="text-[10px] text-amber-700">⚠️ Tier-3 RTO can hit 40%. Smart COD policy = lower RTO + higher profit. (GoKwik study: COD verification call reduces RTO 30%.)</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div><Label className="text-xs">COD min order</Label><Input placeholder="₹500" value={(data.codMinOrder as string) || ''} onChange={(e) => onChange('codMinOrder', e.target.value)} /></div>
        <div><Label className="text-xs">COD max order</Label><Input placeholder="₹10,000" value={(data.codMaxOrder as string) || ''} onChange={(e) => onChange('codMaxOrder', e.target.value)} /></div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.codVerificationCallEnabled as boolean) ?? false} onCheckedChange={(v) => onChange('codVerificationCallEnabled', v)} />
          <Label className="text-xs">Verification call (-30% RTO)</Label>
        </div>
        <div className="md:col-span-3">
          <Label className="text-xs">Prepaid-only pincodes (RTO buffer — comma-separated)</Label>
          <Input placeholder="785001, 793001 (high-RTO pincodes)" value={(data.prepaidOnlyPincodes as string) || ''} onChange={(e) => onChange('prepaidOnlyPincodes', e.target.value)} />
        </div>
        <div><Label className="text-xs">RTO buffer days</Label><Input type="number" placeholder="2" value={(data.rtoBufferDays as number | undefined) ?? ''} onChange={(e) => onChange('rtoBufferDays', e.target.value === '' ? undefined : Number(e.target.value))} /></div>
        <div><Label className="text-xs">COD-to-prepaid nudge discount</Label><Input placeholder="₹50 off if prepaid" value={(data.codToPrepaidNudgeDiscount as string) || ''} onChange={(e) => onChange('codToPrepaidNudgeDiscount', e.target.value)} /></div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.partialCodEnabled as boolean) ?? false} onCheckedChange={(v) => onChange('partialCodEnabled', v)} />
          <Label className="text-xs">Partial COD (advance + balance)</Label>
        </div>
      </div>

      {/* Return policy */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Return Policy</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-2">
          <Switch checked={(data.returnEnabled as boolean) ?? true} onCheckedChange={(v) => onChange('returnEnabled', v)} />
          <Label className="text-xs">Returns enabled</Label>
        </div>
        <div>
          <Label className="text-xs">Return window (days)</Label>
          <select className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" value={String((data.returnWindowDays as number) || '')} onChange={(e) => onChange('returnWindowDays', e.target.value === '' ? undefined : Number(e.target.value))}>
            <option value="">--</option>
            <option value="0">No returns</option>
            <option value="3">3 days</option>
            <option value="7">7 days</option>
            <option value="10">10 days</option>
            <option value="15">15 days</option>
            <option value="30">30 days</option>
          </select>
        </div>
        <div>
          <Label className="text-xs">Refund mode</Label>
          <select className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" value={(data.returnRefundMode as string) || ''} onChange={(e) => onChange('returnRefundMode', e.target.value)}>
            <option value="">--</option>
            <option value="original_payment">Original payment</option>
            <option value="store_credit">Store credit / wallet</option>
            <option value="wallet_points">Wallet points</option>
            <option value="choice">Customer's choice</option>
          </select>
        </div>
      </div>
      <div>
        <Label className="text-xs">Accepted return reasons</Label>
        <div className="flex gap-2 mt-1 flex-wrap">
          {['damaged', 'defective', 'wrong_product', 'size_issue', 'quality', 'changed_mind'].map((r) => {
            const active = returnReasons.includes(r);
            return (
              <button key={r} type="button" onClick={() => {
                const next = active ? returnReasons.filter((x) => x !== r) : [...returnReasons, r];
                onChange('returnReasonsAccepted', next);
              }} className={`px-2 py-1 rounded text-xs border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'}`}>
                {r.replace(/_/g, ' ')}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-2">
          <Switch checked={(data.returnRequirePhotoEvidence as boolean) ?? false} onCheckedChange={(v) => onChange('returnRequirePhotoEvidence', v)} />
          <Label className="text-xs">Require photo evidence</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.returnRequireBatchId as boolean) ?? false} onCheckedChange={(v) => onChange('returnRequireBatchId', v)} />
          <Label className="text-xs">Require batch ID (food)</Label>
        </div>
        <div>
          <Label className="text-xs">Reverse pickup</Label>
          <select className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" value={(data.reversePickupServiceable as string) || ''} onChange={(e) => onChange('reversePickupServiceable', e.target.value)}>
            <option value="">--</option>
            <option value="all">All pincodes</option>
            <option value="most">Most pincodes</option>
            <option value="limited">Limited</option>
          </select>
        </div>
        <div><Label className="text-xs">Non-returnable categories</Label><Input placeholder="Sale, custom-print, innerwear" value={(data.nonReturnableCategories as string) || ''} onChange={(e) => onChange('nonReturnableCategories', e.target.value)} /></div>
        <div><Label className="text-xs">Reverse pickup charge</Label><Input placeholder="₹50" value={(data.reversePickupCharge as string) || ''} onChange={(e) => onChange('reversePickupCharge', e.target.value)} /></div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.selfShipFallbackAllowed as boolean) ?? false} onCheckedChange={(v) => onChange('selfShipFallbackAllowed', v)} />
          <Label className="text-xs">Self-ship fallback</Label>
        </div>
      </div>
      <div>
        <Label>Return Policy (free-text legacy)</Label>
        <Input placeholder="7-day easy returns, original packaging required" value={(data.returnPolicy as string) || ''} onChange={(e) => onChange('returnPolicy', e.target.value)} />
      </div>

      {/* Exchange policy */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Exchange Policy</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-2">
          <Switch checked={(data.exchangeEnabled as boolean) ?? true} onCheckedChange={(v) => onChange('exchangeEnabled', v)} />
          <Label className="text-xs">Exchanges enabled</Label>
        </div>
        <div><Label className="text-xs">Exchange window (days)</Label><Input type="number" placeholder="7" value={(data.exchangeWindowDays as number | undefined) ?? ''} onChange={(e) => onChange('exchangeWindowDays', e.target.value === '' ? undefined : Number(e.target.value))} /></div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.exchangeSizeOnly as boolean) ?? true} onCheckedChange={(v) => onChange('exchangeSizeOnly', v)} />
          <Label className="text-xs">Size-only (not cross-category)</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.exchangeCrossCategoryAllowed as boolean) ?? false} onCheckedChange={(v) => onChange('exchangeCrossCategoryAllowed', v)} />
          <Label className="text-xs">Cross-category allowed</Label>
        </div>
        <div>
          <Label className="text-xs">Max exchanges per order</Label>
          <select className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" value={String((data.exchangeMaxPerOrder as number) || '')} onChange={(e) => onChange('exchangeMaxPerOrder', e.target.value === '' ? undefined : Number(e.target.value))}>
            <option value="">--</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="-1">Unlimited</option>
          </select>
        </div>
      </div>
      <div>
        <Label>Exchange Policy (free-text legacy)</Label>
        <Input placeholder="Size exchange free within 7 days" value={(data.exchangePolicy as string) || ''} onChange={(e) => onChange('exchangePolicy', e.target.value)} />
      </div>

      {/* Discount codes builder */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Discount Codes</h3>
      <DynamicList
        items={discountCodes}
        onChange={(items) => onChange('discountCodes', items)}
        newItem={() => ({ code: '', type: 'percent', value: '', minOrderValue: '' })}
        addLabel="Add discount code"
        renderItem={(item, _, update) => (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><Label className="text-xs">Code</Label><Input placeholder="DIWALI20" value={(item.code as string) || ''} onChange={(e) => update('code', e.target.value.toUpperCase())} /></div>
            <div>
              <Label className="text-xs">Type</Label>
              <select className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs" value={(item.type as string) || 'percent'} onChange={(e) => update('type', e.target.value)}>
                <option value="flat">Flat</option>
                <option value="percent">Percent</option>
                <option value="bogo">BOGO</option>
                <option value="buy2get1">Buy 2 Get 1</option>
                <option value="freegift">Free gift</option>
                <option value="tier">Tiered</option>
              </select>
            </div>
            <div><Label className="text-xs">Value</Label><Input placeholder="20 (% or ₹)" value={(item.value as string) || ''} onChange={(e) => update('value', e.target.value)} /></div>
            <div><Label className="text-xs">Min order</Label><Input placeholder="₹999" value={(item.minOrderValue as string) || ''} onChange={(e) => update('minOrderValue', e.target.value)} /></div>
            <div><Label className="text-xs">Max discount cap</Label><Input placeholder="₹500" value={(item.maxDiscount as string) || ''} onChange={(e) => update('maxDiscount', e.target.value)} /></div>
            <div><Label className="text-xs">Category restriction</Label><Input placeholder="women / men / accessories" value={(item.categoryRestriction as string) || ''} onChange={(e) => update('categoryRestriction', e.target.value)} /></div>
            <div><Label className="text-xs">Valid from</Label><Input type="date" value={(item.validFrom as string) || ''} onChange={(e) => update('validFrom', e.target.value)} /></div>
            <div><Label className="text-xs">Valid to</Label><Input type="date" value={(item.validTo as string) || ''} onChange={(e) => update('validTo', e.target.value)} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={(item.firstOrderOnly as boolean) ?? false} onCheckedChange={(v) => update('firstOrderOnly', v)} />
              <Label className="text-xs">First order only</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={(item.stackable as boolean) ?? false} onCheckedChange={(v) => update('stackable', v)} />
              <Label className="text-xs">Stackable</Label>
            </div>
          </div>
        )}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div><Label className="text-xs">Bulk tier 1 — min qty</Label><Input type="number" placeholder="5" value={(data.bulkTier1MinQty as number | undefined) ?? ''} onChange={(e) => onChange('bulkTier1MinQty', e.target.value === '' ? undefined : Number(e.target.value))} /></div>
        <div><Label className="text-xs">Tier 1 discount %</Label><Input type="number" placeholder="10" value={(data.bulkTier1DiscountPct as number | undefined) ?? ''} onChange={(e) => onChange('bulkTier1DiscountPct', e.target.value === '' ? undefined : Number(e.target.value))} /></div>
        <div className="md:col-span-1" />
        <div><Label className="text-xs">Bulk tier 2 — min qty</Label><Input type="number" placeholder="10" value={(data.bulkTier2MinQty as number | undefined) ?? ''} onChange={(e) => onChange('bulkTier2MinQty', e.target.value === '' ? undefined : Number(e.target.value))} /></div>
        <div><Label className="text-xs">Tier 2 discount %</Label><Input type="number" placeholder="15" value={(data.bulkTier2DiscountPct as number | undefined) ?? ''} onChange={(e) => onChange('bulkTier2DiscountPct', e.target.value === '' ? undefined : Number(e.target.value))} /></div>
        <div className="md:col-span-1" />
        <div><Label className="text-xs">Bulk tier 3 — min qty</Label><Input type="number" placeholder="20" value={(data.bulkTier3MinQty as number | undefined) ?? ''} onChange={(e) => onChange('bulkTier3MinQty', e.target.value === '' ? undefined : Number(e.target.value))} /></div>
        <div><Label className="text-xs">Tier 3 discount %</Label><Input type="number" placeholder="20" value={(data.bulkTier3DiscountPct as number | undefined) ?? ''} onChange={(e) => onChange('bulkTier3DiscountPct', e.target.value === '' ? undefined : Number(e.target.value))} /></div>
        <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><Label className="text-xs">Festival countdown</Label><Input placeholder="Diwali Sale" value={(data.festivalCountdownName as string) || ''} onChange={(e) => onChange('festivalCountdownName', e.target.value)} /></div>
          <div><Label className="text-xs">Ends at</Label><Input type="date" value={(data.festivalCountdownEndsAt as string) || ''} onChange={(e) => onChange('festivalCountdownEndsAt', e.target.value)} /></div>
          <div className="md:col-span-1" />
          <div><Label className="text-xs">Free gift above</Label><Input placeholder="₹1,499" value={(data.freeGiftAboveThreshold as string) || ''} onChange={(e) => onChange('freeGiftAboveThreshold', e.target.value)} /></div>
          <div><Label className="text-xs">Free gift SKU</Label><Input placeholder="GIFT-TOTE" value={(data.freeGiftSku as string) || ''} onChange={(e) => onChange('freeGiftSku', e.target.value)} /></div>
        </div>
      </div>

      {/* Subscription / first order */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Subscription &amp; First-order</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-2">
          <Switch checked={(data.subscriptionEnabled as boolean) ?? isSubscription} onCheckedChange={(v) => onChange('subscriptionEnabled', v)} />
          <Label className="text-xs">Subscription products</Label>
        </div>
        <div><Label className="text-xs">First-order discount %</Label><Input type="number" placeholder="10" value={(data.firstOrderDiscountPercent as number | undefined) ?? ''} onChange={(e) => onChange('firstOrderDiscountPercent', e.target.value === '' ? undefined : Number(e.target.value))} /></div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.freeSampleAvailable as boolean) ?? false} onCheckedChange={(v) => onChange('freeSampleAvailable', v)} />
          <Label className="text-xs">Free sample available</Label>
        </div>
      </div>
      {(data.subscriptionEnabled as boolean) && (
        <div>
          <Label className="text-xs">Subscription intervals</Label>
          <div className="flex gap-2 mt-1">
            {['15d', '30d', '45d', '60d'].map((i) => {
              const active = subscriptionIntervals.includes(i);
              return (
                <button key={i} type="button" onClick={() => {
                  const next = active ? subscriptionIntervals.filter((x) => x !== i) : [...subscriptionIntervals, i];
                  onChange('subscriptionIntervals', next);
                }} className={`px-2 py-1 rounded text-xs border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'}`}>
                  {i}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="flex items-center gap-2">
              <Switch checked={(data.subscriptionPauseAllowed as boolean) ?? true} onCheckedChange={(v) => onChange('subscriptionPauseAllowed', v)} />
              <Label className="text-xs">Pause allowed</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={(data.subscriptionSkipAllowed as boolean) ?? true} onCheckedChange={(v) => onChange('subscriptionSkipAllowed', v)} />
              <Label className="text-xs">Skip allowed</Label>
            </div>
          </div>
        </div>
      )}

      {/* B2B / wholesale */}
      {(isB2B || (data.b2bWholesaleEnabled as boolean)) && (
        <>
          <h3 className="text-lg font-semibold border-b border-border pb-2">B2B / Wholesale</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={(data.b2bWholesaleEnabled as boolean) ?? isB2B} onCheckedChange={(v) => onChange('b2bWholesaleEnabled', v)} />
              <Label className="text-xs">B2B / wholesale enabled</Label>
            </div>
            <div><Label className="text-xs">MOQ (pieces)</Label><Input type="number" placeholder="50" value={(data.b2bMoqPieces as number | undefined) ?? ''} onChange={(e) => onChange('b2bMoqPieces', e.target.value === '' ? undefined : Number(e.target.value))} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={(data.b2bGstInvoiceMandatory as boolean) ?? true} onCheckedChange={(v) => onChange('b2bGstInvoiceMandatory', v)} />
              <Label className="text-xs">GST invoice mandatory</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={(data.b2bDeliveryChallan as boolean) ?? true} onCheckedChange={(v) => onChange('b2bDeliveryChallan', v)} />
              <Label className="text-xs">Delivery challan</Label>
            </div>
            <div>
              <Label className="text-xs">Net payment terms</Label>
              <select className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" value={(data.b2bNetPaymentTerms as string) || ''} onChange={(e) => onChange('b2bNetPaymentTerms', e.target.value)}>
                <option value="">--</option>
                <option value="advance">Advance</option>
                <option value="net15">Net 15</option>
                <option value="net30">Net 30</option>
              </select>
            </div>
          </div>
        </>
      )}

      {/* Gift options + loyalty */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Gift Options &amp; Loyalty</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-2">
          <Switch checked={(data.giftWrapAvailable as boolean) ?? false} onCheckedChange={(v) => onChange('giftWrapAvailable', v)} />
          <Label className="text-xs">Gift wrap available</Label>
        </div>
        <div><Label className="text-xs">Gift wrap charge</Label><Input placeholder="₹49" value={(data.giftWrapCharge as string) || ''} onChange={(e) => onChange('giftWrapCharge', e.target.value)} /></div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.giftMessageEnabled as boolean) ?? false} onCheckedChange={(v) => onChange('giftMessageEnabled', v)} />
          <Label className="text-xs">Gift message</Label>
        </div>
        <div>
          <Label className="text-xs">Gift message max chars</Label>
          <select className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" value={String((data.giftMessageMaxChars as number) || '')} onChange={(e) => onChange('giftMessageMaxChars', e.target.value === '' ? undefined : Number(e.target.value))}>
            <option value="">--</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.scheduledDeliveryEnabled as boolean) ?? false} onCheckedChange={(v) => onChange('scheduledDeliveryEnabled', v)} />
          <Label className="text-xs">Scheduled delivery</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={(data.hideInvoiceOnGift as boolean) ?? false} onCheckedChange={(v) => onChange('hideInvoiceOnGift', v)} />
          <Label className="text-xs">Hide invoice when gift</Label>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-2">
          <Switch checked={(data.loyaltyEnabled as boolean) ?? false} onCheckedChange={(v) => onChange('loyaltyEnabled', v)} />
          <Label className="text-xs">Loyalty program</Label>
        </div>
        <div><Label className="text-xs">Wallet point name</Label><Input placeholder="TSS Money / Mama Coins" value={(data.loyaltyWalletPointName as string) || ''} onChange={(e) => onChange('loyaltyWalletPointName', e.target.value)} /></div>
        <div><Label className="text-xs">Points per ₹</Label><Input placeholder="1 point per ₹100" value={(data.loyaltyPointsPerRupee as string) || ''} onChange={(e) => onChange('loyaltyPointsPerRupee', e.target.value)} /></div>
        <div><Label className="text-xs">Redemption ratio</Label><Input placeholder="100 points = ₹50" value={(data.loyaltyRedemptionRatio as string) || ''} onChange={(e) => onChange('loyaltyRedemptionRatio', e.target.value)} /></div>
        <div><Label className="text-xs">Referral reward</Label><Input placeholder="₹200 wallet credit" value={(data.loyaltyReferralReward as string) || ''} onChange={(e) => onChange('loyaltyReferralReward', e.target.value)} /></div>
      </div>

      {/* Abandoned cart */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Abandoned Cart Sequence</h3>
      <p className="text-[10px] text-muted-foreground">Bot sends these (with WhatsApp opt-in templates) at 1h / 24h / 7d after cart abandonment.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center gap-2 md:col-span-2">
          <Switch checked={(data.abandonedCartEnabled as boolean) ?? false} onCheckedChange={(v) => onChange('abandonedCartEnabled', v)} />
          <Label className="text-xs">Abandoned-cart recovery enabled (DPDPA opt-in required)</Label>
        </div>
        {(data.abandonedCartEnabled as boolean) && (
          <>
            <div className="md:col-span-2">
              <Label className="text-xs">1-hour reminder message</Label>
              <Input placeholder="Aap ne cart mein items chhod diye — finish karein?" value={(data.abandonedCart1hMessage as string) || ''} onChange={(e) => onChange('abandonedCart1hMessage', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">24-hour reminder message</Label>
              <Input placeholder="Ye items abhi tak available hain..." value={(data.abandonedCart24hMessage as string) || ''} onChange={(e) => onChange('abandonedCart24hMessage', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">24-hour discount code</Label>
              <Input placeholder="COMEBACK10" value={(data.abandonedCart24hDiscountCode as string) || ''} onChange={(e) => onChange('abandonedCart24hDiscountCode', e.target.value.toUpperCase())} />
            </div>
            <div>
              <Label className="text-xs">7-day reminder message</Label>
              <Input placeholder="Last chance — extra ₹100 off..." value={(data.abandonedCart7dMessage as string) || ''} onChange={(e) => onChange('abandonedCart7dMessage', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">7-day discount code</Label>
              <Input placeholder="LASTCHANCE15" value={(data.abandonedCart7dDiscountCode as string) || ''} onChange={(e) => onChange('abandonedCart7dDiscountCode', e.target.value.toUpperCase())} />
            </div>
          </>
        )}
      </div>

      <div>
        <Label>Order Tracking Process</Label>
        <Input placeholder="Share order ID — we'll send tracking link" value={(data.orderTrackingProcess as string) || ''} onChange={(e) => onChange('orderTrackingProcess', e.target.value)} />
      </div>
      <div>
        <Label>Current Offers (free-text legacy)</Label>
        <Input placeholder="Flat 15% off above Rs.1,499 — code SHOP15" value={(data.currentOffers as string) || ''} onChange={(e) => onChange('currentOffers', e.target.value)} />
      </div>

      {/* Compliance — E-com Rules 2020 + DPDPA */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Compliance (E-com Rules 2020 + DPDPA)</h3>
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-3">
        <p className="text-[10px] text-amber-900">
          ⚠️ <b>Consumer Protection (E-Commerce) Rules 2020 §5(1)</b> mandates a Grievance Officer with 24-hour acknowledgement + 1-month resolution. <b>DPDPA Section 7</b> mandates explicit consent before sending marketing messages.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label className="text-xs">Grievance Officer name *</Label><Input placeholder="Priya Sharma" value={(data.grievanceOfficerName as string) || ''} onChange={(e) => onChange('grievanceOfficerName', e.target.value)} /></div>
          <div><Label className="text-xs">Grievance Officer email *</Label><Input placeholder="grievance@your-shop.in" value={(data.grievanceOfficerEmail as string) || ''} onChange={(e) => onChange('grievanceOfficerEmail', e.target.value)} /></div>
          <div><Label className="text-xs">Grievance Officer phone</Label><Input placeholder="+91 98765 43210" value={(data.grievanceOfficerPhone as string) || ''} onChange={(e) => onChange('grievanceOfficerPhone', e.target.value)} /></div>
          <div><Label className="text-xs">Nodal Officer name (large platforms)</Label><Input placeholder="Optional" value={(data.nodalOfficerName as string) || ''} onChange={(e) => onChange('nodalOfficerName', e.target.value)} /></div>
          <div><Label className="text-xs">Nodal Officer email</Label><Input placeholder="nodal@your-shop.in" value={(data.nodalOfficerEmail as string) || ''} onChange={(e) => onChange('nodalOfficerEmail', e.target.value)} /></div>
          <div className="md:col-span-2"><Label className="text-xs">Privacy policy URL</Label><Input placeholder="https://your-shop.in/privacy" value={(data.privacyPolicyUrl as string) || ''} onChange={(e) => onChange('privacyPolicyUrl', e.target.value)} /></div>
          <div className="flex items-center gap-2 md:col-span-2">
            <Switch checked={(data.abandonedCartConsentEnabled as boolean) ?? true} onCheckedChange={(v) => onChange('abandonedCartConsentEnabled', v)} />
            <Label className="text-xs">Customer opt-in flow exists for abandoned-cart messages (DPDPA §7)</Label>
          </div>
        </div>
        {(isJewellery || isPackagedFood || isHandloomGI) && (
          <div className="rounded-md bg-red-50 border border-red-300 p-2 space-y-1 mt-2">
            {isJewellery && <p className="text-[10px] text-red-900">⚠️ <b>Gold/silver jewellery</b> — BIS Hallmark UID is MANDATORY since 1 Apr 2023. Bot will refuse to confirm an order on a jewellery SKU without HUID.</p>}
            {isPackagedFood && <p className="text-[10px] text-red-900">⚠️ <b>Packaged food</b> — FSSAI license MUST be displayed per pack. Bot quotes the FSSAI number when customer asks.</p>}
            {isHandloomGI && <p className="text-[10px] text-red-900">⚠️ <b>Handloom / GI-tagged</b> — false GI claim is criminal under GI Act 1999. Only enable if you have certified GI status.</p>}
          </div>
        )}
        {isCustomPrint && (
          <div className="rounded-md bg-amber-100 border border-amber-300 p-2 mt-2">
            <p className="text-[10px] text-amber-900">⚠️ <b>Custom-print on demand</b> — typically NO returns / exchanges (made-to-order). Set Return policy to "no returns" or 0 days.</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-b border-border pb-2">
        <h3 className="text-lg font-semibold">Products</h3>
        <EcommerceProductsBulkImport data={data} onChange={onChange} />
      </div>
      <DynamicList
        items={products}
        onChange={(items) => onChange('products', items)}
        newItem={() => ({ name: '', price: '', description: '', category: '', bestseller: false, inStock: true })}
        addLabel="Add Product"
        renderItem={(item, _, update) => (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Product Name</Label><Input placeholder="Floral Cotton Kurta Set" value={(item.name as string) || ''} onChange={(e) => update('name', e.target.value)} /></div>
              <div><Label>Price</Label><Input placeholder="Rs.1,199" value={(item.price as string) || ''} onChange={(e) => update('price', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Category</Label><Input placeholder="Women's clothing" value={(item.category as string) || ''} onChange={(e) => update('category', e.target.value)} /></div>
              <div>
                <Label>Image URL (optional)</Label>
                <Input placeholder="https://i.imgur.com/abc.jpg" value={(item.imageUrl as string) || ''} onChange={(e) => update('imageUrl', e.target.value)} />
              </div>
            </div>
            <div><Label>Description</Label><Input placeholder="100% cotton, M/L/XL available" value={(item.description as string) || ''} onChange={(e) => update('description', e.target.value)} /></div>
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <Switch checked={(item.bestseller as boolean) ?? false} onCheckedChange={(v) => update('bestseller', v)} />
                <Label>Bestseller</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={(item.inStock as boolean) ?? true} onCheckedChange={(v) => update('inStock', v)} />
                <Label>In Stock</Label>
              </div>
            </div>
          </div>
        )}
      />
    </div>
  );
}

// ─── Grocery Form ───
// Captures the operational reality of sabziwala / kirana / dairy / meat / fish /
// bakery / aata-chakki / organic / supermarket sub-types. Optimised for the
// LEAST tech-savvy owner segment — the "today's list" textarea is the centre
// of the UX (paste from WhatsApp). All advanced fields are progressive-disclosure.
function GroceryForm({ data, onChange }: { data: Record<string, unknown>; onChange: (f: string, v: unknown) => void }) {
  // Multi-select sub-types — kirana often runs dairy + bakery; supermarkets cover everything
  const subTypes = (data.subTypes as string[]) || ((data.subType as string) ? [data.subType as string] : []);
  const subType = subTypes[0] || '';
  const setSubTypes = (next: string[]) => {
    onChange('subTypes', next);
    onChange('subType', next[0] || '');
  };
  const catalogMode = (data.catalogMode as string) || 'daily-mandi';
  const defaultProducts = (data.defaultProducts as string[]) || [];
  const paymentMethods = (data.paymentMethods as string[]) || ['Cash on Delivery'];
  const zones = (data.zones as Array<Record<string, unknown>>) || [{ zoneName: '', pincodes: '', deliveryFee: '', minimumOrder: '', buildingHandoff: 'door' }];

  const SUB_TYPES: Array<{ value: string; label: string; emoji: string }> = [
    { value: 'kirana', label: 'Kirana / general store', emoji: '🛒' },
    { value: 'sabziwala', label: 'Sabzi / vegetable shop', emoji: '🥬' },
    { value: 'fruit', label: 'Fruit shop', emoji: '🍎' },
    { value: 'dairy', label: 'Dairy', emoji: '🥛' },
    { value: 'milk-only', label: 'Milk-only delivery', emoji: '🍼' },
    { value: 'bakery', label: 'Bakery (daily-fresh)', emoji: '🥐' },
    { value: 'meat', label: 'Meat shop', emoji: '🥩' },
    { value: 'fish', label: 'Fish market', emoji: '🐟' },
    { value: 'poultry', label: 'Poultry / egg', emoji: '🥚' },
    { value: 'aata-chakki', label: 'Aata chakki', emoji: '🌾' },
    { value: 'organic', label: 'Organic store', emoji: '🌱' },
    { value: 'supermarket', label: 'Supermarket / franchise', emoji: '🏪' },
    { value: 'sweet-daily', label: 'Sweet shop (daily)', emoji: '🍬' },
    { value: 'masala', label: 'Masala / spice grinding', emoji: '🌶️' },
    { value: 'dryfruit', label: 'Dry fruit', emoji: '🥜' },
    { value: 'pickle-home', label: 'Home pickle / papad', emoji: '🫙' },
  ];

  const showOrganicFields = subTypes.includes('organic');
  const showMeatFields = subTypes.includes('meat') || subTypes.includes('poultry');
  const showAataChakki = subTypes.includes('aata-chakki');
  const showColdChain = subTypes.some((s) => ['dairy', 'milk-only', 'meat', 'fish', 'poultry', 'sweet-daily'].includes(s));
  const isDailyMandi = catalogMode === 'daily-mandi';

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold border-b border-border pb-2">Shop Details</h3>

      {/* Sub-type chooser — MULTI-SELECT (kirana often = dairy + bakery; supermarket = everything) */}
      <div>
        <Label>What kind of grocery shop? * <span className="text-[10px] text-muted-foreground font-normal">(pick all that apply)</span></Label>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
          {SUB_TYPES.map((st) => {
            const active = subTypes.includes(st.value);
            return (
              <button
                key={st.value}
                type="button"
                onClick={() => {
                  const next = active ? subTypes.filter((s) => s !== st.value) : [...subTypes, st.value];
                  setSubTypes(next);
                }}
                className={`text-left rounded-md border px-3 py-2 text-xs transition-colors ${
                  active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border hover:border-primary/50'
                }`}
              >
                <span className="mr-1">{st.emoji}</span>
                {st.label}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Picks affect what fields appear below + the bot&apos;s tone (sabziwala vs supermarket).
          {subTypes.length > 1 && <span className="ml-1 text-[var(--ink)]">{subTypes.length} selected.</span>}
        </p>
      </div>

      {/* Compliance basics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>FSSAI License Number</Label>
          <Input
            placeholder="14-digit FSSAI number"
            value={(data.fssaiNumber as string) || ''}
            onChange={(e) => onChange('fssaiNumber', e.target.value.replace(/\D/g, '').slice(0, 14))}
            inputMode="numeric"
          />
          <p className="text-[10px] text-muted-foreground mt-1">Mandatory for any food retailer in India.</p>
        </div>
        <div>
          <Label>FSSAI License Type</Label>
          <div className="flex gap-2 mt-1 flex-wrap">
            {[
              { v: 'basic-registration', l: 'Basic (₹100/yr, < ₹12L)' },
              { v: 'state-license', l: 'State (₹12L-₹20Cr)' },
              { v: 'central-license', l: 'Central (> ₹20Cr)' },
            ].map((o) => {
              const active = (data.fssaiType as string) === o.v;
              return (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => onChange('fssaiType', o.v)}
                  className={`px-3 py-1.5 rounded text-xs border transition-colors ${
                    active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border hover:border-primary/50'
                  }`}
                >
                  {o.l}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Shop Act License (optional)</Label>
          <Input
            placeholder="State shop & establishment number"
            value={(data.shopActLicense as string) || ''}
            onChange={(e) => onChange('shopActLicense', e.target.value)}
          />
        </div>
        <div>
          <Label>Legal Metrology Reg. (optional)</Label>
          <Input
            placeholder="For pre-packaged retailers"
            value={(data.legalMetrologyRegNumber as string) || ''}
            onChange={(e) => onChange('legalMetrologyRegNumber', e.target.value)}
          />
        </div>
      </div>

      {/* Catalog mode */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Catalog</h3>
      <div>
        <Label>How does your stock change?</Label>
        <div className="flex gap-2 mt-1 flex-wrap">
          {[
            { v: 'daily-mandi', l: '🥬 Daily mandi (sabzi, fish)', sub: 'List changes every day' },
            { v: 'static', l: '🛒 Same products always', sub: 'Kirana / packaged goods' },
            { v: 'weekly-rotating', l: '📆 Weekly rotation', sub: 'Festival / seasonal' },
            { v: 'seasonal', l: '🍉 Seasonal', sub: 'Mango, strawberry season' },
          ].map((o) => {
            const active = catalogMode === o.v;
            return (
              <button
                key={o.v}
                type="button"
                onClick={() => onChange('catalogMode', o.v)}
                className={`text-left rounded-md border px-3 py-2 text-xs transition-colors flex-1 min-w-[180px] ${
                  active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border hover:border-primary/50'
                }`}
              >
                <div className="font-semibold">{o.l}</div>
                <div className="opacity-70 text-[10px]">{o.sub}</div>
              </button>
            );
          })}
        </div>
      </div>

      {isDailyMandi && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 space-y-3">
          <div>
            <Label>Today&apos;s list (paste from WhatsApp)</Label>
            <Textarea
              placeholder={'tamatar 40\npyaaz 35\naloo 25\nbhindi 60\ndhaniya 10/bunch\nlemon 5/piece'}
              rows={6}
              value={(data.dailyCatalogTextarea as string) || ''}
              onChange={(e) => onChange('dailyCatalogTextarea', e.target.value)}
            />
            <p className="text-[10px] text-emerald-900 mt-1">One item per line. Format: <code>name price[/unit]</code>. Bot will parse this and quote prices to customers.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Cutoff time for today&apos;s orders</Label>
              <Input
                placeholder="16:00"
                value={(data.dailyCatalogCutoffTime as string) || ''}
                onChange={(e) => onChange('dailyCatalogCutoffTime', e.target.value)}
              />
              <p className="text-[10px] text-emerald-900 mt-1">e.g. 4:00 PM = bot stops accepting today&apos;s orders after this.</p>
            </div>
            <div className="flex items-end gap-2">
              <Switch
                checked={(data.eveningMarketRunSupported as boolean) ?? false}
                onCheckedChange={(v) => onChange('eveningMarketRunSupported', v)}
              />
              <Label className="mb-1">Second mandi run in the evening</Label>
            </div>
          </div>
        </div>
      )}

      {/* Pricing tier */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Pricing tier</Label>
          <div className="flex gap-2 mt-1">
            {[
              { v: 'retail', l: 'Retail only' },
              { v: 'wholesale', l: 'Wholesale only' },
              { v: 'both', l: 'Both' },
            ].map((o) => {
              const active = (data.defaultPricingTier as string) === o.v;
              return (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => onChange('defaultPricingTier', o.v)}
                  className={`px-3 py-1.5 rounded text-sm border transition-colors ${
                    active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'
                  }`}
                >
                  {o.l}
                </button>
              );
            })}
          </div>
        </div>
        {(data.defaultPricingTier === 'wholesale' || data.defaultPricingTier === 'both') && (
          <div>
            <Label>Wholesale min order value</Label>
            <Input
              placeholder="₹1,500"
              value={(data.wholesaleMinOrderValue as string) || ''}
              onChange={(e) => onChange('wholesaleMinOrderValue', e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Static catalog (keeps backward-compat with existing GroceryFields.defaultProducts) */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label>Common everyday products (comma-separated)</Label>
          <GroceryProductsBulkImport data={data} onChange={onChange} />
        </div>
        <Input
          placeholder="Atta, Rice, Dal, Sugar, Tea, Milk, Curd"
          value={defaultProducts.join(', ')}
          onChange={(e) => onChange('defaultProducts', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
        />
        <p className="text-[10px] text-muted-foreground mt-1">Bot uses this when customer asks &quot;what do you have?&quot; before today&apos;s list is updated. Bulk import accepts photo / PDF / Excel of your full price list.</p>
      </div>

      {/* Delivery zones */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Delivery Zones</h3>
      <div className="space-y-3">
        {zones.map((z, idx) => (
          <div key={idx} className="border border-border rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold">Zone {idx + 1}</div>
              {zones.length > 1 && (
                <button
                  type="button"
                  onClick={() => onChange('zones', zones.filter((_, i) => i !== idx))}
                  className="text-muted-foreground hover:text-destructive text-xs"
                >
                  Remove
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Zone name</Label>
                <Input
                  placeholder="Sector 14, Lajpat Nagar"
                  value={(z.zoneName as string) || ''}
                  onChange={(e) => {
                    const next = [...zones];
                    next[idx] = { ...next[idx], zoneName: e.target.value };
                    onChange('zones', next);
                  }}
                />
              </div>
              <div>
                <Label>Pincodes</Label>
                <Input
                  placeholder="110024, 110014"
                  value={(z.pincodes as string) || ''}
                  onChange={(e) => {
                    const next = [...zones];
                    next[idx] = { ...next[idx], pincodes: e.target.value };
                    onChange('zones', next);
                  }}
                />
              </div>
              <div>
                <Label>Delivery fee</Label>
                <Input
                  placeholder="₹20"
                  value={(z.deliveryFee as string) || ''}
                  onChange={(e) => {
                    const next = [...zones];
                    next[idx] = { ...next[idx], deliveryFee: e.target.value };
                    onChange('zones', next);
                  }}
                />
              </div>
              <div>
                <Label>Min order in this zone</Label>
                <Input
                  placeholder="₹150"
                  value={(z.minimumOrder as string) || ''}
                  onChange={(e) => {
                    const next = [...zones];
                    next[idx] = { ...next[idx], minimumOrder: e.target.value };
                    onChange('zones', next);
                  }}
                />
              </div>
            </div>
            <div>
              <Label>Where do you hand off the parcel?</Label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {[
                  { v: 'door', l: 'At the door' },
                  { v: 'gate', l: 'Society gate' },
                  { v: 'concierge', l: 'Concierge desk' },
                  { v: 'guard', l: 'Guard / watchman' },
                  { v: 'customer-choice', l: 'Customer chooses' },
                ].map((o) => {
                  const active = (z.buildingHandoff as string) === o.v;
                  return (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => {
                        const next = [...zones];
                        next[idx] = { ...next[idx], buildingHandoff: o.v };
                        onChange('zones', next);
                      }}
                      className={`px-2 py-1 rounded text-xs border transition-colors ${
                        active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'
                      }`}
                    >
                      {o.l}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange('zones', [...zones, { zoneName: '', pincodes: '', deliveryFee: '', minimumOrder: '', buildingHandoff: 'door' }])}
          className="w-full border border-dashed border-border rounded-md p-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          + Add another zone
        </button>
      </div>

      {/* Slots — kept simple as a string for backward compat with existing GroceryFields.deliverySlots */}
      <div>
        <Label>Delivery slots (overall)</Label>
        <Input
          placeholder="Morning 7-9 AM, Evening 5-7 PM"
          value={(data.deliverySlots as string) || ''}
          onChange={(e) => onChange('deliverySlots', e.target.value)}
        />
      </div>

      {/* Recurring */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Recurring orders</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center gap-3">
          <Switch
            checked={(data.recurringOrdersEnabled as boolean) ?? false}
            onCheckedChange={(v) => onChange('recurringOrdersEnabled', v)}
          />
          <Label>Allow daily / weekly recurring orders</Label>
        </div>
        {(data.recurringOrdersEnabled as boolean) && (
          <div>
            <Label>Default cycle</Label>
            <div className="flex gap-2 mt-1">
              {[
                { v: 'daily', l: 'Daily (milk)' },
                { v: 'weekly', l: 'Weekly (veg)' },
                { v: 'biweekly', l: 'Biweekly' },
                { v: 'monthly', l: 'Monthly (kirana)' },
              ].map((o) => {
                const active = (data.recurringCycle as string) === o.v;
                return (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => onChange('recurringCycle', o.v)}
                    className={`px-2 py-1 rounded text-xs border transition-colors ${
                      active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'
                    }`}
                  >
                    {o.l}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Cold chain + freshness — only relevant for perishable sub-types */}
      {showColdChain && (
        <>
          <h3 className="text-lg font-semibold border-b border-border pb-2">Freshness</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Switch
                checked={(data.coldChainSupport as boolean) ?? true}
                onCheckedChange={(v) => onChange('coldChainSupport', v)}
              />
              <Label>Cold-chain delivery (insulated bag / box)</Label>
            </div>
            <div>
              <Label>Default freshness tag</Label>
              <div className="flex gap-1 mt-1 flex-wrap">
                {[
                  { v: 'made-this-morning', l: 'Made this morning' },
                  { v: 'today-catch', l: "Today's catch" },
                  { v: 'baked-today', l: 'Baked today' },
                  { v: 'cut-fresh', l: 'Cut fresh' },
                  { v: 'mandi-today', l: 'Mandi today' },
                  { v: 'frozen', l: 'Frozen' },
                ].map((o) => {
                  const active = (data.freshnessDefaultTag as string) === o.v;
                  return (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => onChange('freshnessDefaultTag', o.v)}
                      className={`px-2 py-1 rounded text-[10px] border transition-colors ${
                        active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'
                      }`}
                    >
                      {o.l}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Substitution & returns */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Substitutions &amp; Returns</h3>
      <div>
        <Label>If an item is out of stock</Label>
        <div className="flex gap-2 mt-1 flex-wrap">
          {[
            { v: 'auto-substitute', l: 'Substitute with similar (notify customer)' },
            { v: 'ask-customer', l: 'Ask customer first' },
            { v: 'cancel-line-item', l: 'Skip just that item' },
            { v: 'cancel-order', l: 'Cancel the whole order' },
          ].map((o) => {
            const active = (data.substitutionPolicy as string) === o.v;
            return (
              <button
                key={o.v}
                type="button"
                onClick={() => onChange('substitutionPolicy', o.v)}
                className={`px-2 py-1 rounded text-xs border transition-colors ${
                  active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'
                }`}
              >
                {o.l}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center gap-3">
          <Switch
            checked={(data.acceptsReturn as boolean) ?? true}
            onCheckedChange={(v) => onChange('acceptsReturn', v)}
          />
          <Label>Accept returns for spoiled / wrong items</Label>
        </div>
        {(data.acceptsReturn as boolean) && (
          <>
            <div>
              <Label>Return window</Label>
              <div className="flex gap-2 mt-1">
                {['6', '24'].map((h) => {
                  const active = (data.returnWindowHours as string) === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => onChange('returnWindowHours', h)}
                      className={`px-3 py-1.5 rounded text-xs border transition-colors ${
                        active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'
                      }`}
                    >
                      {h} hrs
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="md:col-span-2">
              <Label>Refund mode</Label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {[
                  { v: 'replace-next-delivery', l: 'Replace in next delivery' },
                  { v: 'wallet-credit', l: 'Wallet credit' },
                  { v: 'refund-original', l: 'Refund to original payment' },
                  { v: 'shopkeeper-discretion', l: 'Case by case' },
                ].map((o) => {
                  const active = (data.returnRefundMode as string) === o.v;
                  return (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => onChange('returnRefundMode', o.v)}
                      className={`px-2 py-1 rounded text-xs border transition-colors ${
                        active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'
                      }`}
                    >
                      {o.l}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Payment */}
      <h3 className="text-lg font-semibold border-b border-border pb-2">Payment Collection</h3>
      <div>
        <Label>Accepted payment methods <span className="text-[10px] uppercase tracking-wide text-amber-700 ml-1">COD only</span></Label>
        <Input value="Cash on Delivery" disabled readOnly />
        <p className="text-[10px] text-muted-foreground mt-1">Online payments roll out in a future release.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="opacity-60">
          <Label>UPI ID at the door <span className="text-[10px] uppercase tracking-wide text-muted-foreground ml-1">Coming soon</span></Label>
          <Input
            placeholder="shopname@upi"
            value={(data.upiVPA as string) || ''}
            onChange={(e) => onChange('upiVPA', e.target.value)}
            disabled
          />
          <p className="text-[10px] text-muted-foreground mt-1">Stored for future use. Bot is in COD-only mode &mdash; will not share UPI in customer chat.</p>
        </div>
        <div>
          <Label>Cash change available up to</Label>
          <Input
            placeholder="₹500"
            value={(data.cashChangeAvailableUpto as string) || ''}
            onChange={(e) => onChange('cashChangeAvailableUpto', e.target.value)}
          />
          <p className="text-[10px] text-muted-foreground mt-1">Helps the bot warn customers about ₹2,000 notes.</p>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={(data.cashAtDoor as boolean) ?? true}
            onCheckedChange={(v) => onChange('cashAtDoor', v)}
          />
          <Label>Cash on delivery</Label>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={(data.udhaarAllowedForRegulars as boolean) ?? false}
            onCheckedChange={(v) => onChange('udhaarAllowedForRegulars', v)}
          />
          <Label>Udhaar (credit) for regulars</Label>
        </div>
      </div>
      <div>
        <Label>Minimum order (overall)</Label>
        <Input
          placeholder="₹150"
          value={(data.minimumOrder as string) || ''}
          onChange={(e) => onChange('minimumOrder', e.target.value)}
        />
      </div>
      <div>
        <Label>Serviceable areas (overall description)</Label>
        <Input
          placeholder="3 km radius from shop, all of Sector 14-18"
          value={(data.serviceableAreas as string) || ''}
          onChange={(e) => onChange('serviceableAreas', e.target.value)}
        />
      </div>

      {/* Sub-type-specific extras (progressive disclosure) */}
      {showOrganicFields && (
        <>
          <h3 className="text-lg font-semibold border-b border-border pb-2">Organic Certification</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Certifying body</Label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {['NPOP', 'India-Organic', 'Jaivik-Bharat', 'PGS-India', 'none'].map((b) => {
                  const active = (data.organicCertBody as string) === b;
                  return (
                    <button
                      key={b}
                      type="button"
                      onClick={() => onChange('organicCertBody', b)}
                      className={`px-2 py-1 rounded text-xs border transition-colors ${
                        active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'
                      }`}
                    >
                      {b}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>Certificate number</Label>
              <Input
                placeholder="NPOP/.../2025"
                value={(data.organicCertNumber as string) || ''}
                onChange={(e) => onChange('organicCertNumber', e.target.value)}
              />
            </div>
          </div>
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            ⚠️ Bot will refuse to sell ashwagandha / spirulina / protein supplements / churan-kadha (WhatsApp Commerce Policy bans ingestible supplements).
          </div>
        </>
      )}

      {showMeatFields && (
        <>
          <h3 className="text-lg font-semibold border-b border-border pb-2">Meat / Poultry Certification</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Switch
                checked={(data.jhatkaCertified as boolean) ?? false}
                onCheckedChange={(v) => onChange('jhatkaCertified', v)}
              />
              <Label>Jhatka certified</Label>
            </div>
          </div>
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            ⚠️ WhatsApp Commerce Policy: live animals / live fish cannot be listed. Sell only dressed / cleaned / packaged meat.
          </div>
        </>
      )}

      {showAataChakki && (
        <>
          <h3 className="text-lg font-semibold border-b border-border pb-2">Aata Chakki</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Switch
                checked={(data.byoGrainAllowed as boolean) ?? true}
                onCheckedChange={(v) => onChange('byoGrainAllowed', v)}
              />
              <Label>Customer can bring their own grain</Label>
            </div>
            <div>
              <Label>Grinding fee per kg</Label>
              <Input
                placeholder="₹5"
                value={(data.grindingFeePerKg as string) || ''}
                onChange={(e) => onChange('grindingFeePerKg', e.target.value)}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
