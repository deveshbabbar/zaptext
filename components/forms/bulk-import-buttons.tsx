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

export function RestaurantMenuBulkImport({ data, onChange }: { data: Data; onChange: OnChange }) {
  const [open, setOpen] = useState(false);
  const existing = (data.menuCategories as Array<{ name?: string; items?: Array<unknown> }>) || [];
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
        textPlaceholder={`STARTERS\nPaneer Tikka     Rs. 249   V\nChicken 65       Rs. 299   NV\nVeg Spring Roll  150\n\nMAIN COURSE\nDal Makhani      280\nButter Chicken   420`}
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'price', label: 'Price', type: 'number' },
          { key: 'veg', label: 'Veg?', type: 'boolean' },
          { key: 'category', label: 'Section' },
        ]}
        existingCount={existingCount}
        onConfirm={(items, mergeMode) => {
          const byCat = new Map<string, Array<Record<string, unknown>>>();
          for (const item of items) {
            const cat = (item.category as string) || 'Menu';
            const list = byCat.get(cat) ?? [];
            list.push({
              name: item.name,
              price: `Rs.${item.price}`,
              description: item.description || '',
              isVeg: item.veg !== false,
              isBestseller: false,
            });
            byCat.set(cat, list);
          }
          const newCategories = Array.from(byCat.entries()).map(([name, list]) => ({ name, items: list }));
          if (mergeMode === 'replace') {
            onChange('menuCategories', newCategories);
            return;
          }
          const merged = [...existing] as Array<{ name?: string; items?: Array<unknown> }>;
          for (const cat of newCategories) {
            const found = merged.find((c) => c.name === cat.name);
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
        textPlaceholder={`JEE Main + Advanced 2-year  Rs.1,80,000   Foundation\nNEET 1-year Crash           Rs.85,000     Crash\nCAT Weekend Batch           Rs.42,000     Hybrid`}
        columns={[
          { key: 'name', label: 'Course' },
          { key: 'duration', label: 'Duration' },
          { key: 'price', label: 'Fee', type: 'number' },
          { key: 'batchType', label: 'Batch type' },
          { key: 'faculty', label: 'Faculty' },
        ]}
        existingCount={existing.length}
        onConfirm={(items, mergeMode) => {
          const transformed = items.map((it) => ({
            name: it.name,
            targetAudience: '',
            duration: it.duration,
            fee: `Rs.${it.price}`,
            schedule: '',
            mode: it.batchType || '',
          }));
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
        textPlaceholder={`HAIR\nHaircut F        Rs.500   45 min\nHair Color       Rs.2,500  90 min\nBlow Dry         Rs.300\n\nBRIDAL\nBridal Makeup    Rs.15,000  3 hr\nMehendi (full)   Rs.5,000`}
        columns={[
          { key: 'name', label: 'Service' },
          { key: 'price', label: 'Price', type: 'number' },
          { key: 'durationMin', label: 'Mins', type: 'number' },
          { key: 'gender', label: 'Gender' },
          { key: 'category', label: 'Section' },
        ]}
        existingCount={existingCount}
        onConfirm={(items, mergeMode) => {
          const byCat = new Map<string, Array<Record<string, unknown>>>();
          for (const item of items) {
            const cat = (item.category as string) || 'Services';
            const list = byCat.get(cat) ?? [];
            list.push({
              name: item.name,
              price: `Rs.${item.price}`,
              duration: item.durationMin ? `${item.durationMin} min` : '',
            });
            byCat.set(cat, list);
          }
          const newCategories = Array.from(byCat.entries()).map(([category, list]) => ({ category, items: list }));
          if (mergeMode === 'replace') {
            onChange('services', newCategories);
            return;
          }
          const merged = [...existing] as Array<{ category?: string; items?: Array<unknown> }>;
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
        textPlaceholder={`SKU-001  Cotton Kurta L       Rs.1,499  MRP 1,999  stock 25  Fashion\nSKU-002  Silk Saree Red       Rs.4,299  MRP 5,999  stock 8   Fashion\nSKU-101  Vitamin C Serum 30ml Rs.799   MRP 1,200  stock 60  Beauty`}
        columns={[
          { key: 'sku', label: 'SKU' },
          { key: 'name', label: 'Name' },
          { key: 'price', label: 'Price', type: 'number' },
          { key: 'mrp', label: 'MRP', type: 'number' },
          { key: 'stock', label: 'Stock', type: 'number' },
          { key: 'category', label: 'Category' },
        ]}
        existingCount={existing.length}
        onConfirm={(items, mergeMode) => {
          const transformed = items.map((it) => ({
            name: it.name,
            price: `Rs.${it.price}`,
            description: it.description || '',
            category: it.category || '',
            bestseller: false,
            inStock: true,
            sku: it.sku || '',
            mrp: it.mrp ? `Rs.${it.mrp}` : '',
            stock: it.stock || 0,
          }));
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
        textPlaceholder={`Basmati Rice 1kg     Rs.180  Rice & Grains\nAtta Aashirvaad 5kg  Rs.290  Atta\nToor Dal 1kg         Rs.140  Dal\nAmul Milk 1L         Rs.66   Dairy\nLays Classic 80g     Rs.20   Snacks`}
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'price', label: 'Price', type: 'number' },
          { key: 'unit', label: 'Unit' },
          { key: 'category', label: 'Category' },
        ]}
        existingCount={existingNames.length}
        onConfirm={(items, mergeMode) => {
          // Onboarding form stores defaultProducts as a string[] of names.
          // Full pricing/units get re-imported into grocery_products from the
          // admin /admin/grocery/products page after onboarding.
          const names = items.map((it) => String(it.name || '')).filter(Boolean);
          // Preserve the full structured payload so the onboarding API can
          // optionally seed grocery_products on first bot creation.
          const fullRows = items.map((it) => ({
            id: genId(),
            name: it.name,
            price: it.price,
            unit: it.unit || 'piece',
            category: it.category || '',
            inStock: true,
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
