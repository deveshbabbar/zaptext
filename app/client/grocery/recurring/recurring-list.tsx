'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageTopbar, PageHead, Panel } from '@/components/app/primitives';
import type { RecurringOrder } from '@/lib/grocery/types';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Props {
  businessName: string;
  initialRecurring: RecurringOrder[];
  slotLabelById: Record<string, string>;
}

export function RecurringList({ businessName, initialRecurring, slotLabelById }: Props) {
  const [items, setItems] = useState<RecurringOrder[]>(initialRecurring);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggleActive(r: RecurringOrder) {
    setBusy(r.id);
    try {
      const res = await fetch(`/api/grocery/recurring/${r.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !r.is_active }),
      });
      if (!res.ok) throw new Error('Update failed');
      setItems((prev) => prev.map((x) => x.id === r.id ? { ...x, is_active: !x.is_active } : x));
      toast.success(r.is_active ? 'Paused' : 'Resumed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  async function removeRecurring(r: RecurringOrder) {
    if (!window.confirm(`Remove recurring order for +${r.customer_phone}?`)) return;
    setBusy(r.id);
    try {
      const res = await fetch(`/api/grocery/recurring/${r.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setItems((prev) => prev.filter((x) => x.id !== r.id));
      toast.success('Removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  const active = items.filter((r) => r.is_active);
  const paused = items.filter((r) => !r.is_active);

  return (
    <>
      <PageTopbar
        crumbs={<>Grocery / <a href="/client/grocery" className="hover:underline">Overview</a> / <b className="text-foreground">Recurring orders</b></>}
      />
      <div style={{ padding: '28px 32px 80px' }}>
        <PageHead
          title={<>{businessName} <span className="zt-serif">subscriptions.</span></>}
          sub={`${active.length} active recurring orders. Customers create these via WhatsApp ("repeat my last order every Monday").`}
        />

        {items.length === 0 ? (
          <Panel title="No recurring orders yet"
            sub="When a customer asks the bot to repeat an order weekly/monthly, it'll appear here. You can pause or remove anytime.">
            <div />
          </Panel>
        ) : (
          <>
            <Panel title={`Active (${active.length})`} sub="Will run on the next matching day-of-week" className="mb-4">
              {active.length === 0 ? (
                <p className="text-[13px] text-[var(--mute)] py-2">No active subscriptions.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {active.map((r) => (
                    <RecurringRow key={r.id} r={r} slotLabel={slotLabelById[r.slot_id] || '(slot deleted)'}
                      busy={busy === r.id}
                      onToggle={() => toggleActive(r)} onRemove={() => removeRecurring(r)} />
                  ))}
                </div>
              )}
            </Panel>

            {paused.length > 0 && (
              <Panel title={`Paused (${paused.length})`} sub="Won't run until resumed">
                <div className="flex flex-col gap-2">
                  {paused.map((r) => (
                    <RecurringRow key={r.id} r={r} slotLabel={slotLabelById[r.slot_id] || '(slot deleted)'}
                      busy={busy === r.id}
                      onToggle={() => toggleActive(r)} onRemove={() => removeRecurring(r)} />
                  ))}
                </div>
              </Panel>
            )}
          </>
        )}
      </div>
    </>
  );
}

function RecurringRow({ r, slotLabel, busy, onToggle, onRemove }: {
  r: RecurringOrder;
  slotLabel: string;
  busy: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="border border-[var(--line)] rounded-[12px] bg-[var(--card)]" style={{ padding: 14 }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="zt-mono text-[13px] font-semibold">+{r.customer_phone}</div>
            <span className="text-[11.5px] text-[var(--mute)]">·</span>
            <div className="text-[12.5px] text-[var(--mute)]">
              Every {DAY_NAMES[r.day_of_week]} · {slotLabel}
            </div>
          </div>
          <div className="text-[12px] text-[var(--mute)] mt-1">
            {r.template_items.length} items{r.last_run_date ? ` · Last ran ${r.last_run_date}` : ' · Never run'}
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {r.template_items.slice(0, 8).map((it, i) => (
              <span key={i} className="text-[11px] rounded-full border border-[var(--line)]" style={{ padding: '2px 8px' }}>
                {it.name} × {it.qty}{it.unit}
              </span>
            ))}
            {r.template_items.length > 8 && (
              <span className="text-[11px] text-[var(--mute)]">+{r.template_items.length - 8} more</span>
            )}
          </div>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <button onClick={onToggle} disabled={busy}
            className="rounded-[8px] border border-[var(--line)] hover:border-[var(--ink)] font-semibold text-[11.5px]"
            style={{ padding: '5px 10px' }}>
            {r.is_active ? 'Pause' : 'Resume'}
          </button>
          <button onClick={onRemove} disabled={busy}
            className="rounded-[8px] border border-red-500/30 text-red-500 hover:bg-red-500/10 font-semibold text-[11.5px]"
            style={{ padding: '5px 10px' }}>
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
