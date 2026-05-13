// Recurring grocery subscriptions — customers who set up "every Monday
// morning, repeat last week's order". Owner can view + pause/resume +
// remove. Creating recurring orders happens in the customer-side
// WhatsApp flow, not here.

import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { listRecurring } from '@/lib/db/grocery-recurring-orders';
import { listSlots } from '@/lib/db/grocery-slots';
import { RecurringList } from './recurring-list';

export default async function GroceryRecurringPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'grocery') redirect('/client/dashboard');
  const [recurring, slots] = await Promise.all([
    listRecurring(user.activeBot.client_id).catch(() => []),
    listSlots(user.activeBot.client_id).catch(() => []),
  ]);
  const slotLabelById: Record<string, string> = {};
  for (const s of slots) slotLabelById[s.id] = s.label;
  return (
    <RecurringList
      businessName={user.activeBot.business_name}
      initialRecurring={recurring}
      slotLabelById={slotLabelById}
    />
  );
}
