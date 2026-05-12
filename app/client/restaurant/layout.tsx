// app/client/restaurant/layout.tsx
//
// Restaurant vertical workspace shell. The parent /client/layout.tsx already
// renders the global sidebar + bot switcher + plan badge, so this layout
// is just an auth gate: confirm the logged-in owner has a restaurant bot
// active (or any restaurant bot in their account) and otherwise bounce
// them back to the generic dashboard.

import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';

export default async function RestaurantWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireClientWithBots();
  // Only bounce if the owner doesn't have ANY restaurant bot. The
  // previous "wrong active bot → redirect to /client/bots" check has
  // been removed — the sidebar now only shows the restaurant items
  // when the active bot IS restaurant, so users hitting these URLs
  // are already on the right context.
  if (!user.allBots.some((b) => b.type === 'restaurant')) redirect('/client/dashboard');
  return <>{children}</>;
}
