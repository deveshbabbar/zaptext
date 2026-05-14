// app/client/restaurant/layout.tsx
//
// Restaurant vertical workspace shell. The parent /client/layout.tsx already
// renders the global sidebar + bot switcher + plan badge, so this layout
// is just an auth gate: confirm the logged-in owner has a restaurant bot
// active (or any restaurant bot in their account) and otherwise bounce
// them back to the generic dashboard.

import { requireRestaurantViewer } from '@/lib/restaurant/viewer-context';

export default async function RestaurantWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Phase 3I v2 — works for BOTH owners (they have a restaurant bot)
  // AND outlet managers (they have an active team_members membership
  // for a restaurant bot, but no owned bot of their own). Anyone
  // else gets redirected by the viewer-context's own fallback.
  await requireRestaurantViewer();
  return <>{children}</>;
}
