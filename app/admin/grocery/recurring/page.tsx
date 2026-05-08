// app/admin/grocery/recurring/page.tsx
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getClientByOwnerUserId } from '@/lib/db/clients';
import { listRecurring } from '@/lib/db/grocery-recurring-orders';
import RecurringList from './_components/recurring-list';

export default async function RecurringPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const c = await getClientByOwnerUserId(userId);
  if (!c || c.type !== 'grocery') redirect('/admin');
  const recurring = await listRecurring(c.client_id);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Recurring orders</h1>
      <p className="text-sm text-neutral-400">
        Customers who set &quot;har [day] repeat&quot;. Each instance still requires their confirm —
        nothing is auto-placed.
      </p>
      <RecurringList initial={recurring} />
    </div>
  );
}
