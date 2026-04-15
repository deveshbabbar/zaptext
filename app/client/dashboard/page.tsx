import { requireClientWithBots } from '@/lib/auth';
import { ClientDashboard } from '@/components/client/dashboard-view';
import { BUSINESS_TYPES } from '@/lib/constants';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot) redirect('/client/create-bot');

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
