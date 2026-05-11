import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';

export default async function GymWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireClientWithBots();
  if (!user.allBots.some((b) => b.type === 'gym')) redirect('/client/dashboard');
  if (user.activeBot && user.activeBot.type !== 'gym' && user.allBots.length > 1) {
    redirect('/client/bots?need=gym');
  }
  return <>{children}</>;
}
