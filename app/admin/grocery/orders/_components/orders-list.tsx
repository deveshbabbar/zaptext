// app/admin/grocery/orders/_components/orders-list.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { GroceryOrder, OrderStatus } from '@/lib/grocery/types';
import { toast } from 'sonner';
import { Panel, Pill, StatusPill, Tabs } from '@/components/app/primitives';

type FilterId = 'all' | OrderStatus;

const TAB_ITEMS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'packed', label: 'Packed' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
];

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'confirmed',
  confirmed: 'packed',
  packed: 'delivered',
};

const STATUS_VARIANT: Record<OrderStatus, 'ok' | 'pending' | 'cancel' | 'active'> = {
  pending: 'pending',
  confirmed: 'active',
  packed: 'active',
  delivered: 'ok',
  cancelled: 'cancel',
};

export default function OrdersList({
  initial,
  activeStatus,
}: {
  initial: GroceryOrder[];
  activeStatus: OrderStatus | null;
}) {
  const [orders, setOrders] = useState(initial);
  const router = useRouter();

  async function setStatus(o: GroceryOrder, status: OrderStatus) {
    const res = await fetch(`/api/grocery/orders/${o.id}/status`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) return toast.error('Update failed');
    setOrders((os) => os.map((x) => (x.id === o.id ? { ...x, status } : x)));
  }

  const active: FilterId = activeStatus ?? 'all';

  return (
    <div className="space-y-4">
      <Tabs<FilterId>
        items={TAB_ITEMS.map((it) =>
          it.id === 'all' ? { ...it, count: orders.length } : it,
        )}
        active={active}
        onChange={(id) => router.push(id === 'all' ? '?' : `?status=${id}`)}
      />

      <div className="space-y-3">
        {orders.map((o) => (
          <Panel key={o.id}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="font-semibold text-[14.5px]">
                  #{o.id.slice(0, 8)}{' '}
                  <span className="text-[var(--mute)] font-normal">
                    · {o.customer_phone}
                  </span>
                </div>
                <div className="text-[11.5px] zt-mono uppercase tracking-[.06em] text-[var(--mute)] mt-1">
                  {o.slot_date} · ₹{o.total} · {o.payment_mode.toUpperCase()}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <StatusPill variant={STATUS_VARIANT[o.status]}>
                  {o.status}
                </StatusPill>
                {NEXT[o.status] && (
                  <Pill
                    variant="ink"
                    onClick={() => setStatus(o, NEXT[o.status]!)}
                  >
                    Mark {NEXT[o.status]}
                  </Pill>
                )}
                {o.status !== 'cancelled' && o.status !== 'delivered' && (
                  <Pill
                    variant="ghost"
                    onClick={() => setStatus(o, 'cancelled')}
                  >
                    Cancel
                  </Pill>
                )}
              </div>
            </div>
            <details className="mt-3 text-[13px]">
              <summary className="cursor-pointer text-[var(--mute)] zt-mono text-[11px] uppercase tracking-[.06em]">
                Items + address
              </summary>
              <ul className="mt-2 space-y-0.5 text-[var(--ink-2)]">
                {o.items.map((it, i) => (
                  <li key={i}>
                    {it.qty} {it.unit} {it.name} @ ₹{it.price_per_unit} = ₹
                    {it.line_total}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[var(--mute)]">{o.delivery_address}</p>
            </details>
          </Panel>
        ))}
        {orders.length === 0 && (
          <Panel>
            <div className="py-12 text-center text-[13.5px] text-[var(--mute)]">
              No orders.
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
