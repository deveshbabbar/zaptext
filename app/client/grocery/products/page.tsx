// Grocery master product catalog. The bot matches incoming customer
// orders against the products defined here (by name + aliases). Each
// product has a unit (kg/g/piece/dozen/bunch) but no price — prices are
// set per-day in the daily catalog (see /client/grocery/catalog).

import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { listProducts } from '@/lib/db/grocery-products';
import { GroceryProductsEditor } from './products-editor';

export default async function GroceryProductsPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'grocery') redirect('/client/dashboard');
  const products = await listProducts(user.activeBot.client_id).catch(() => []);
  return <GroceryProductsEditor businessName={user.activeBot.business_name} initialProducts={products} />;
}
