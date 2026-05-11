// app/client/restaurant/menu/page.tsx
//
// Server entry — hands off to a client component that loads + edits the
// menuCategories slice of the active bot's knowledge base. Read happens
// against /api/client/settings (which already resolves the active bot
// from the session), so this page doesn't fetch anything server-side.

import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { MenuEditor } from './menu-editor';

export default async function RestaurantMenuPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'restaurant') {
    redirect('/client/dashboard');
  }
  return <MenuEditor businessName={user.activeBot.business_name} />;
}
