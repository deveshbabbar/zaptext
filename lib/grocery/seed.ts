// lib/grocery/seed.ts
//
// On first onboarding for a grocery client, seed sane defaults so the
// owner sees something useful immediately:
//   - Two default delivery slots (next-day morning + same-day evening).
//   - One catch-all delivery zone (any pin code) the owner can edit.
//   - A starter set of common products (the owner deletes what they
//     don't sell). Saves the "empty admin" first-impression problem.

import { createSlot } from '../db/grocery-slots';
import { createZone } from '../db/grocery-zones';
import { createProduct } from '../db/grocery-products';

const DEFAULT_PRODUCTS: Array<{ name: string; aliases: string[]; unit: 'kg' | 'piece' | 'dozen' | 'bunch' }> = [
  { name: 'tamatar', aliases: ['tomato', 'tameta'], unit: 'kg' },
  { name: 'pyaaz', aliases: ['onion'], unit: 'kg' },
  { name: 'aloo', aliases: ['potato'], unit: 'kg' },
  { name: 'gobhi', aliases: ['cauliflower'], unit: 'kg' },
  { name: 'palak', aliases: ['spinach'], unit: 'bunch' },
  { name: 'methi', aliases: ['fenugreek'], unit: 'bunch' },
  { name: 'bhindi', aliases: ['okra'], unit: 'kg' },
  { name: 'baingan', aliases: ['brinjal', 'eggplant'], unit: 'kg' },
  { name: 'mirch', aliases: ['hari mirch', 'green chilli'], unit: 'kg' },
  { name: 'dhaniya', aliases: ['coriander'], unit: 'bunch' },
  { name: 'adrak', aliases: ['ginger'], unit: 'kg' },
  { name: 'lehsun', aliases: ['garlic'], unit: 'kg' },
  { name: 'nimbu', aliases: ['lemon'], unit: 'piece' },
  { name: 'kela', aliases: ['banana'], unit: 'dozen' },
];

export async function seedGroceryClient(client_id: string): Promise<void> {
  await createSlot({
    client_id,
    label: 'Tomorrow 7-9am',
    start_time: '07:00',
    end_time: '09:00',
    cutoff_time: '21:00',
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
    is_active: true,
  });
  await createSlot({
    client_id,
    label: 'Today 5-8pm',
    start_time: '17:00',
    end_time: '20:00',
    cutoff_time: '15:00',
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
    is_active: true,
  });
  await createZone({
    client_id,
    label: 'Default zone',
    pincode: null,
    area_keywords: [],
    delivery_fee: 20,
    min_order_for_free_delivery: 300,
    min_order: 100,
  });
  for (const p of DEFAULT_PRODUCTS) {
    await createProduct({
      client_id,
      name: p.name,
      name_aliases: p.aliases,
      unit: p.unit,
    });
  }
}
