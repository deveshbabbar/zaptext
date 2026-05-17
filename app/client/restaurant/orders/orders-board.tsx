'use client';

// Today's orders board — per-order-type status flow with click-to-advance
// buttons. Each click POSTs /api/client/restaurant/orders/<id>/status
// which auto-pings the customer on WhatsApp.

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Panel, StatusPill } from '@/components/app/primitives';

interface OrderItem { name: string; qty: number; price: number }

interface OrderCard {
  id: string;
  status: string;
  order_type: string;
  customer_phone: string;
  customer_name: string;
  table_number: string | null;
  delivery_address: string;
  special_notes: string;
  total: number;
  items: OrderItem[];
  created_at: string;
}

interface Props { initialOrders: OrderCard[] }

const FLOW: Record<string, string[]> = {
  dine_in:         ['placed', 'preparing', 'ready', 'served'],
  home_delivery:   ['placed', 'preparing', 'ready', 'out_for_delivery', 'delivered'],
  parcel_takeaway: ['placed', 'preparing', 'ready', 'picked_up'],
};

const STATUS_LABEL: Record<string, string> = {
  pending_approval: 'Pending approval',
  placed: 'Placed',
  preparing: 'Preparing',
  ready: 'Ready',
  served: 'Served',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  picked_up: 'Picked up',
  cancelled: 'Cancelled',
};

