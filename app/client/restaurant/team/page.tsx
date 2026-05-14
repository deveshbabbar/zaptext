// app/client/restaurant/team/page.tsx
//
// Server entry — owner-only Team Members page. Lists outlet manager
// assignments and lets the owner invite, swap email, or revoke
// access without ever losing outlet data (data invariant from 3D:
// data keyed on outlet_id, never on email).

import { redirect } from 'next/navigation';
import { requireRestaurantViewer } from '@/lib/restaurant/viewer-context';
import { TeamMembersClient } from './team-members-client';

export default async function RestaurantTeamPage() {
  const viewer = await requireRestaurantViewer();
  // Owner-only — outlet managers can't see or modify team assignments
  // (including their own). Sidebar hides this link for them too.
  if (viewer.role !== 'owner') {
    redirect('/client/restaurant');
  }
  return <TeamMembersClient businessName={viewer.activeBot.business_name} />;
}
