import { ClientConfig, InventoryItem } from './types';
import { upsertItem, getInventory } from './inventory';

// Extract a numeric price from user-entered strings like "₹280", "Rs. 1,200",
// "300/-", "1499 INR". Returns 0 if no number found.
function parsePrice(raw: string | number | undefined): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw !== 'string') return 0;
  const digits = raw.replace(/[^\d.]/g, '').replace(/,/g, '');
  const n = parseFloat(digits);
  return Number.isFinite(n) ? n : 0;
}

export interface SyncResult {
  count: number;
  names: string[];
  skipped: number;
}

// Extract product-like entries from a bot's ClientConfig and upsert each into
// the inventory sheet for this bot. Idempotent — existing items (matched by
// name → slug) are updated with the latest price/notes but keep their
// current stock and low-stock threshold.
export async function syncProductsFromConfig(
  clientId: string,
  config: ClientConfig
): Promise<SyncResult> {
  const toCreate: Array<Partial<InventoryItem> & { name: string; notes?: string }> = [];

  switch (config.type) {
    case 'restaurant':
      for (const cat of config.menuCategories || []) {
        for (const item of cat.items || []) {
          if (!item.name?.trim()) continue;
          toCreate.push({
            name: item.name,
            price: parsePrice(item.price),
            notes: [cat.category, item.description, item.isVeg ? 'veg' : 'non-veg'].filter(Boolean).join(' · '),
          });
        }
      }
      break;

    case 'salon':
      for (const cat of config.services || []) {
        for (const item of cat.items || []) {
          if (!item.name?.trim()) continue;
          toCreate.push({
            name: item.name,
            price: parsePrice(item.price),
            notes: [cat.category, item.duration].filter(Boolean).join(' · '),
          });
        }
      }
      for (const pkg of config.packages || []) {
        if (!pkg.name?.trim()) continue;
        toCreate.push({
          name: pkg.name,
          price: parsePrice(pkg.price),
          notes: ['package', pkg.includes].filter(Boolean).join(' · '),
        });
      }
      break;

    case 'gym':
      for (const plan of config.membershipPlans || []) {
        if (!plan.name?.trim()) continue;
        toCreate.push({
          name: plan.name,
          price: parsePrice(plan.price),
          notes: [plan.duration, plan.includes].filter(Boolean).join(' · '),
        });
      }
      break;

    case 'd2c':
      for (const product of config.products || []) {
        if (!product.name?.trim()) continue;
        toCreate.push({
          name: product.name,
          price: parsePrice(product.price),
          notes: [product.description, product.bestseller ? 'bestseller' : ''].filter(Boolean).join(' · '),
        });
      }
      break;

    case 'coaching':
      for (const course of config.coursesOffered || []) {
        if (!course.name?.trim()) continue;
        toCreate.push({
          name: course.name,
          price: parsePrice(course.fee),
          notes: [course.duration, course.schedule, course.mode].filter(Boolean).join(' · '),
        });
      }
      break;

    case 'realestate':
      for (const listing of config.currentListings || []) {
        if (!listing.title?.trim()) continue;
        toCreate.push({
          name: listing.title,
          price: parsePrice(listing.price),
          notes: [listing.type, listing.area, listing.highlights].filter(Boolean).join(' · '),
        });
      }
      break;
  }

  // Deduplicate by normalized name so one sync doesn't upsert the same item twice.
  const seen = new Set<string>();
  const unique = toCreate.filter((it) => {
    const key = it.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Preserve existing stock on re-sync: upsertItem keeps existing.stock if we
  // don't pass a stock value, so only set stock=0 for brand-new items.
  const existing = await getInventory(clientId).catch(() => [] as InventoryItem[]);
  const existingNames = new Set(existing.map((e) => e.name.trim().toLowerCase()));

  const names: string[] = [];
  let skipped = 0;
  for (const it of unique) {
    try {
      const isNew = !existingNames.has(it.name.trim().toLowerCase());
      await upsertItem({
        client_id: clientId,
        name: it.name.trim(),
        price: it.price,
        notes: it.notes,
        is_active: true,
        ...(isNew ? { stock: 0, low_stock_threshold: 0 } : {}),
      });
      names.push(it.name);
    } catch {
      skipped += 1;
    }
  }

  return { count: names.length, names, skipped };
}
