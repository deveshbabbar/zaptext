// app/admin/grocery/recurring/page.tsx
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getClientByOwnerUserId } from '@/lib/db/clients';
import { listRecurring } from '@/lib/db/grocery-recurring-orders';
import RecurringList from './_components/recurring-list';
import { PageTopbar, PageHead } from '@/components/app/primitives';

export default async function RecurringPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const c = await getClientByOwnerUserId(userId);
  if (!c || c.type !== 'grocery') redirect('/admin');
  const recurring = await listRecurring(c.client_id);
  return (
    <>
      <PageTopbar
        crumbs={
          <>
            Admin · Grocery · <b className="text-foreground">Recurring</b>
          </>
        }
      />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead
          title={
            <>
              Recurring <span className="zt-serif">orders.</span>
            </>
          }
          sub={`Customers who set "har [day] repeat". Each instance still requires their confirm — nothing is auto-placed.`}
        />
        <RecurringList initial={recurring} />
      </div>
    </>
  );
}
