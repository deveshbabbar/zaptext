'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageTopbar, PageHead, Panel, StatusPill } from '@/components/app/primitives';
import type { GroceryOrder, OrderStatus } from '@/lib/grocery/types';

const STATUS_FLOW: OrderStatus[] = ['pending', 'confirmed', 'packed', 'delivered'];

interface Props {
  businessName: string;
  initialOrders: GroceryOrder[];
}

export function OrdersBoard({ businessName, initialOrders }: Props) {
  const [orders, setOrders] = useState<GroceryOrder[]>(initialOrders);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');

  async function setStatus(id: string, status: OrderStatus) {
    setBusy(id);
    try {
      const res = await fetch(`/api/grocery/orders/${id}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Update failed');
      setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status } : o));
      toast.success(`Order moved to ${status}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  const visible = filter === 'all' ? orders : orders.filter((o) => o.status === filter);
  const counts: Record<OrderStatus | 'all', number> = {
    all: orders.length,
    pending: orders.filter((o) => o.status === 'pending').length,
    confirmed: orders.filter((o) => o.status === 'confirmed').length,
    packed: orders.filter((o) => o.status === 'packed').length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
  };

  return (
    <>
      <PageTopbar
        crumbs={<>Grocery / <a href="/client/grocery" className="hover:underline">Overview</a> / <b className="text-foreground">Orders</b></>}
      />
      <div style={{ padding: '28px 32px 80px' }}>
        <PageHead
          title={<>{businessName} <span className="zt-serif">orders.</span></>}
          sub={`${orders.length} recent orders. Customer is notified on WhatsApp at every status change.`}
        />

        <div className="flex flex-wrap gap-1.5 mb-4">
          {(['all', 'pending', 'confirmed', 'packed', 'delivered', 'cancelled'] as const).map((s) => {
            const on = filter === s;
            return (
              <button key={s} type="button" onClick={() => setFilter(s)}
                className="rounded-full text-[12px] font-semibold capitalize"
                style={{
                  padding: '6px 14px',
                  border: '1px solid ' + (on ? 'var(--ink)' : 'var(--line)'),
                  background: on ? 'var(--ink)' : 'transparent',
                  color: on ? 'var(--card)' : 'var(--ink)',
                }}>
                {s} ({counts[s]})
              </button>
            );
          })}
        </div>

        {visible.length === 0 ? (
          <Panel title={filter === 'all' ? 'No orders yet' : `No ${filter} orders`} sub="Orders placed via WhatsApp will appear here.">
            <div />
          </Panel>
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map((o) => {
              const nextStatusIdx = STATUS_FLOW.indexOf(o.status as OrderStatus) + 1;
              const nextStatus = nextStatusIdx > 0 && nextStatusIdx < STATUS_FLOW.length ? STATUS_FLOW[nextStatusIdx] : null;
              return (
                <Panel key={o.id} title={
                  <span>
                    {o.customer_name || o.customer_phone}
                    <span className="ml-2 text-[12px] text-[var(--mute)] zt-mono uppercase">
                      {o.slot_date} · ₹{Math.round(Number(o.total)).toLocaleString('en-IN')}
                    </span>
                  </span>
                } action={
                  <div className="flex items-center gap-2">
                    <StatusPill variant={
                      o.status === 'delivered' || o.status === 'confirmed' || o.status === 'packed' ? 'ok' :
                      o.status === 'cancelled' ? 'cancel' : 'pending'
                    }>{o.status}</StatusPill>
                  </div>
                }>
                  <div className="text-[12.5px] text-[var(--mute)] mb-2">
                    📍 {o.delivery_address}
                    {o.notes && <span className="ml-3">💬 {o.notes}</span>}
                  </div>
                  <div className="border-t border-[var(--line)] pt-2 mb-3">
                    <div className="text-[11px] uppercase tracking-[.06em] text-[var(--mute)] font-semibold mb-1">Items ({o.items.length})</div>
                    <div className="flex flex-col gap-0.5">
                      {o.items.map((it, i) => (
                        <div key={i} className="flex items-center justify-between text-[12.5px]">
                          <span>{it.name} <span className="text-[var(--mute)]">× {it.qty} {it.unit}</span></span>
                          <span className="zt-mono">₹{Math.round(Number(it.line_total)).toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-[12px] text-[var(--mute)] mt-2">
                      <span>Delivery: ₹{Math.round(Number(o.delivery_fee)).toLocaleString('en-IN')} · Payment: {o.payment_mode.toUpperCase()}</span>
                      <span className="font-bold text-[14px] text-[var(--ink)]">Total: ₹{Math.round(Number(o.total)).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {nextStatus && (
                      <button onClick={() => setStatus(o.id, nextStatus)} disabled={busy === o.id}
                        className="rounded-[8px] text-[12px] font-semibold"
                        style={{ padding: '6px 12px', background: 'var(--ink)', color: 'var(--card)' }}>
                        Mark as {nextStatus}
                      </button>
                    )}
                    {o.status !== 'cancelled' && o.status !== 'delivered' && (
                      <button onClick={() => setStatus(o.id, 'cancelled')} disabled={busy === o.id}
                        className="rounded-[8px] border border-red-500/30 text-red-500 hover:bg-red-500/10 text-[12px] font-semibold"
                        style={{ padding: '6px 12px' }}>
                        Cancel
                      </button>
                    )}
                  </div>
                </Panel>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
