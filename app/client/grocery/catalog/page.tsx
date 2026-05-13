// Today's catalog — owner sets per-product price + in-stock for today.
// Bot reads this when quoting prices to customers. Mandi prices change
// daily so this page is the most-used grocery workflow. "Copy yesterday"
// button covers the common case where 80% of prices stay the same.

import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { listProducts } from '@/lib/db/grocery-products';
import { getCatalogForDate } from '@/lib/db/grocery-daily-catalog';
import { todayIsoIST } from '@/lib/grocery/date-utils';
import { DailyCatalogEditor } from './catalog-editor';

export default async function GroceryCatalogPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'grocery') redirect('/client/dashboard');

  const today = todayIsoIST();
  const [products, todayCatalog] = await Promise.all([
    listProducts(user.activeBot.client_id).catch(() => []),
    getCatalogForDate(user.activeBot.client_id, today).catch(() => []),
  ]);

  // Build a Map<product_id, {price, in_stock, stock_qty}> for the client.
  const catalogByProduct: Record<string, { price_per_unit: number; in_stock: boolean; stock_qty: number | null }> = {};
  for (const e of todayCatalog) {
    catalogByProduct[e.product.id] = {
      price_per_unit: e.price_per_unit,
      in_stock: e.in_stock,
      stock_qty: e.stock_qty,
    };
  }

  return (
    <DailyCatalogEditor
      businessName={user.activeBot.business_name}
      date={today}
      products={products}
      initialCatalog={catalogByProduct}
    />
  );
}
