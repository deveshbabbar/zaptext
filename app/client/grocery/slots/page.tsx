// Delivery slots — time windows owner makes available per day-of-week.
// Customers pick from these when placing an order. Cutoff time controls
// the latest the bot accepts an order for that slot.

import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { listSlots } from '@/lib/db/grocery-slots';
import { SlotsEditor } from './slots-editor';

export default async function GrocerySlotsPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'grocery') redirect('/client/dashboard');
  const slots = await listSlots(user.activeBot.client_id).catch(() => []);
  return <SlotsEditor businessName={user.activeBot.business_name} initialSlots={slots} />;
}
