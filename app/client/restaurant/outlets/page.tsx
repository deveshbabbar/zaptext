// app/client/restaurant/outlets/page.tsx
//
// Server entry — gates access (must be restaurant client) and hands off
// to the client editor. Outlets editing is owner-only at the API level;
// outlet managers see no menu item for this page (3I dashboard
// scoping).

import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { OutletsEditor } from './outlets-editor';

export default async function RestaurantOutletsPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'restaurant') {
    redirect('/client/dashboard');
  }
  return <OutletsEditor businessName={user.activeBot.business_name} />;
}
