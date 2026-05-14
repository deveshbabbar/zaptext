// app/client/restaurant/specials/page.tsx
//
// Server entry — hands off to a client component that loads the active bot's
// knowledge_base, lets the owner edit dailySpecial + specialOffers fields,
// and saves them back. These fields already flow into the bot's prompt so
// the bot quotes the offer when customers ask "kuch offer hai aaj?".

import { redirect } from 'next/navigation';
import { requireRestaurantViewer } from '@/lib/restaurant/viewer-context';
import { SpecialsEditor } from './specials-editor';

export default async function RestaurantSpecialsPage() {
  // Phase 3I v2 — Specials are chain-wide today (per-outlet specials
  // is a future migration). Owner-only edits; outlet managers bounce
  // to overview rather than seeing an editor that they can't save
  // (avoids the confusing "I edited but nothing happened" trap).
  const viewer = await requireRestaurantViewer();
  if (viewer.role !== 'owner') {
    redirect('/client/restaurant');
  }
  return <SpecialsEditor businessName={viewer.activeBot.business_name} />;
}
