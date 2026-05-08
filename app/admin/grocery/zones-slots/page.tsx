import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getClientByOwnerUserId } from '@/lib/db/clients';
import { listZones } from '@/lib/db/grocery-zones';
import { listSlots } from '@/lib/db/grocery-slots';
import ZonesCard from './_components/zones-card';
import SlotsCard from './_components/slots-card';

export default async function ZonesSlotsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const c = await getClientByOwnerUserId(userId);
  if (!c || c.type !== 'grocery') redirect('/admin');
  const [zones, slots] = await Promise.all([listZones(c.client_id), listSlots(c.client_id)]);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <ZonesCard initial={zones} />
      <SlotsCard initial={slots} />
    </div>
  );
}
