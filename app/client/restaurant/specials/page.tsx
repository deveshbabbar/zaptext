// app/client/restaurant/specials/page.tsx
//
// Server entry — hands off to a client component that loads the active bot's
// knowledge_base, lets the owner edit dailySpecial + specialOffers fields,
// and saves them back. These fields already flow into the bot's prompt so
// the bot quotes the offer when customers ask "kuch offer hai aaj?".

import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { SpecialsEditor } from './specials-editor';

export default async function RestaurantSpecialsPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'restaurant') {
    redirect('/client/dashboard');
  }
  return <SpecialsEditor businessName={user.activeBot.business_name} />;
}
