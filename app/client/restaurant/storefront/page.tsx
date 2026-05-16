// app/client/restaurant/storefront/page.tsx
//
// Settings page for the public storefront at <slug>.zaptext.shop. Mirrors
// the pattern used by other restaurant sub-pages (outlets, qr-codes, team):
// server component does the auth + role gate, hands off to a client form
// that owns the fetch + save loop.

import { redirect } from 'next/navigation';
import { requireRestaurantViewer } from '@/lib/restaurant/viewer-context';
import { PageTopbar, PageHead } from '@/components/app/primitives';
import { StorefrontForm } from './storefront-form';

export default async function RestaurantStorefrontPage() {
  const viewer = await requireRestaurantViewer();
  // Owner-only — outlet managers can't change the chain-level storefront
  // URL or master enable flag. Same scoping rule as /outlets.
  if (viewer.role !== 'owner') {
    redirect('/client/restaurant');
  }

  return (
    <>
      <PageTopbar
        crumbs={
          <>
            Restaurant / <b className="text-foreground">Storefront</b>
          </>
        }
      />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead
          title={
            <>
              Online <span className="zt-serif">storefront.</span>
            </>
          }
          sub="Give your restaurant its own ordering website at <your-slug>.zaptext.shop — customers see your full menu, pick delivery / takeaway / dine-in, and pay via UPI screenshot. Powered by the same menu the WhatsApp bot uses."
        />
        <StorefrontForm />
      </div>
    </>
  );
}
