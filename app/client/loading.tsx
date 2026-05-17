// Route-level loading for /client/* navigations whose entry point is
// at or above app/client/layout.tsx (e.g. landing → /client/dashboard,
// /client/dashboard → /client/conversations).
//
// Sibling navigations under a vertical workspace (e.g. /client/restaurant/menu
// → /client/restaurant/tables) DO NOT hit this fallback — their entry
// point is the vertical's own layout, which sits below this file. Those
// transitions are covered by the per-vertical loading.tsx files in each
// of app/client/{coaching,ecommerce,gym,realestate,restaurant,salon,
// tiffin}/loading.tsx, which all re-export the same RouteLoading.
//
// See node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md
// for the entry-point rule that drives this layout.

import { RouteLoading } from '@/components/client/route-loading';

export default function ClientLoading() {
  return <RouteLoading />;
}
