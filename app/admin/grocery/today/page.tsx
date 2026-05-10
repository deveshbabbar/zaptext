// app/admin/grocery/today/page.tsx
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getClientByOwnerUserId } from '@/lib/db/clients';
import { listProducts } from '@/lib/db/grocery-products';
import { getCatalogForDate } from '@/lib/db/grocery-daily-catalog';
import { todayIsoIST } from '@/lib/grocery/date-utils';
import { PageTopbar, PageHead } from '@/components/app/primitives';
import TodayEditor from './_components/today-editor';

export default async function TodayPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const client = await getClientByOwnerUserId(userId);
  if (!client || client.type !== 'grocery') redirect('/admin');

  const today = todayIsoIST();
  const [products, catalog] = await Promise.all([
    listProducts(client.client_id),
    getCatalogForDate(client.client_id, today),
  ]);
  const byProduct = new Map(catalog.map((c) => [c.product.id, c]));

  return (
    <>
      <PageTopbar
        crumbs={
          <>
            Admin · Grocery · <b className="text-foreground">Aaj ki list</b>
          </>
        }
      />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead
          title={
            <>
              Aaj ki <span className="zt-serif">list.</span>
            </>
          }
          sub={`${today} (IST) — set today's prices and stock.`}
        />
        <TodayEditor
          date={today}
          products={products}
          existing={Object.fromEntries(
            [...byProduct.entries()].map(([id, c]) => [
              id,
              { price: c.price_per_unit, in_stock: c.in_stock },
            ])
          )}
        />
      </div>
    </>
  );
}
