import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { ServicesEditor } from './services-editor';

export default async function SalonServicesPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'salon') redirect('/client/dashboard');
  return <ServicesEditor businessName={user.activeBot.business_name} />;
}
