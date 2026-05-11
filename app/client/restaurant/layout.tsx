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
  const hasRestaurantBot = user.allBots.some((b) => b.type === 'restaurant');
  if (!hasRestaurantBot) redirect('/client/dashboard');
  // If owner has multiple bots but the active one isn't restaurant, send
  // them to the bot switcher first so they pick the right context.
  if (user.activeBot && user.activeBot.type !== 'restaurant' && user.allBots.length > 1) {
    redirect('/client/bots?need=restaurant');
  }
  return <>{children}</>;
}
