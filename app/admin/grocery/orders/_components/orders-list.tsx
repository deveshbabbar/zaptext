// app/admin/grocery/orders/_components/orders-list.tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { GroceryOrder, OrderStatus } from '@/lib/grocery/types';
import { toast } from 'sonner';

const STATUSES: { v: OrderStatus | null; label: string }[] = [
  { v: null, label: 'All' },
  { v: 'pending', label: 'Pending' },
  { v: 'confirmed', label: 'Confirmed' },
  { v: 'packed', label: 'Packed' },
  { v: 'delivered', label: 'Delivered' },
  { v: 'cancelled', label: 'Cancelled' },
];

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'confirmed',
  confirmed: 'packed',
  packed: 'delivered',
};

export default function OrdersList({
  initial,
  activeStatus,
}: {
  initial: GroceryOrder[];
  activeStatus: OrderStatus | null;
}) {
  const [orders, setOrders] = useState(initial);

  async function setStatus(o: GroceryOrder, status: OrderStatus) {
    const res = await fetch(`/api/grocery/orders/${o.id}/status`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) return toast.error('Update failed');
    setOrders((os) => os.map((x) => (x.id === o.id ? { ...x, status } : x)));
  }

  return (
    <>
      <div className="flex flex-wrap gap-1">
        {STATUSES.map((s) => (
          <Link
            key={s.label}
            href={s.v ? `?status=${s.v}` : '?'}
            className={`rounded px-3 py-1 text-sm ${
              activeStatus === s.v ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300'
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      <div className="space-y-3">
        {orders.map((o) => (
          <div key={o.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">
                  #{o.id.slice(0, 8)} · {o.customer_phone}
                </div>
                <div className="text-xs text-neutral-400">
                  {o.slot_date} · ₹{o.total} · {o.payment_mode.toUpperCase()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    o.status === 'delivered'
                      ? 'bg-emerald-600/20 text-emerald-300'
                      : o.status === 'cancelled'
                        ? 'bg-red-600/20 text-red-300'
                        : 'bg-amber-600/20 text-amber-300'
                  }`}
                >
                  {o.status}
                </span>
                {NEXT[o.status] && (
                  <button
                    onClick={() => setStatus(o, NEXT[o.status]!)}
                    className="rounded bg-emerald-600 px-2 py-0.5 text-xs text-white"
                  >
                    Mark {NEXT[o.status]}
                  </button>
                )}
                {o.status !== 'cancelled' && o.status !== 'delivered' && (
                  <button
                    onClick={() => setStatus(o, 'cancelled')}
                    className="rounded bg-neutral-700 px-2 py-0.5 text-xs"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-neutral-400">Items + address</summary>
              <ul className="mt-1 space-y-0.5 text-neutral-300">
                {o.items.map((it, i) => (
                  <li key={i}>
                    {it.qty} {it.unit} {it.name} @ ₹{it.price_per_unit} = ₹{it.line_total}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-neutral-400">{o.delivery_address}</p>
            </details>
          </div>
        ))}
        {orders.length === 0 && (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 text-center text-neutral-500">
            No orders.
          </div>
        )}
      </div>
    </>
  );
}
