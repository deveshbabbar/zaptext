// Sibling-navigation Suspense fallback for /client/gym/*.
// app/client/loading.tsx is invisible to navigations whose entry point
// is this vertical's own layout — see components/client/route-loading.tsx.
import { RouteLoading } from '@/components/client/route-loading';

export default function GymLoading() {
  return <RouteLoading />;
}
