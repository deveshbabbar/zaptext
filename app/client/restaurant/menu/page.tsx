// app/client/restaurant/menu/page.tsx
//
// Server entry — hands off to a client component that loads + edits the
// menuCategories slice of the active bot's knowledge base. Read happens
// against /api/client/settings (which already resolves the active bot
// from the session), so this page doesn't fetch anything server-side.

import { redirect } from 'next/navigation';
import { requireRestaurantViewer } from '@/lib/restaurant/viewer-context';
import { MenuEditor } from './menu-editor';

export default async function RestaurantMenuPage() {
  // Phase 3I v2 — Menu is chain-wide; outlet-specific menu variants
  // are a future feature. Owner-only edits; outlet managers bounce
  // to overview rather than seeing an editor they can't save.
  const viewer = await requireRestaurantViewer();
  if (viewer.role !== 'owner') {
    redirect('/client/restaurant');
  }
  return <MenuEditor businessName={viewer.activeBot.business_name} />;
}
