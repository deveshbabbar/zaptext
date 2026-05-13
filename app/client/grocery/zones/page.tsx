// Delivery zones — pincode + area-keyword based zones with delivery fee
// + min-order rules. Bot uses these to validate "do you deliver to X?"
// queries from customers.

import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { listZones } from '@/lib/db/grocery-zones';
import { ZonesEditor } from './zones-editor';

export default async function GroceryZonesPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'grocery') redirect('/client/dashboard');
  const zones = await listZones(user.activeBot.client_id).catch(() => []);
  return <ZonesEditor businessName={user.activeBot.business_name} initialZones={zones} />;
}
