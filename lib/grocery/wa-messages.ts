// lib/grocery/wa-messages.ts
//
// Composes WhatsApp interactive payloads from grocery domain objects.
// Pure formatting; the actual HTTP send lives in lib/whatsapp.ts.
// Callers (customer-handler.ts, owner-handler.ts) feed the output of
// these helpers into sendInteractiveList / sendInteractiveButtons /
// sendWhatsAppMessage from lib/whatsapp.ts.

import type { CatalogEntry, CartItem, GroceryOrder } from './types';
import type { AvailableSlot } from './slots';
import type { ListSection } from '../whatsapp';

// Meta's WhatsApp interactive list caps: 10 sections, 10 rows per section.
// We only ever populate one section in the typical "today's catalog" flow
// (catalogs <=10 items), but support multi-section fallback for clients
// with bigger lists.
const ROW_LIMIT_PER_SECTION = 10;
const SECTION_LIMIT = 10;

// Turns today's in-stock catalog into list sections suitable for
// sendInteractiveList. Out-of-stock entries are filtered so customers
// don't tap something we can't fulfil. Row id encodes the product_id
// so the inbound webhook handler can route the tap with O(1) lookup
// (no name-matching needed for taps).
export function catalogToListSections(catalog: CatalogEntry[]): ListSection[] {
  const inStock = catalog.filter((c) => c.in_stock);
  if (inStock.length === 0) return [];
  const sections: ListSection[] = [];
  for (
    let i = 0;
    i < inStock.length && sections.length < SECTION_LIMIT;
    i += ROW_LIMIT_PER_SECTION
  ) {
    const chunk = inStock.slice(i, i + ROW_LIMIT_PER_SECTION);
    sections.push({
      title: sections.length === 0 ? 'Aaj ki list' : `Page ${sections.length + 1}`,
      rows: chunk.map((c) => ({
        id: `add:${c.product.id}`,
        title: c.product.name.slice(0, 24),
        description: `₹${c.price_per_unit}/${c.product.unit}`,
      })),
    });
  }
  return sections;
}

// Three-button quantity picker shown after the customer taps a product.
// Quantities are kg-biased because that's what most Indian grocery
// catalogs price by. Future: branch on product.unit so a 'piece' product
// (eggs, bread) gets 1/6/12 instead of 500g/1kg/2kg.
export function qtyButtonsForProduct(productId: string): Array<{ id: string; title: string }> {
  return [
    { id: `qty:${productId}:0.5`, title: '500g' },
    { id: `qty:${productId}:1`, title: '1kg' },
    { id: `qty:${productId}:2`, title: '2kg' },
  ];
}

// Up to 3 slot buttons (Meta's button cap) — the slots module already
// caps at MAX_OFFERED=3 so we just map. id encodes both slot_id and
// slot_date so the handler doesn't have to redo "what's tomorrow".
export function slotButtons(slots: AvailableSlot[]): Array<{ id: string; title: string }> {
  return slots.slice(0, 3).map((s) => ({
    id: `slot:${s.slot_id}:${s.slot_date}`,
    title: s.label.slice(0, 20),
  }));
}

export function formatCartSummary(items: CartItem[]): string {
  if (items.length === 0) return 'Cart khaali hai.';
  const lines = items.map((i) => `• ${i.name} ${formatQty(i.qty, i.unit)} ₹${i.line_total}`);
  const subtotal = items.reduce((s, i) => s + i.line_total, 0);
  lines.push(`\nSubtotal: ₹${subtotal.toFixed(2)}`);
  return lines.join('\n');
}

// Display helper — kg quantities below 1 read better as grams
// ("500g" not "0.5kg") for Indian customers. Pieces drop the unit
// suffix entirely ("6" not "6piece").
export function formatQty(qty: number, unit: string): string {
  if (unit === 'kg' && qty < 1) return `${Math.round(qty * 1000)}g`;
  return `${qty}${unit === 'piece' ? '' : unit}`;
}

export function formatOrderConfirmation(order: GroceryOrder, slotLabel: string): string {
  return [
    `Order confirm! ✅`,
    ``,
    formatCartSummary(order.items),
    `Delivery: ₹${order.delivery_fee}`,
    `Total: ₹${order.total} (Cash on delivery)`,
    ``,
    `Slot: ${slotLabel} (${order.slot_date})`,
    `Address: ${order.delivery_address}`,
    ``,
    `Order #${order.id.slice(0, 8)}`,
  ].join('\n');
}

export function formatOwnerNotification(
  order: GroceryOrder,
  customerName: string,
  slotLabel: string
): string {
  return [
    `🆕 Naya order #${order.id.slice(0, 8)}`,
    ``,
    formatCartSummary(order.items),
    `Delivery: ₹${order.delivery_fee}`,
    `Total: ₹${order.total} COD`,
    ``,
    `Slot: ${slotLabel} (${order.slot_date})`,
    `Customer: ${customerName} (${order.customer_phone})`,
    `Address: ${order.delivery_address}`,
  ].join('\n');
}
