'use client';

// Per-vertical "Bulk import" trigger buttons.
// Each is a wrapper around <BulkImportModal>: owns modal open state,
// defines preview columns + placeholder, and transforms canonical parsed
// rows into the vertical's storage shape used by the form's DynamicList.

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { BulkImportModal } from './bulk-import-modal';

type OnChange = (field: string, value: unknown) => void;
type Data = Record<string, unknown>;

function genId() {
  return `bi-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Restaurant ─────────────────────────────────────────────────────────

function formatPriceWithSizes(price: number, sizes?: Array<{ label: string; price: number }>): string {
  if (!sizes || sizes.length === 0) return `Rs.${price}`;
  // Render as "Half Rs.200 / Full Rs.380" so the bot can quote each variant inline.
  return sizes.map((s) => `${s.label} Rs.${s.price}`).join(' / ');
}

function sizesToText(sizes?: Array<{ label: string; price: number }>): string {
  if (!sizes || sizes.length === 0) return '';
  return sizes.map((s) => `${s.label}:${s.price}`).join(', ');
}

function textToSizes(text: string): Array<{ label: string; price: number }> | undefined {
  const parts = text.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return undefined;
  const out: Array<{ label: string; price: number }> = [];
  for (const p of parts) {
    const [label, priceRaw] = p.split(':').map((s) => s.trim());
    if (!label || !priceRaw) continue;
    const price = parseFloat(priceRaw.replace(/[^\d.]/g, ''));
    if (!Number.isFinite(price) || price <= 0) continue;
    out.push({ label, price });
  }
  return out.length > 0 ? out : undefined;
}

export function RestaurantMenuBulkImport({ data, onChange }: { data: Data; onChange: OnChange }) {
  const [open, setOpen] = useState(false);
  const existing = (data.menuCategories as Array<{ category?: string; items?: Array<unknown> }>) || [];
  const existingCount = existing.reduce((n, c) => n + (Array.isArray(c.items) ? c.items.length : 0), 0);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Bulk import menu
      </Button>
      <BulkImportModal
        open={open}
        onClose={() => setOpen(false)}
        vertical="restaurant"
        title="Import menu items"
        sectionLabel="Restaurant menu"
        textPlaceholder={`STARTERS\nPaneer Tikka       Rs. 249   V\nChicken 65         Rs. 299   NV\n\nBIRYANI\nChicken Biryani   Half 220 / Full 380\nVeg Biryani       Half 180 / Full 320\n\nPIZZA\nMargherita        Small 199 / Medium 349 / Large 499`}
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'price', label: 'Base price', type: 'number' },
          { key: 'sizes', label: 'Sizes (Half:200, Full:380)' },
          { key: 'veg', label: 'Veg?', type: 'boolean' },
          { key: 'category', label: 'Section' },
        ]}
        existingCount={existingCount}
        // Preview-table edits flow back as strings; we transform the "sizes" cell
        // back into the structured array on confirm so the form gets a clean shape.
        beforeRowToForm={(row) => {
          const sizesText = String(row.sizes ?? '');
          return { ...row, sizes: sizesText ? textToSizes(sizesText) : undefined };
        }}
        rowFromItem={(item) => ({ ...item, sizes: sizesToText(item.sizes as Array<{ label: string; price: number }> | undefined) })}
        onConfirm={(items, mergeMode) => {
          // Group rows by category. If NO item has a category, everything
          // collapses into a single "Menu" bucket — this is what the user
          // expects when the input has no section headers (e.g., a flat
          // price list pasted from WhatsApp).
          const anyHasCat = items.some((it) => !!(it.category && String(it.category).trim()));
          const byCat = new Map<string, Array<Record<string, unknown>>>();
          for (const item of items) {
            const rawCat = String(item.category ?? '').trim();
            const cat = anyHasCat ? (rawCat || 'Other') : 'Menu';
            const sizes = item.sizes as Array<{ label: string; price: number }> | undefined;
            const list = byCat.get(cat) ?? [];
            list.push({
              name: item.name,
              price: formatPriceWithSizes(Number(item.price) || 0, sizes),
              description: item.description || '',
              isVeg: item.veg !== false,
              isBestseller: false,
              sizes: sizes ?? null,
            });
            byCat.set(cat, list);
          }
          // Form's stored shape uses `category` (string) — NOT `name` — for the section.
          // Earlier versions wrote `name` here, which silently lost section labels.
          const newCategories = Array.from(byCat.entries()).map(([category, list]) => ({ category, items: list }));
          if (mergeMode === 'replace') {
            onChange('menuCategories', newCategories);
            return;
          }
          // Append: merge by category label. Drop the form's default empty-row
          // placeholder so users don't see "<blank>" + their real sections.
          const merged = (existing || []).filter(
            (c) => (c.category || '').trim() !== '' || (Array.isArray(c.items) && c.items.some((it) => it && (it as Record<string, unknown>).name))
          ) as Array<{ category?: string; items?: Array<unknown> }>;
          for (const cat of newCategories) {
            const found = merged.find((c) => c.category === cat.category);
            if (found) {
              found.items = [...(found.items || []), ...cat.items];
            } else {
              merged.push(cat);
            }
          }
          onChange('menuCategories', merged);
        }}
      />
    </>
  );
}

// ─── Coaching ───────────────────────────────────────────────────────────

export function CoachingCoursesBulkImport({ data, onChange }: { data: Data; onChange: OnChange }) {
  const [open, setOpen] = useState(false);
  const existing = (data.coursesOffered as Array<Record<string, unknown>>) || [];

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Bulk import courses
      </Button>
      <BulkImportModal
        open={open}
        onClose={() => setOpen(false)}
        vertical="coaching"
        title="Import courses"
        sectionLabel="Coaching course list"
        textPlaceholder={`JEE Main + Advanced 2-year   Online 1,40,000 / Offline 1,80,000\nNEET 1-year Crash            Rs.85,000\nCAT Weekend                  Standard 42,000 / Premium 65,000`}
        columns={[
          { key: 'name', label: 'Course' },
          { key: 'duration', label: 'Duration' },
          { key: 'price', label: 'Base fee', type: 'number' },
          { key: 'variants', label: 'Variants (Online:40000, Offline:60000)' },
          { key: 'batchType', label: 'Batch type' },
          { key: 'faculty', label: 'Faculty' },
        ]}
        existingCount={existing.length}
        rowFromItem={(item) => ({ ...item, variants: sizesToText(item.variants as Array<{ label: string; price: number }> | undefined) })}
        beforeRowToForm={(row) => {
          const variantsText = String(row.variants ?? '');
          return { ...row, variants: variantsText ? textToSizes(variantsText) : undefined };
        }}
        onConfirm={(items, mergeMode) => {
          const transformed = items.map((it) => {
            const variants = it.variants as Array<{ label: string; price: number }> | undefined;
            const basePrice = Number(it.price) || 0;
            return {
              name: it.name,
              targetAudience: '',
              duration: it.duration,
              fee: formatPriceWithSizes(basePrice, variants),
              schedule: '',
              mode: it.batchType || '',
              variants: variants ?? null,
            };
          });
          onChange('coursesOffered', mergeMode === 'replace' ? transformed : [...existing, ...transformed]);
        }}
      />
    </>
  );
}

// ─── Real Estate ────────────────────────────────────────────────────────

export function RealEstateListingsBulkImport({ data, onChange }: { data: Data; onChange: OnChange }) {
  const [open, setOpen] = useState(false);
  const existing = (data.currentListings as Array<Record<string, unknown>>) || [];

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Bulk import listings
      </Button>
      <BulkImportModal
        open={open}
        onClose={() => setOpen(false)}
        vertical="realestate"
        title="Import property listings"
        sectionLabel="Current listings"
        textPlaceholder={`3BHK Whitefield  1450 sqft  1.2 Cr   sale   RERA: PRM/KA/RERA/...\n2BHK HSR Layout  Rs.35,000/month  rent\nPlot 1200 sqft  Sarjapur  85 Lakh  sale`}
        columns={[
          { key: 'title', label: 'Title' },
          { key: 'listingType', label: 'Sale/Rent' },
          { key: 'propertyType', label: 'Type' },
          { key: 'bhk', label: 'BHK' },
          { key: 'builtUpArea', label: 'Area (sqft)', type: 'number' },
          { key: 'price', label: 'Price (INR)', type: 'number' },
          { key: 'location', label: 'Location' },
          { key: 'reraNumber', label: 'RERA' },
        ]}
        existingCount={existing.length}
        onConfirm={(items, mergeMode) => {
          const transformed = items.map((it) => ({
            title: it.title,
            type: it.listingType,
            price: it.price ? `Rs.${it.price}` : '',
            area: it.builtUpArea ? `${it.builtUpArea} sqft` : it.carpetArea ? `${it.carpetArea} sqft (carpet)` : '',
            highlights: [it.bhk, it.location, it.reraNumber ? `RERA ${it.reraNumber}` : null].filter(Boolean).join(' | '),
          }));
          onChange('currentListings', mergeMode === 'replace' ? transformed : [...existing, ...transformed]);
        }}
      />
    </>
  );
}

// ─── Salon ──────────────────────────────────────────────────────────────

export function SalonServicesBulkImport({ data, onChange }: { data: Data; onChange: OnChange }) {
  const [open, setOpen] = useState(false);
  const existing = (data.services as Array<{ category?: string; items?: Array<unknown> }>) || [];
  const existingCount = existing.reduce((n, c) => n + (Array.isArray(c.items) ? c.items.length : 0), 0);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Bulk import services
      </Button>
      <BulkImportModal
        open={open}
        onClose={() => setOpen(false)}
        vertical="salon"
        title="Import salon services"
        sectionLabel="Service menu"
        textPlaceholder={`HAIR\nHaircut          Short 500 / Long 800     45 min\nHair Color       Short 1500 / Long 2500   90 min\nBlow Dry         Rs.300\n\nBRIDAL\nMehendi          Half 2500 / Full 5000\nBridal Makeup    Rs.15,000  3 hr`}
        columns={[
          { key: 'name', label: 'Service' },
          { key: 'price', label: 'Base price', type: 'number' },
          { key: 'variants', label: 'Variants (Short:500, Long:800)' },
          { key: 'durationMin', label: 'Mins', type: 'number' },
          { key: 'gender', label: 'Gender' },
          { key: 'category', label: 'Section' },
        ]}
        existingCount={existingCount}
        rowFromItem={(item) => ({ ...item, variants: sizesToText(item.variants as Array<{ label: string; price: number }> | undefined) })}
        beforeRowToForm={(row) => {
          const variantsText = String(row.variants ?? '');
          return { ...row, variants: variantsText ? textToSizes(variantsText) : undefined };
        }}
        onConfirm={(items, mergeMode) => {
          const anyHasCat = items.some((it) => !!(it.category && String(it.category).trim()));
          const byCat = new Map<string, Array<Record<string, unknown>>>();
          for (const item of items) {
            const rawCat = String(item.category ?? '').trim();
            const cat = anyHasCat ? (rawCat || 'Other') : 'Services';
            const variants = item.variants as Array<{ label: string; price: number }> | undefined;
            const list = byCat.get(cat) ?? [];
            list.push({
              name: item.name,
              price: formatPriceWithSizes(Number(item.price) || 0, variants),
              duration: item.durationMin ? `${item.durationMin} min` : '',
              variants: variants ?? null,
            });
            byCat.set(cat, list);
          }
          const newCategories = Array.from(byCat.entries()).map(([category, list]) => ({ category, items: list }));
          if (mergeMode === 'replace') {
            onChange('services', newCategories);
            return;
          }
          // Drop the form's default empty-row placeholder so Append doesn't leave a blank section.
          const merged = (existing || []).filter(
            (c) => (c.category || '').trim() !== '' || (Array.isArray(c.items) && c.items.some((it) => it && (it as Record<string, unknown>).name))
          ) as Array<{ category?: string; items?: Array<unknown> }>;
          for (const cat of newCategories) {
            const found = merged.find((c) => c.category === cat.category);
            if (found) {
              found.items = [...(found.items || []), ...cat.items];
            } else {
              merged.push(cat);
            }
          }
          onChange('services', merged);
        }}
      />
    </>
  );
}

// ─── Gym ────────────────────────────────────────────────────────────────

export function GymPlansBulkImport({ data, onChange }: { data: Data; onChange: OnChange }) {
  const [open, setOpen] = useState(false);
  const existing = (data.membershipPlans as Array<Record<string, unknown>>) || [];

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Bulk import plans
      </Button>
      <BulkImportModal
        open={open}
        onClose={() => setOpen(false)}
        vertical="gym"
        title="Import membership plans"
        sectionLabel="Membership pricing"
        textPlaceholder={`Monthly         Rs.2,000   1 month\nQuarterly       Rs.5,000   3 months\nAnnual          Rs.15,000  12 months  PT included\nClasses-only    Rs.1,500   yoga + zumba`}
        columns={[
          { key: 'name', label: 'Plan' },
          { key: 'duration', label: 'Duration' },
          { key: 'price', label: 'Price', type: 'number' },
          { key: 'includesPT', label: 'PT?', type: 'boolean' },
          { key: 'includesClasses', label: 'Classes' },
        ]}
        existingCount={existing.length}
        onConfirm={(items, mergeMode) => {
          const transformed = items.map((it) => ({
            name: it.name,
            duration: it.duration,
            price: `Rs.${it.price}`,
            includes: [it.includesPT ? 'PT' : null, it.includesClasses].filter(Boolean).join(', '),
          }));
          onChange('membershipPlans', mergeMode === 'replace' ? transformed : [...existing, ...transformed]);
        }}
      />
    </>
  );
}

// ─── Tiffin ─────────────────────────────────────────────────────────────

export function TiffinPlansBulkImport({ data, onChange }: { data: Data; onChange: OnChange }) {
  const [open, setOpen] = useState(false);
  const existing = (data.plans as Array<Record<string, unknown>>) || [];

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Bulk import plans
      </Button>
      <BulkImportModal
        open={open}
        onClose={() => setOpen(false)}
        vertical="tiffin"
        title="Import tiffin plans"
        sectionLabel="Subscription plans"
        textPlaceholder={`Monthly Lunch       Rs.2,500   monthly  veg\nMonthly Lunch+Dinner Rs.4,500   monthly  veg\nWeekly Trial        Rs.700     weekly   veg + jain option`}
        columns={[
          { key: 'name', label: 'Plan' },
          { key: 'duration', label: 'Duration' },
          { key: 'price', label: 'Price', type: 'number' },
          { key: 'mealsPerDay', label: 'Meals/day', type: 'number' },
          { key: 'mealType', label: 'Meal' },
          { key: 'veg', label: 'Veg?', type: 'boolean' },
        ]}
        existingCount={existing.length}
        onConfirm={(items, mergeMode) => {
          const transformed = items.map((it) => ({
            name: it.name,
            duration: it.duration,
            price: `Rs.${it.price}`,
            includes: '',
            mealType: it.mealType || '',
            foodType: it.veg === false ? 'non-veg' : 'veg',
          }));
          onChange('plans', mergeMode === 'replace' ? transformed : [...existing, ...transformed]);
        }}
      />
    </>
  );
}

// ─── Ecommerce ──────────────────────────────────────────────────────────

export function EcommerceProductsBulkImport({ data, onChange }: { data: Data; onChange: OnChange }) {
  const [open, setOpen] = useState(false);
  const existing = (data.products as Array<Record<string, unknown>>) || [];

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Bulk import products
      </Button>
      <BulkImportModal
        open={open}
        onClose={() => setOpen(false)}
        vertical="ecommerce"
        title="Import products"
        sectionLabel="Product catalog"
        textPlaceholder={`SKU-001  Cotton Kurta       S 999 / M 999 / L 1099 / XL 1199    MRP 1,499  Fashion\nSKU-002  Vitamin C Serum   30ml 799 / 50ml 1,199 / 100ml 1,999  Beauty\nSKU-101  Almonds            250g 220 / 500g 420 / 1kg 800        Grocery`}
        columns={[
          { key: 'sku', label: 'SKU' },
          { key: 'name', label: 'Name' },
          { key: 'price', label: 'Base price', type: 'number' },
          { key: 'variants', label: 'Variants (S:999, M:999, L:1099)' },
          { key: 'mrp', label: 'MRP', type: 'number' },
          { key: 'stock', label: 'Stock', type: 'number' },
          { key: 'category', label: 'Category' },
        ]}
        existingCount={existing.length}
        rowFromItem={(item) => ({ ...item, variants: sizesToText(item.variants as Array<{ label: string; price: number }> | undefined) })}
        beforeRowToForm={(row) => {
          const variantsText = String(row.variants ?? '');
          return { ...row, variants: variantsText ? textToSizes(variantsText) : undefined };
        }}
        onConfirm={(items, mergeMode) => {
          const transformed = items.map((it) => {
            const variants = it.variants as Array<{ label: string; price: number }> | undefined;
            const basePrice = Number(it.price) || 0;
            return {
              name: it.name,
              price: formatPriceWithSizes(basePrice, variants),
              description: it.description || '',
              category: it.category || '',
              bestseller: false,
              inStock: true,
              sku: it.sku || '',
              mrp: it.mrp ? `Rs.${it.mrp}` : '',
              stock: it.stock || 0,
              variants: variants ?? null,
            };
          });
          onChange('products', mergeMode === 'replace' ? transformed : [...existing, ...transformed]);
        }}
      />
    </>
  );
}

// ─── Grocery ────────────────────────────────────────────────────────────

export function GroceryProductsBulkImport({ data, onChange }: { data: Data; onChange: OnChange }) {
  const [open, setOpen] = useState(false);
  const existingNames = (data.defaultProducts as string[]) || [];

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Bulk import products
      </Button>
      <BulkImportModal
        open={open}
        onClose={() => setOpen(false)}
        vertical="grocery"
        title="Import grocery products"
        sectionLabel="Common everyday products"
        textPlaceholder={`Aashirvaad Atta      1kg 290 / 5kg 1290 / 10kg 2400    Atta\nAmul Milk            500ml 35 / 1L 66                  Dairy\nToor Dal Tata        500g 90 / 1kg 175                 Dal\nLays Classic         30g 10 / 80g 20 / Party Pack 75   Snacks\nBasmati Rice         1kg 180                           Rice & Grains`}
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'price', label: 'Base price', type: 'number' },
          { key: 'unit', label: 'Smallest pack' },
          { key: 'variants', label: 'Pack sizes (1kg:290, 5kg:1290)' },
          { key: 'category', label: 'Category' },
        ]}
        existingCount={existingNames.length}
        rowFromItem={(item) => ({ ...item, variants: sizesToText(item.variants as Array<{ label: string; price: number }> | undefined) })}
        beforeRowToForm={(row) => {
          const variantsText = String(row.variants ?? '');
          return { ...row, variants: variantsText ? textToSizes(variantsText) : undefined };
        }}
        onConfirm={(items, mergeMode) => {
          // Onboarding form stores defaultProducts as a string[] of names only.
          // The structured payload (with variants and per-pack pricing) is stashed
          // in groceryProductsToSeed for later seeding into grocery_products from
          // the admin /admin/grocery/products page.
          const names = items.map((it) => String(it.name || '')).filter(Boolean);
          const fullRows = items.map((it) => ({
            id: genId(),
            name: it.name,
            price: it.price,
            unit: it.unit || 'piece',
            category: it.category || '',
            inStock: true,
            variants: it.variants ?? null,
          }));
          if (mergeMode === 'replace') {
            onChange('defaultProducts', names);
            onChange('groceryProductsToSeed', fullRows);
          } else {
            onChange('defaultProducts', [...existingNames, ...names]);
            const prevSeed = (data.groceryProductsToSeed as Array<Record<string, unknown>>) || [];
            onChange('groceryProductsToSeed', [...prevSeed, ...fullRows]);
          }
        }}
      />
    </>
  );
}