const TYPE_LABEL: Record<string, string> = {
  dine_in: '🍽️ Dine-in',
  home_delivery: '🛵 Delivery',
  parcel_takeaway: '🛍️ Takeaway',
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m ago`;
}

export function OrdersBoard({ initialOrders }: Props) {
  const [orders, setOrders] = useState<OrderCard[]>(initialOrders);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'done' | 'cancelled'>('open');

  const filtered = useMemo(() => {
    if (filter === 'all') return orders;
    if (filter === 'cancelled') return orders.filter((o) => o.status === 'cancelled');
    const doneStatuses = new Set(['served', 'delivered', 'picked_up']);
    if (filter === 'done') return orders.filter((o) => doneStatuses.has(o.status));
    return orders.filter((o) => !doneStatuses.has(o.status) && o.status !== 'cancelled');
  }, [orders, filter]);

  const counts = {
    all: orders.length,
    open: orders.filter((o) => !['served', 'delivered', 'picked_up', 'cancelled'].includes(o.status)).length,
    done: orders.filter((o) => ['served', 'delivered', 'picked_up'].includes(o.status)).length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
  };

  async function setStatus(orderId: string, nextStatus: string) {
    setBusy(orderId);
    try {
      const res = await fetch(`/api/client/restaurant/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || `Failed (${res.status})`);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o)));
      toast.success(`${STATUS_LABEL[nextStatus] || nextStatus} — customer notified on WhatsApp`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Status update failed');
    } finally {
      setBusy(null);
    }
  }

  // Approve a pending_approval order — separate endpoint from the regular
  // status flow because it has its own customer-confirmation copy and
  // flips from a state the /status endpoint deliberately doesn't accept.
  async function approveOrder(orderId: string) {
    setBusy(orderId);
    try {
      const res = await fetch(`/api/client/restaurant/orders/${orderId}/approve`, { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || `Failed (${res.status})`);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: 'placed' } : o)));
      toast.success('Approved — customer notified on WhatsApp');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {(['open', 'all', 'done', 'cancelled'] as const).map((f) => {
          const on = filter === f;
          return (
            <button key={f} type="button" onClick={() => setFilter(f)}
              className="rounded-full text-[12px] font-semibold capitalize"
              style={{
                padding: '6px 14px',
                border: '1px solid ' + (on ? 'var(--ink)' : 'var(--line)'),
                background: on ? 'var(--ink)' : 'transparent',
                color: on ? 'var(--card)' : 'var(--ink)',
              }}>
              {f} ({counts[f]})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <Panel title={`No ${filter === 'all' ? '' : filter + ' '}orders`}>
          <p className="text-sm text-muted-foreground">Try a different filter above.</p>
        </Panel>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => {
            const flow = FLOW[o.order_type] || FLOW.dine_in;
            const isPending = o.status === 'pending_approval';
            const currentIdx = isPending ? -1 : flow.indexOf(o.status);
            const nextStatus = currentIdx >= 0 && currentIdx < flow.length - 1 ? flow[currentIdx + 1] : null;
            const isTerminal = ['served', 'delivered', 'picked_up', 'cancelled'].includes(o.status);
            const variant: 'ok' | 'cancel' | 'pending' =
              o.status === 'cancelled' ? 'cancel'
              : isTerminal ? 'ok'
              : 'pending';
            return (
              <Panel
                key={o.id}
                title={
                  <span>
                    {o.customer_name || o.customer_phone}
                    <span className="ml-2 text-[11.5px] text-muted-foreground zt-mono uppercase tracking-[.06em]">
                      {TYPE_LABEL[o.order_type] || o.order_type} · ₹{Math.round(Number(o.total)).toLocaleString('en-IN')} · {timeAgo(o.created_at)}
                    </span>
                  </span>
                }
                action={<StatusPill variant={variant}>{STATUS_LABEL[o.status] || o.status}</StatusPill>}
              >
                <div className="text-[12.5px] text-muted-foreground mb-2">
                  📱 +{o.customer_phone}
                  {o.order_type === 'dine_in' && o.table_number && <span className="ml-3">🪑 Table {o.table_number}</span>}
                  {o.order_type === 'home_delivery' && o.delivery_address && <span className="ml-3">📍 {o.delivery_address}</span>}
                  {o.special_notes && <div className="mt-1">💬 {o.special_notes}</div>}
                </div>

                <div className="border-t border-[var(--line)] pt-2 mb-3">
                  <div className="text-[11px] uppercase tracking-[.06em] text-muted-foreground font-semibold mb-1">
                    Items ({o.items.length})
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {o.items.map((it, i) => (
                      <div key={i} className="flex items-center justify-between text-[12.5px]">
                        <span>{it.name} <span className="text-muted-foreground">× {it.qty}</span></span>
                        <span className="zt-mono">₹{Math.round(Number(it.price) * it.qty).toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-end text-[13px] font-bold mt-2 pt-2 border-t border-[var(--line)]">
                    Total: ₹{Math.round(Number(o.total)).toLocaleString('en-IN')}
                  </div>
                </div>

                {/* Pending-approval banner OR flow progress dots */}
                {isPending ? (
                  <div className="mb-3 rounded-[10px] text-[12px] leading-snug"
                       style={{ padding: '10px 12px', background: '#FFF4E5', border: '1px solid #E89A1C', color: '#7A5300' }}>
                    🔔 <b>Awaiting your approval.</b> Customer was told to wait. Tap <b>Approve</b> to confirm the order, or <b>Decline</b> to send a polite refusal.
                  </div>
                ) : (
                  <div className="flex items-center flex-wrap gap-1 mb-3 text-[10.5px]">
                    {flow.map((s, i) => {
                      const reached = currentIdx >= i;
                      return (
                        <span key={s} className="flex items-center gap-1">
                          <span style={{
                            width: 7, height: 7, borderRadius: 99,
                            background: reached ? 'var(--ink)' : 'var(--line)',
                          }} />
                          <span className={reached ? 'font-semibold' : 'text-muted-foreground'}>
                            {STATUS_LABEL[s] || s}
                          </span>
                          {i < flow.length - 1 && <span className="text-muted-foreground">→</span>}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  {isPending && (
                    <button onClick={() => approveOrder(o.id)} disabled={busy === o.id}
                      className="rounded-[8px] text-[12.5px] font-semibold"
                      style={{ padding: '7px 14px', background: 'var(--ink)', color: 'var(--card)' }}>
                      ✅ Approve order
                    </button>
                  )}
                  {!isPending && nextStatus && (
                    <button onClick={() => setStatus(o.id, nextStatus)} disabled={busy === o.id}
                      className="rounded-[8px] text-[12.5px] font-semibold"
                      style={{ padding: '7px 14px', background: 'var(--ink)', color: 'var(--card)' }}>
                      Mark as {STATUS_LABEL[nextStatus] || nextStatus} →
                    </button>
                  )}
                  {!isTerminal && (
                    <button onClick={() => setStatus(o.id, 'cancelled')} disabled={busy === o.id}
                      className="rounded-[8px] border border-red-500/30 text-red-500 hover:bg-red-500/10 text-[12.5px] font-semibold"
                      style={{ padding: '7px 12px' }}>
                      {isPending ? '❌ Decline' : 'Cancel order'}
                    </button>
                  )}
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </>
  );
}
