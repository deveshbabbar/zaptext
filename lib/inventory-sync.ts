import { ClientConfig, InventoryItem } from './types';
import { batchUpsertItems, getInventory, getActiveInventory } from './inventory';
import { getClientById, updateClientFields } from './google-sheets';
import { generateSystemPrompt } from './prompt-generator';
import { seedDefaultsForVertical } from './db/inventory-categories';

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
  // Make sure the per-client category list exists before any item upsert,
  // so each pushed item lands in a real category row (and the inventory
  // page can group by them on the very first render). Idempotent.
  await seedDefaultsForVertical(clientId, config.type).catch((e) => {
    // Non-fatal — sync still proceeds with empty categories. The owner
    // can add categories manually later.
    console.error('[inventory-sync] seedDefaultsForVertical failed:', e);
  });

  const toCreate: Array<
    Partial<InventoryItem> & { name: string; notes?: string; category?: string; tracks_stock?: boolean }
  > = [];

  switch (config.type) {
    case 'restaurant':
      for (const cat of config.menuCategories || []) {
        for (const item of cat.items || []) {
          if (!item.name?.trim()) continue;
          toCreate.push({
            name: item.name,
            price: parsePrice(item.price),
            notes: [cat.category, item.description, item.isVeg ? 'veg' : 'non-veg'].filter(Boolean).join(' · '),
            category: 'Menu',
            tracks_stock: true,
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
            category: 'Services',
            tracks_stock: false,
          });
        }
      }
      for (const pkg of config.packages || []) {
        if (!pkg.name?.trim()) continue;
        toCreate.push({
          name: pkg.name,
          price: parsePrice(pkg.price),
          notes: ['package', pkg.includes].filter(Boolean).join(' · '),
          category: 'Packages',
          tracks_stock: false,
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
          category: 'Membership Plans',
          tracks_stock: false,
        });
      }
      // Personal training as a single line-item if the gym offers it.
      if (config.personalTraining?.available) {
        toCreate.push({
          name: 'Personal Training',
          price: parsePrice(config.personalTraining.pricePerSession),
          notes: config.personalTraining.trainerInfo || '',
          category: 'Personal Training',
          tracks_stock: false,
        });
      }
      // Group classes — each class becomes its own item under "Group Classes".
      for (const cls of config.groupClasses || []) {
        const name = typeof cls === 'string' ? cls : '';
        if (!name.trim()) continue;
        toCreate.push({
          name,
          price: 0,
          notes: 'Group class',
          category: 'Group Classes',
          tracks_stock: false,
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
          category: 'Products',
          tracks_stock: true,
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
          category: 'Courses',
          tracks_stock: false,
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
          category: 'Listings',
          tracks_stock: false,
        });
      }
      break;

    case 'tiffin':
      for (const plan of config.plans || []) {
        if (!plan.name?.trim()) continue;
        toCreate.push({
          name: plan.name,
          price: parsePrice(plan.price),
          notes: [plan.duration, plan.mealType, plan.foodType, plan.includes].filter(Boolean).join(' · '),
          category: 'Plans',
          tracks_stock: false,
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

  // Preserve existing stock on re-sync: batchUpsertItems keeps existing.stock
  // if we don't pass a stock value, so only set stock=0 for brand-new items.
  const existing = await getInventory(clientId).catch(() => [] as InventoryItem[]);
  const existingNames = new Set(existing.map((e) => e.name.trim().toLowerCase()));

  const inputs = unique.map((it) => {
    const isNew = !existingNames.has(it.name.trim().toLowerCase());
    return {
      client_id: clientId,
      name: it.name.trim(),
      price: it.price,
      notes: it.notes,
      category: it.category,
      tracks_stock: it.tracks_stock,
      is_active: true as const,
      // Only seed stock=0 for stock-tracked items; service categories
      // shouldn't show "0 left" in the UI on first sync.
      ...(isNew && it.tracks_stock !== false ? { stock: 0, low_stock_threshold: 0 } : {}),
    };
  });

  const { written, skipped } = await batchUpsertItems(inputs);
  const names = inputs.slice(0, written).map((i) => i.name);

  return { count: written, names, skipped };
}

// ─── Reverse direction: mirror live inventory → knowledge_base_json ───
// Called after every /api/client/inventory mutation so the static KB JSON the
// owner sees in /client/settings stays in sync with what they added/edited via
// the inventory page. The bot also gets this list at runtime in its system
// prompt (separate from the live-stock injection in webhook), so reading the
// KB is enough to know what the bot knows.
//
// We write to a generic `inventoryItems` field (flat list) — type-specific
// fields like menuCategories/products/membershipPlans stay untouched, since
// those came from the onboarding form and have richer per-vertical structure.
export async function mirrorInventoryToKb(clientId: string): Promise<void> {
  const client = await getClientById(clientId);
  if (!client) return;

  const items = await getActiveInventory(clientId).catch(() => [] as InventoryItem[]);

  let kb: Record<string, unknown> = {};
  try {
    kb = JSON.parse(client.knowledge_base_json || '{}');
    if (!kb || typeof kb !== 'object' || Array.isArray(kb)) kb = {};
  } catch {
    // Corrupt KB — start fresh rather than crash the inventory mutation.
    kb = {};
  }

  // Snapshot a compact, prompt-friendly subset. Skip stock count here: stock is
  // volatile and mirroring it would churn the KB on every order. The bot still
  // gets live stock via the webhook's runtime injection.
  kb.inventoryItems = items.map((i) => ({
    name: i.name,
    price: i.price,
    notes: i.notes || '',
    available: (() => {
      const w = (i.available_from || '') + '-' + (i.available_to || '');
      const days = (i.available_days || []).join(',');
      if (!i.available_from && !i.available_to && !days) return '';
      return `${w}${days ? ` ${days}` : ''}`.trim();
    })(),
  }));

  const newKbJson = JSON.stringify(kb);
  // Regenerate system_prompt so the bot's static prompt also reflects the
  // updated inventory list (in addition to the runtime live-stock injection).
  const newPrompt = generateSystemPrompt(kb as unknown as ClientConfig);

  await updateClientFields(clientId, {
    knowledge_base_json: newKbJson,
    system_prompt: newPrompt,
  });
}
