// app/admin/grocery/orders/page.tsx
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getClientByOwnerUserId } from '@/lib/db/clients';
import { listOrders } from '@/lib/db/grocery-orders';
import OrdersList from './_components/orders-list';
import { PageTopbar, PageHead, Pill } from '@/components/app/primitives';

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const c = await getClientByOwnerUserId(userId);
  if (!c || c.type !== 'grocery') redirect('/admin');
  const sp = await searchParams;
  const status = (sp.status as any) || undefined;
  const orders = await listOrders(c.client_id, { status, limit: 200 });
  return (
    <>
      <PageTopbar
        crumbs={
          <>
            Admin · Grocery · <b className="text-foreground">Orders</b>
          </>
        }
        actions={
          <Pill variant="ghost" href="/admin/grocery/today">
            Update list
          </Pill>
        }
      />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead
          title={
            <>
              Orders <span className="zt-serif">queue.</span>
            </>
          }
          sub="Track today's deliveries and confirm new orders as they come in."
        />
        <OrdersList initial={orders} activeStatus={status ?? null} />
      </div>
    </>
  );
}
