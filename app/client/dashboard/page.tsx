import { requireClientWithBots } from '@/lib/auth';
import { ClientDashboard } from '@/components/client/dashboard-view';
import { BUSINESS_TYPES } from '@/lib/constants';
import { findActiveMembershipForEmail } from '@/lib/db/team-members';
import { getClientById } from '@/lib/db/clients';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot) {
    // No owned bot. They might be an INVITED outlet manager of someone
    // else's chain — land them directly on the outlet workspace instead
    // of dragging them through the create-bot onboarding wizard (which
    // would prompt them to create a brand-new bot they don't need).
    if (user.email) {
      const memberships = await findActiveMembershipForEmail(user.email).catch(() => []);
      for (const m of memberships) {
        const ownerBot = await getClientById(m.owner_client_id).catch(() => null);
        if (ownerBot?.type === 'restaurant') {
          redirect('/client/restaurant');
        }
      }
    }
    redirect('/client/create-bot');
  }

  const meta = BUSINESS_TYPES.find((bt) => bt.type === user.activeBot!.type);

  return (
    <ClientDashboard
      userName={user.name || 'there'}
      activeBot={user.activeBot}
      allBotsCount={user.allBots.length}
      icon={meta?.icon || '🤖'}
    />
  );
}
