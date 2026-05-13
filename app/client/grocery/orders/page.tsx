// Grocery orders — incoming orders list grouped by status. Owner can
// move orders through pending → confirmed → packed → delivered (or
// cancelled) via the status pills. Bot notifies the customer on every
// status change.

import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { listOrders } from '@/lib/db/grocery-orders';
import { OrdersBoard } from './orders-board';

export default async function GroceryOrdersPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'grocery') redirect('/client/dashboard');
  const orders = await listOrders(user.activeBot.client_id, { limit: 100 }).catch(() => []);
  return <OrdersBoard businessName={user.activeBot.business_name} initialOrders={orders} />;
}
