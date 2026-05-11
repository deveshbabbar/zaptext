import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';

export default async function TiffinWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireClientWithBots();
  if (!user.allBots.some((b) => b.type === 'tiffin')) redirect('/client/dashboard');
  if (user.activeBot && user.activeBot.type !== 'tiffin' && user.allBots.length > 1) {
    redirect('/client/bots?need=tiffin');
  }
  return <>{children}</>;
}
