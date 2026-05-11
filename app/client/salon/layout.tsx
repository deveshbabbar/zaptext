import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';

export default async function SalonWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireClientWithBots();
  if (!user.allBots.some((b) => b.type === 'salon')) redirect('/client/dashboard');
  if (user.activeBot && user.activeBot.type !== 'salon' && user.allBots.length > 1) {
    redirect('/client/bots?need=salon');
  }
  return <>{children}</>;
}
