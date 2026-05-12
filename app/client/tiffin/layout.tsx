import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';

export default async function TiffinWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireClientWithBots();
  if (!user.allBots.some((b) => b.type === 'tiffin')) redirect('/client/dashboard');
  return <>{children}</>;
}
