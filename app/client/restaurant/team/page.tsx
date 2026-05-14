// app/client/restaurant/team/page.tsx
//
// Server entry — owner-only Team Members page. Lists outlet manager
// assignments and lets the owner invite, swap email, or revoke
// access without ever losing outlet data (data invariant from 3D:
// data keyed on outlet_id, never on email).

import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { TeamMembersClient } from './team-members-client';

export default async function RestaurantTeamPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'restaurant') {
    redirect('/client/dashboard');
  }
  return <TeamMembersClient businessName={user.activeBot.business_name} />;
}
