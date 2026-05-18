// /client/customers — unified customer list across every interaction
// source (WhatsApp chat, bookings, /m menu-page orders, grocery
// orders).
//
// The Conversations page already shows every customer who messaged,
// but owners asked for a single "customer directory" that ALSO
// surfaces people who only ever ordered via the menu link (no
// WhatsApp DM with the bot yet) and bookings made through the bot.
// This page is that directory — every phone the owner has ever
// transacted with, in one scannable list with name + counts +
// source badges.
//
// Server-component shell + client island (customers-table.tsx) so
// the initial paint is data-baked HTML and the search box / CSV
// export are interactive without a second round-trip. The parent
// app/client/layout.tsx already provides the AppShell + sidebar
// chrome, so this page just returns its content.

import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { PageHead } from '@/components/app/primitives';
import { listCustomersForClient, summariseCustomerList } from '@/lib/db/customers';
import { CustomersTable } from './customers-table';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot) {
    redirect('/client/create-bot');
  }

  const rows = await listCustomersForClient(user.activeBot.client_id);
  const totals = summariseCustomerList(rows);

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-6 sm:py-9">
      <PageHead
        title="Customers"
        sub={
          <>
            Every phone number that has chatted, booked, or ordered with this bot. Combines
            WhatsApp conversations, /m menu-page orders, dine-in / takeaway orders,
            bookings, and grocery orders into one directory.
          </>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <Stat label="Total customers" value={totals.totalCustomers} highlight />
        <Stat label="Messages" value={totals.totalMessages} />
        <Stat label="Orders" value={totals.totalOrders} />
        <Stat label="Bookings" value={totals.totalBookings} />
        <Stat label="Grocery orders" value={totals.totalGroceryOrders} />
      </div>

      <CustomersTable rows={rows} />
    </div>
  );
}

function Stat({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div
      className="rounded-[14px] border border-[var(--line)] px-3.5 py-3 sm:px-4 sm:py-3.5 bg-[var(--card)]"
      style={highlight ? { background: 'color-mix(in oklab, var(--accent) 16%, var(--card))' } : undefined}
    >
      <div className="zt-mono text-[10.5px] uppercase tracking-[.09em] text-[var(--mute)] mb-1.5">{label}</div>
      <div className="text-[22px] sm:text-[26px] font-bold tracking-[-0.02em] leading-none tabular-nums">
        {value.toLocaleString('en-IN')}
      </div>
    </div>
  );
}
