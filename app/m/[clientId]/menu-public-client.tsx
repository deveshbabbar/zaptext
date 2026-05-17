'use client';

// Customer-facing storefront entry. Thin viewport-aware shim that routes
// to the new design-system views in lib/storefront-ui/. Desktop visitors
// (≥1024px) see the 3-column layout in DesktopView; mobile visitors see
// the sage-banner shell in MobileView. Both views share the same order
// submission path (`POST /api/menu/submit`).
//
// Older versions of this file rendered the entire ordering UX inline.
// That code is now gone — the design-system rebuild moved all rendering
// into lib/storefront-ui/{desktop-view, mobile-view}.tsx. The page route
// (app/m/[clientId]/page.tsx) is the only caller; the prop surface below
// is preserved as-is so page.tsx doesn't need updating. Props that the
// rebuilt views don't consume yet (compliance, pricing.*, prefillQuery,
// outletMarkers, bypassRecentOrderGuard) are accepted-and-ignored —
// page.tsx still passes them in case D3/D4 wires them back in.

import { useEffect, useState } from 'react';
import { DesktopView } from '@/lib/storefront-ui/desktop-view';
import { MobileView } from '@/lib/storefront-ui/mobile-view';

// ─── Public-facing types ─────────────────────────────────────────────
//
// These are also referenced by app/m/[clientId]/page.tsx when it
// builds the items array on the server, so they live at module scope
// (not buried inside the new views) to keep that contract stable.

export interface FlatItem {
  id: string;
  category: string;
  name: string;
  price: string;
  description: string;
  isVeg: boolean;
  isBestseller: boolean;
  sizes: Array<{ label: string; price: number }>;
  allergens: string[];
}

interface OutletMarker {
  id: string;
  slug: string;
  name: string;
  latitude: number;
  longitude: number;
  deliveryRadiusKm?: number;
}

interface ComplianceInfo {
  fssaiLicenseNumber?: string;
  fssaiExpiryDate?: string;
  gstin?: string;
  jainCertified?: boolean;
  pureVeg?: boolean;
  sharedKitchenWithNonVeg?: boolean;
  calorieDisclosureRequired?: boolean;
}

interface PricingInfo {
  rainSurchargePercent?: number;
  peakHourSurchargePercent?: number;
  festivalSurchargePercent?: number;
  deliveryCharges?: string;
  packagingChargesPerOrder?: string;
  packagingChargesPerItem?: string;
  minimumOrder?: string;
  deliveryRadius?: string;
}

interface Props {
  businessName: string;
  clientId: string;
  items: FlatItem[];
  brandLogoUrl?: string;
  brandColor?: string;
  /** Wide hero image — currently unused by the new design (sage hero
   *  paints the banner). Kept in the prop surface so page.tsx can
   *  continue passing it without compile errors; D4 will either wire
   *  it back as an owner-controlled background or drop the field. */
  coverImageUrl?: string;
  tagline?: string;
  city?: string;
  cuisineType?: string;
  workingHours?: string;
  phone?: string;
  address?: string;
  /** Owner-chosen storefront palette name. One of sage / forest / olive /
   *  charcoal / terracotta — anything else (including empty) falls back
   *  to sage at render time. */
  palette?: string;
  prefillPhone?: string;
  deliveryAvailable?: boolean;
  dineInEnabled?: boolean;
  takeawayEnabled?: boolean;
  compliance?: ComplianceInfo;
  pricing?: PricingInfo;
  /** Voice / typed order pre-fill from the bot. Not yet wired into
   *  the new views — D3 will re-introduce the auto-add-to-cart flow. */
  prefillQuery?: string;
  prefillLat?: number | null;
  prefillLng?: number | null;
  outletMarkers?: OutletMarker[];
  bypassRecentOrderGuard?: boolean;
  /** QR-scan / table-session lock — forces dine-in mode and pre-fills
   *  the table number. Set only by the /m/<clientId>/<table>/<session>
   *  route; left undefined by the plain storefront. */
  dineInLock?: { tableNumber: string; sessionId: string };
}

export function MenuPublicClient({
  businessName,
  clientId,
  items,
  brandLogoUrl,
  brandColor,
  tagline,
  city,
  cuisineType,
  workingHours,
  phone,
  address,
  palette,
  prefillPhone,
  deliveryAvailable = true,
  dineInEnabled = true,
  takeawayEnabled = true,
  compliance,
  pricing,
  dineInLock,
}: Props) {
  // Viewport split. SSR defaults to mobile (false) so the initial
  // payload is the smaller mobile shell; the matchMedia effect
  // upgrades to desktop client-side. matchMedia('change') listener
  // keeps the layout reactive to resize so a desktop user shrinking
  // their window smoothly transitions to mobile.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Shared prop set — both views read from the same shape so a
  // missing/extra field shows up the same way in both surfaces.
  const sharedProps = {
    clientId,
    businessName,
    tagline,
    brandColor,
    brandLogoUrl,
    city,
    cuisineType,
    workingHours,
    phone,
    address,
    palette,
    deliveryRadius: pricing?.deliveryRadius,
    minimumOrder: pricing?.minimumOrder,
    fssaiLicenseNumber: compliance?.fssaiLicenseNumber,
    gstin: compliance?.gstin,
    deliveryAvailable,
    takeawayEnabled,
    dineInEnabled,
    items,
    prefillPhone,
    dineInLock,
  };

  return isDesktop ? <DesktopView {...sharedProps} /> : <MobileView {...sharedProps} />;
}
