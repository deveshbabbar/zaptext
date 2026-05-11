import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';

export default async function EcommerceWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireClientWithBots();
  if (!user.allBots.some((b) => b.type === 'ecommerce')) redirect('/client/dashboard');
  if (user.activeBot && user.activeBot.type !== 'ecommerce' && user.allBots.length > 1) {
    redirect('/client/bots?need=ecommerce');
  }
  return <>{children}</>;
}
