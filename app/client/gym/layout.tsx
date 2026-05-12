import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';

export default async function GymWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireClientWithBots();
  if (!user.allBots.some((b) => b.type === 'gym')) redirect('/client/dashboard');
  return <>{children}</>;
}
