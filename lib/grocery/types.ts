// lib/grocery/types.ts
//
// Type definitions for the grocery vertical. DB row shapes live in
// lib/db/grocery-*.ts; these are the application-layer shapes used by
// parsers, pricing logic, webhook handlers, and admin UI.

export type GroceryUnit = 'kg' | 'g' | 'piece' | 'dozen' | 'bunch';

export interface GroceryProduct {
  id: string;
  client_id: string;
  name: string;
  name_aliases: string[];
  unit: GroceryUnit;
  image_url: string | null;
  created_at: string; // ISO
}

export interface DailyCatalogRow {
  id: string;
  client_id: string;
  product_id: string;
  date: string; // YYYY-MM-DD
  price_per_unit: number;
  in_stock: boolean;
  stock_qty: number | null;
  updated_at: string;
}

// Joined view of catalog row + product, used by the customer flow.
export interface CatalogEntry {
  product: GroceryProduct;
  price_per_unit: number;
  in_stock: boolean;
  stock_qty: number | null;
}

// Output of catalog-parser.ts — owner's voice/text update.
export interface ParsedCatalogItem {
  name: string; // raw, not yet matched against products
  price: number;
  unit: GroceryUnit;
  in_stock: boolean;
}

// Output of cart-parser.ts — customer's order text.
export interface ParsedCartItem {
  name: string; // raw
  qty: number;
  unit: GroceryUnit;
}

// Resolved cart item after matching against today's catalog.
export interface CartItem {
  product_id: string;
  name: string;
  qty: number;
  unit: GroceryUnit;
  price_per_unit: number;
  line_total: number;
}

export interface GroceryZone {
  id: string;
  client_id: string;
  label: string;
  pincode: string | null;
  area_keywords: string[];
  delivery_fee: number;
  min_order_for_free_delivery: number | null;
  min_order: number | null;
}

export interface GrocerySlot {
  id: string;
  client_id: string;
  label: string;
  start_time: string; // HH:MM
  end_time: string;
  cutoff_time: string;
  days_of_week: number[]; // 0=Sunday
  is_active: boolean;
}

export interface OrderTotals {
  subtotal: number;
  delivery_fee: number;
  total: number;
  free_delivery_applied: boolean;
}

export type OrderStatus = 'pending' | 'confirmed' | 'packed' | 'delivered' | 'cancelled';
export type PaymentMode = 'cod'; // extensible: 'upi' | 'online' in v2/v3

export interface GroceryOrder {
  id: string;
  client_id: string;
  customer_phone: string;
  customer_name: string | null;
  delivery_address: string;
  zone_id: string;
  slot_id: string;
  slot_date: string;
  items: CartItem[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  status: OrderStatus;
  payment_mode: PaymentMode;
  notes: string | null;
  created_at: string;
}

export interface CartDraft {
  customer_phone: string;
  client_id: string;
  items: CartItem[];
  zone_id: string | null;
  slot_id: string | null;
  slot_date: string | null;
  delivery_address: string | null;
  customer_name: string | null;
  expires_at: string;
}

export interface SubstitutionGroup {
  id: string;
  client_id: string;
  name: string;
  product_ids: string[];
}

export interface RecurringOrder {
  id: string;
  client_id: string;
  customer_phone: string;
  day_of_week: number;
  slot_id: string;
  template_items: CartItem[];
  is_active: boolean;
  last_run_date: string | null;
}
