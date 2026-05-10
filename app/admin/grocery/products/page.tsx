// app/admin/grocery/products/page.tsx
import { auth } from '@clerk/nextjs/server';
import { getClientByOwnerUserId } from '@/lib/db/clients';
import { listProducts } from '@/lib/db/grocery-products';
import ProductsTable from './_components/products-table';
import { redirect } from 'next/navigation';
import { PageTopbar, PageHead, Pill } from '@/components/app/primitives';

export default async function ProductsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const client = await getClientByOwnerUserId(userId);
  if (!client || client.type !== 'grocery') redirect('/admin');
  const products = await listProducts(client.client_id);
  return (
    <>
      <PageTopbar
        crumbs={
          <>
            Admin · Grocery · <b className="text-foreground">Products</b>
          </>
        }
        actions={
          <Pill variant="ghost" href="/admin/grocery/today">
            Update prices
          </Pill>
        }
      />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead
          title={
            <>
              Products <span className="zt-serif">master list.</span>
            </>
          }
          sub="Set once, edit rarely. Daily prices live on Aaj ki list."
        />
        <ProductsTable initialProducts={products} />
      </div>
    </>
  );
}
