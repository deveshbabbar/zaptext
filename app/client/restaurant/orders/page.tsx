// app/client/restaurant/orders/page.tsx
//
// Today's restaurant orders board. Shows every order written into
// dine_in_orders today (from QR-scan dine-in, web-menu link, OR the
// AI's [ORDER:] tag) with per-order-type status flow buttons:
//   dine_in:         placed → preparing → ready → served
//   home_delivery:   placed → preparing → ready → out_for_delivery → delivered
//   parcel_takeaway: placed → preparing → ready → picked_up
// Each click POSTs /api/client/restaurant/orders/<id>/status which auto-
// pings the customer on WhatsApp with the new status.

import { requireRestaurantViewer } from '@/lib/restaurant/viewer-context';
import { listOrdersForToday } from '@/lib/db/restaurant-dine-in';
import { PageTopbar, PageHead, Panel } from '@/components/app/primitives';
import { OrdersBoard } from './orders-board';

export default async function RestaurantOrdersPage() {
  // Phase 3I v2 — viewer-context gates outlet managers to their own
  // outlet's orders. Owners (restrictedOutletId === null) keep the
  // chain-wide view.
  const viewer = await requireRestaurantViewer();

  const orders = await listOrdersForToday(
    viewer.activeBot.client_id,
    undefined,
    viewer.restrictedOutletId || undefined
  ).catch(() => []);

  return (
    <>
      <PageTopbar
        crumbs={
          <>
            Restaurant /{' '}
            <a href="/client/restaurant" className="hover:underline">Overview</a>{' '}
            / <b className="text-foreground">Today&apos;s orders</b>
          </>
        }
      />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead
          title={<>Today&apos;s <span className="zt-serif">orders.</span></>}
          sub={`${orders.length} order${orders.length === 1 ? '' : 's'} today across dine-in, delivery and takeaway. Click a status button — customer gets a WhatsApp update automatically.`}
        />

        {orders.length === 0 ? (
          <Panel title="No orders yet today">
            <p className="text-sm text-muted-foreground">
              Orders placed via the menu link, QR scan, or chat will appear here in real time. Customers also auto-receive WhatsApp updates as you move them through the flow.
            </p>
          </Panel>
        ) : (
          <OrdersBoard
            initialOrders={orders.map((o) => ({
              id: o.id,
              status: o.status,
              order_type: o.order_type,
              customer_phone: o.customer_phone,
              customer_name: o.customer_name,
              table_number: o.table_number,
              delivery_address: o.delivery_address,
              special_notes: o.special_notes,
              total: o.total,
              items: o.items,
              created_at: o.created_at,
            }))}
          />
        )}
      </div>
    </>
  );
}
