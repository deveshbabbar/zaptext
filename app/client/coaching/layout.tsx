import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';

export default async function CoachingWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireClientWithBots();
  if (!user.allBots.some((b) => b.type === 'coaching')) redirect('/client/dashboard');
  if (user.activeBot && user.activeBot.type !== 'coaching' && user.allBots.length > 1) {
    redirect('/client/bots?need=coaching');
  }
  return <>{children}</>;
}
