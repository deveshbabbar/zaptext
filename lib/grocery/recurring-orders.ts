// lib/grocery/recurring-orders.ts
//
// Daily cron runner. For each active recurring row matching today's
// day-of-week (and not yet run today), send the customer a confirmation
// prompt with their template items at today's prices. Never auto-places
// orders — customer must reply Confirm / Edit / Skip.
//
// Compliance: this outbound is free-form text (interactive buttons), so it
// is only safe inside the customer's 24hr service window. v1 skips
// out-of-window customers entirely; v1.5 will gate on a registered utility
// template once Meta-approved copy is in place.
//
// Idempotency: `activeRecurringForDay` already filters out rows whose
// `last_run_date` matches today, so a duplicate Vercel cron retry will see
// zero rows after the first successful pass marks them via
// `markRecurringRan`.

import { activeRecurringForDay, markRecurringRan } from '../db/grocery-recurring-orders';
import { getCatalogForDate } from '../db/grocery-daily-catalog';
import { getSlot } from '../db/grocery-slots';
import { getClientById } from '../db/clients';
import { sendInteractiveButtons } from '../whatsapp';
import { dayOfWeekIST, todayIsoIST } from './date-utils';
import { isWithinServiceWindow } from './service-window';
import type { CartItem, RecurringOrder } from './types';

export interface RecurringRunReport {
  date: string;
  totalActive: number;
  prompted: number;
  skippedOutOfWindow: number;
  skippedNoCatalog: number;
  skippedNoPhoneNumberId: number;
  skippedNoItemsInStock: number;
}

export async function runRecurringForDay(now: Date = new Date()): Promise<RecurringRunReport> {
  const today = todayIsoIST(now);
  const dow = dayOfWeekIST(now);
  const rows = await activeRecurringForDay(dow, today);

  const report: RecurringRunReport = {
    date: today,
    totalActive: rows.length,
    prompted: 0,
    skippedOutOfWindow: 0,
    skippedNoCatalog: 0,
    skippedNoPhoneNumberId: 0,
    skippedNoItemsInStock: 0,
  };

  // Group by client to share the catalog + client fetch.
  const byClient = new Map<string, RecurringOrder[]>();
  for (const r of rows) {
    const arr = byClient.get(r.client_id) ?? [];
    arr.push(r);
    byClient.set(r.client_id, arr);
  }

  for (const [client_id, recurs] of byClient) {
    const client = await getClientById(client_id);
    if (!client) continue;

    // The cron has no inbound webhook to derive phone_number_id from, so we
    // resolve it off the client row. Empty string = bot not yet connected to
    // a Meta WABA; skip rather than 400 on the Graph API call.
    const phoneNumberId = client.phone_number_id;
    if (!phoneNumberId) {
      report.skippedNoPhoneNumberId += recurs.length;
      continue;
    }

    const catalog = await getCatalogForDate(client_id, today);
    if (catalog.length === 0) {
      report.skippedNoCatalog += recurs.length;
      continue;
    }

    for (const r of recurs) {
      const inWindow = await isWithinServiceWindow(client_id, r.customer_phone);
      if (!inWindow) {
        report.skippedOutOfWindow++;
        continue;
      }

      // Re-price template items at today's prices. Drop items that are out
      // of stock or no longer in today's catalog.
      const items: CartItem[] = [];
      for (const t of r.template_items) {
        const c = catalog.find((x) => x.product.id === t.product_id);
        if (!c || !c.in_stock) continue;
        items.push({
          ...t,
          price_per_unit: c.price_per_unit,
          line_total: round2(t.qty * c.price_per_unit),
        });
      }
      if (items.length === 0) {
        report.skippedNoItemsInStock++;
        continue;
      }

      const slot = await getSlot(r.slot_id);
      const slotLabel = slot?.label ?? r.slot_id;
      const summary = items
        .map((i) => `• ${i.name} ${i.qty}${i.unit === 'piece' ? '' : i.unit} ₹${i.line_total}`)
        .join('\n');
      const subtotal = items.reduce((s, i) => s + i.line_total, 0);

      await sendInteractiveButtons(
        phoneNumberId,
        r.customer_phone,
        [
          `Aaj ka regular order:`,
          ``,
          summary,
          ``,
          `Subtotal: ₹${subtotal.toFixed(2)} (delivery + min order zone wise)`,
          `Slot: ${slotLabel}`,
        ].join('\n'),
        [
          { id: `recur-confirm:${r.id}`, title: 'Confirm' },
          { id: `recur-edit:${r.id}`, title: 'Edit' },
          { id: `recur-skip:${r.id}`, title: 'Skip aaj' },
        ]
      );
      await markRecurringRan(r.id, today);
      report.prompted++;
    }
  }

  return report;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
