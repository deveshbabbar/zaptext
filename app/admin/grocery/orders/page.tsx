// app/admin/grocery/orders/page.tsx
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getClientByOwnerUserId } from '@/lib/db/clients';
import { listOrders } from '@/lib/db/grocery-orders';
import OrdersList from './_components/orders-list';

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
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Orders</h1>
      <OrdersList initial={orders} activeStatus={status ?? null} />
    </div>
  );
}
