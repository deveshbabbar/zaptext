// app/admin/grocery/products/page.tsx
import { auth } from '@clerk/nextjs/server';
import { getClientByOwnerUserId } from '@/lib/db/clients';
import { listProducts } from '@/lib/db/grocery-products';
import ProductsTable from './_components/products-table';
import { redirect } from 'next/navigation';

export default async function ProductsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const client = await getClientByOwnerUserId(userId);
  if (!client || client.type !== 'grocery') redirect('/admin');
  const products = await listProducts(client.client_id);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Products</h1>
      <p className="text-sm text-neutral-400">
        Master list of items you sell. Set once, edit rarely. Daily prices and stock
        are managed on the &quot;Aaj ki list&quot; tab.
      </p>
      <ProductsTable initialProducts={products} />
    </div>
  );
}
