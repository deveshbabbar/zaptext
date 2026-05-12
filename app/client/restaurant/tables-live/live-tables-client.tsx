'use client';

// Live-tables UI: one card per open session with items, customers, and a
// Close button. Stays in sync via a 30-second router refresh so newly
// placed orders appear without a manual reload.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Panel, StatusPill } from '@/components/app/primitives';
import { Button } from '@/components/ui/button';
import type { DineInOrderItem, DineInOrderStatus } from '@/lib/db/restaurant-dine-in';

interface Card {
  sessionId: string;
  tableNumber: string;
  phones: string[];
  startedAt: string;
  lastActivityAt: string;
  orders: Array<{ id: string; items: DineInOrderItem[]; total: number; status: DineInOrderStatus; created_at: string; notes: string }>;
}

function maskPhone(p: string): string {
  const digits = p.replace(/\D/g, '');
  if (digits.length < 6) return p;
  return digits.slice(0, 4) + '***' + digits.slice(-3);
}

function minutesSince(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

export function LiveTablesClient({ cards }: { cards: Card[] }) {
  const router = useRouter();
  const [closingId, setClosingId] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(t);
  }, [router]);

  async function handleClose(sessionId: string, tableNumber: string) {
    setClosingId(sessionId);
    try {
      const res = await fetch('/api/client/restaurant/sessions/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || `Close failed (${res.status})`);
      toast.success(`Table ${tableNumber} closed`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Close failed');
    } finally {
      setClosingId(null);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {cards.map((card) => {
        const totalSpend = card.orders.reduce((s, o) => s + o.total, 0);
        const activeMins = minutesSince(card.startedAt);
        const idleMins = minutesSince(card.lastActivityAt);
        return (
          <Panel
            key={card.sessionId}
            title={
              <>
                Table {card.tableNumber}
                {idleMins > 30 && (
                  <span className="ml-2 text-[11px] text-amber-700">⚠ idle {idleMins}m</span>
                )}
              </>
            }
            sub={`${card.phones.length} customer${card.phones.length === 1 ? '' : 's'} · started ${activeMins}m ago · ₹${totalSpend.toFixed(0)} so far`}
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleClose(card.sessionId, card.tableNumber)}
                disabled={closingId === card.sessionId}
              >
                {closingId === card.sessionId ? 'Closing…' : 'Close'}
              </Button>
            }
          >
            <div className="space-y-3">
              <div className="text-[11.5px] text-[var(--mute)] zt-mono uppercase tracking-[.06em]">
                {card.phones.map(maskPhone).join(' · ')}
              </div>

              {card.orders.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No items ordered yet — customer just scanned, hasn&apos;t placed an order. If the dining area is empty for this table, you can close it.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {card.orders.map((order) => (
                    <li key={order.id} className="py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[13px] font-semibold">
                          ₹{order.total.toFixed(0)}{order.notes ? <span className="ml-2 text-xs font-normal text-muted-foreground">· {order.notes}</span> : null}
                        </div>
                        <StatusPill
                          variant={
                            order.status === 'served'
                              ? 'ok'
                              : order.status === 'cancelled'
                                ? 'cancel'
                                : 'pending'
                          }
                        >
                          {order.status}
                        </StatusPill>
                      </div>
                      <ul className="mt-1 text-[12.5px] text-foreground/80">
                        {order.items.map((it, i) => (
                          <li key={i}>• {it.qty}× {it.name} {it.price ? <span className="text-muted-foreground">(₹{it.price})</span> : null}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
