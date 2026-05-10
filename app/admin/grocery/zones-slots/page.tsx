import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getClientByOwnerUserId } from '@/lib/db/clients';
import { listZones } from '@/lib/db/grocery-zones';
import { listSlots } from '@/lib/db/grocery-slots';
import { listGroups } from '@/lib/db/grocery-substitution-groups';
import { listProducts } from '@/lib/db/grocery-products';
import ZonesCard from './_components/zones-card';
import SlotsCard from './_components/slots-card';
import SubGroupsCard from './_components/sub-groups-card';
import { PageTopbar, PageHead, Pill } from '@/components/app/primitives';

export default async function ZonesSlotsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const c = await getClientByOwnerUserId(userId);
  if (!c || c.type !== 'grocery') redirect('/admin');
  const [zones, slots, groups, products] = await Promise.all([
    listZones(c.client_id),
    listSlots(c.client_id),
    listGroups(c.client_id),
    listProducts(c.client_id),
  ]);
  return (
    <>
      <PageTopbar
        crumbs={
          <>
            Admin · Grocery · <b className="text-foreground">Zones &amp; slots</b>
          </>
        }
        actions={
          <Pill variant="ghost" href="/admin/grocery/today">
            Update list
          </Pill>
        }
      />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead
          title={
            <>
              Zones &amp; <span className="zt-serif">slots.</span>
            </>
          }
          sub="Where you deliver, when, and substitution groups for out-of-stock items."
        />
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ZonesCard initial={zones} />
            <SlotsCard initial={slots} />
          </div>
          <SubGroupsCard initial={groups} products={products} />
        </div>
      </div>
    </>
  );
}
