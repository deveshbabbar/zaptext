// app/client/restaurant/brands/page.tsx
//
// Server entry for the Brands workspace. Multi-brand cloud kitchens
// (Rebel / Charcoal Eats pattern) edit each brand-front + its full
// menu here, post-onboarding. Single-brand restaurants get an empty
// state nudging them back to the regular Menu page.

import { redirect } from 'next/navigation';
import { requireRestaurantViewer } from '@/lib/restaurant/viewer-context';
import { BrandsEditor } from './brands-editor';

export default async function RestaurantBrandsPage() {
  const viewer = await requireRestaurantViewer();
  if (viewer.role !== 'owner') {
    redirect('/client/restaurant');
  }
  return <BrandsEditor businessName={viewer.activeBot.business_name} />;
}
