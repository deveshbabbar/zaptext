// app/client/restaurant/outlets/page.tsx
//
// Server entry — gates access (must be restaurant client) and hands off
// to the client editor. Outlets editing is owner-only at the API level;
// outlet managers see no menu item for this page (3I dashboard
// scoping).

import { redirect } from 'next/navigation';
import { requireRestaurantViewer } from '@/lib/restaurant/viewer-context';
import { OutletsEditor } from './outlets-editor';

export default async function RestaurantOutletsPage() {
  const viewer = await requireRestaurantViewer();
  // Owner-only — outlet managers can't add / edit / archive outlets.
  // Their dashboard nav already hides this link (3I v2 sidebar gating),
  // but enforce server-side too so direct URLs are caught.
  if (viewer.role !== 'owner') {
    redirect('/client/restaurant');
  }
  return <OutletsEditor businessName={viewer.activeBot.business_name} />;
}
