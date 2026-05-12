// Restaurant manager — live table sessions.
// Lists currently OPEN sessions for the active restaurant bot, with each
// session's items, time elapsed, and a "Close session" button.

import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { listOpenSessions, getOrdersBySession, type DineInOrder } from '@/lib/db/restaurant-dine-in';
import { PageTopbar, PageHead, Panel } from '@/components/app/primitives';
import { LiveTablesClient } from './live-tables-client';

export default async function RestaurantTablesLivePage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'restaurant') redirect('/client/dashboard');

  const sessions = await listOpenSessions(user.activeBot.client_id).catch(() => []);

  const ordersBySession = new Map<string, DineInOrder[]>();
  await Promise.all(
    sessions.map(async (s) => {
      const rows = await getOrdersBySession(s.id).catch(() => []);
      ordersBySession.set(s.id, rows);
    })
  );

  const cards = sessions.map((s) => ({
    sessionId: s.id,
    tableNumber: s.table_number,
    phones: s.customer_phones,
    startedAt: s.started_at,
    lastActivityAt: s.last_activity_at,
    orders: (ordersBySession.get(s.id) || []).map((o) => ({
      id: o.id,
      items: o.items,
      total: o.total,
      status: o.status,
      created_at: o.created_at,
      notes: o.special_notes,
    })),
  }));

  return (
    <>
      <PageTopbar
        crumbs={
          <>
            Restaurant /{' '}
            <a href="/client/restaurant" className="hover:underline">Overview</a>{' '}
            / <b className="text-foreground">Live tables</b>
          </>
        }
      />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead
          title={<>Live <span className="zt-serif">tables.</span></>}
          sub={`${cards.length} table${cards.length === 1 ? '' : 's'} currently open. Sessions auto-close after 2 hours of inactivity. Tap Close to end one manually.`}
        />
        {cards.length === 0 ? (
          <Panel title="No active tables">
            <p className="text-sm text-muted-foreground">
              No customers currently in a dine-in session. Sessions open when someone scans a table QR.
            </p>
          </Panel>
        ) : (
          <LiveTablesClient cards={cards} />
        )}
      </div>
    </>
  );
}
