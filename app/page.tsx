import { getUserRole } from '@/lib/auth';
import { redirect } from 'next/navigation';
import LandingPage from '@/components/landing/landing-page';

export default async function Home() {
  const user = await getUserRole();
  if (user?.role === 'admin') redirect('/admin/dashboard');
  if (user?.role === 'client') redirect('/client/dashboard');

  return <LandingPage />;
}
