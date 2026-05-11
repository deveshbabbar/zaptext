import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';

export default async function RealEstateWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireClientWithBots();
  if (!user.allBots.some((b) => b.type === 'realestate')) redirect('/client/dashboard');
  if (user.activeBot && user.activeBot.type !== 'realestate' && user.allBots.length > 1) {
    redirect('/client/bots?need=realestate');
  }
  return <>{children}</>;
}
