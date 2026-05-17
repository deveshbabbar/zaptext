// Public mobile menu page for dine-in customers.
// URL: /m/<clientId>/<tableNumber>/<sessionId>
//
// Lands customers who tapped the bot's menu link after scanning a QR.
// Renders the SAME polished storefront UI as /m/<clientId> (MenuPublicClient)
// but with the dine-in mode pre-locked + table number injected. Submit
// goes to /api/menu/submit with the sessionId so the order links to the
// table's live session.
//
// No auth: anyone with a valid (clientId, tableNumber, sessionId) tuple
// can submit. The submit API revalidates the session is still open.

import { notFound } from 'next/navigation';
import { getClientByIdOrSlug } from '@/lib/db/clients';
import { getOutletsForClient } from '@/lib/db/outlets';
import { getSessionById, getTable } from '@/lib/db/restaurant-dine-in';
import { getActiveInventory, isItemAvailableNow, findBestMatch, formatAvailabilityHuman } from '@/lib/inventory';
import { MenuPublicClient } from '../../menu-public-client';

interface MenuItem {
  name: string;
  price: string;
  description?: string;
  isVeg?: boolean;
  isBestseller?: boolean;
  sizes?: Array<{ label: string; price: number }> | null;
  allergens?: string[];
}
interface MenuCategory { category?: string; items?: MenuItem[] }

// Auto-extract size variants from free-text prices like "Half Rs.189 /
// Full Rs.329" — kept in sync with /m/[clientId]/page.tsx.
function parseSizesFromPriceString(raw: string): Array<{ label: string; price: number }> {
  if (!raw) return [];
  const segments = raw.split(/\s*\/\s*/);
  if (segments.length < 2) return [];
  const out: Array<{ label: string; price: number }> = [];
  for (const seg of segments) {
    const m = seg.trim().match(/^(.+?)\s*(?:Rs\.?|₹)?\s*(\d{1,5}(?:\.\d{1,2})?)\s*$/i);
    if (!m) return [];
    const label = m[1].trim().replace(/\s+/g, ' ');
    const price = parseFloat(m[2]);
    if (!label || !isFinite(price) || price <= 0) return [];
    out.push({ label, price });
  }
  return out.length >= 2 ? out : [];
}

export default async function TableSessionMenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string; table: string; session: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { clientId, table, session } = await params;
  // ?p=<digits> arrives from the bot's welcome WhatsApp link (it knows the
  // customer's WhatsApp number from msg.from). Forwarded into the
  // storefront's prefillPhone so checkout's "WhatsApp number" field is
  // already filled in — saves the customer typing it back to the bot.
  const { p: prefillPhone = '' } = await searchParams;

  // Subdomain rewrites land here with `clientId` = the storefront slug
  // ("tandoortadka"). Resolve via id-or-slug so the same route works
  // for legacy /m/<uuid>/... bot links AND <slug>.zaptext.shop/<table>/<session>.
  const client = await getClientByIdOrSlug(clientId).catch(() => null);
  if (!client || client.type !== 'restaurant') {
    notFound();
  }
  const canonicalClientId = client.client_id;

  const [sessionRow, tableRow] = await Promise.all([
    getSessionById(session).catch(() => null),
    getTable(canonicalClientId, table).catch(() => null),
  ]);

  if (!tableRow) {
    notFound();
  }

  const sessionValid =
    !!sessionRow &&
    sessionRow.client_id === canonicalClientId &&
    sessionRow.table_number === table &&
    sessionRow.status === 'open';

  // Session expired / closed → render a clear, simple notice instead of
  // dumping the customer into the menu where their submit would be
  // rejected later. Tells them to re-scan the QR.
  if (!sessionValid) {
    return (
      <div style={{
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 460,
        margin: '0 auto',
        padding: '60px 24px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 56, marginBottom: 14 }}>⏰</div>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Session expired</h1>
        <p style={{ color: '#444', marginBottom: 14, fontSize: 14, lineHeight: 1.55 }}>
          Your Table {table} session at <b>{client.business_name}</b> has closed. Please re-scan the QR code at your table to start a new session.
        </p>
        <p style={{ color: '#666', fontSize: 13, lineHeight: 1.5 }}>
          Apke Table {table} ka session band ho gaya hai. Table par naya QR scan karke phir order shuru karein.
        </p>
      </div>
    );
  }

  // ── Parse menu from knowledge_base_json into FlatItem[] ────────────────
  let menu: MenuCategory[] = [];
  let brandLogoUrl = '';
  let brandColor = '';
  let tagline = '';
  let cuisineType = '';
  let workingHours = '';
  let address = '';
  let palette = '';
  let fssaiLicenseNumber = '';
  let gstin = '';
  let pureVeg = false;
  let jainCertified = false;
  let sharedKitchenWithNonVeg = false;
  let fssaiExpiryDate = '';
  let fssaiCentralLicence = false;
  let outletCount = 1;
  let rainSurchargePercent = 0;
  let peakHourSurchargePercent = 0;
  let festivalSurchargePercent = 0;
  let deliveryCharges = '';
  let packagingChargesPerOrder = '';
  let packagingChargesPerItem = '';
  let minimumOrder = '';
  let deliveryRadius = '';
  try {
    const kb = client.knowledge_base_json
      ? (JSON.parse(client.knowledge_base_json) as Record<string, unknown>)
      : {};
    if (Array.isArray(kb.menuCategories)) menu = kb.menuCategories as MenuCategory[];
    if (typeof kb.brandLogoUrl === 'string') brandLogoUrl = kb.brandLogoUrl;
    if (typeof kb.brandColor === 'string') brandColor = kb.brandColor;
    if (typeof kb.tagline === 'string') tagline = kb.tagline;
    if (typeof kb.cuisineType === 'string') cuisineType = kb.cuisineType;
    if (typeof kb.workingHours === 'string') workingHours = kb.workingHours;
    if (typeof kb.address === 'string') address = kb.address;
    if (typeof kb.palette === 'string') palette = kb.palette;
    if (typeof kb.fssaiLicenseNumber === 'string') fssaiLicenseNumber = kb.fssaiLicenseNumber;
    if (typeof kb.fssaiExpiryDate === 'string') fssaiExpiryDate = kb.fssaiExpiryDate;
    if (typeof kb.fssaiCentralLicence === 'boolean') fssaiCentralLicence = kb.fssaiCentralLicence;
    if (typeof kb.outletCount === 'number' && kb.outletCount > 0) outletCount = kb.outletCount;
    if (typeof kb.gstin === 'string') gstin = kb.gstin;
    if (typeof kb.jainCertified === 'boolean') jainCertified = kb.jainCertified;
    if (typeof kb.pureVeg === 'boolean') pureVeg = kb.pureVeg;
    if (typeof kb.sharedKitchenWithNonVeg === 'boolean') sharedKitchenWithNonVeg = kb.sharedKitchenWithNonVeg;
    if (typeof kb.rainSurchargePercent === 'number') rainSurchargePercent = kb.rainSurchargePercent;
    if (typeof kb.peakHourSurchargePercent === 'number') peakHourSurchargePercent = kb.peakHourSurchargePercent;
    if (typeof kb.festivalSurchargePercent === 'number') festivalSurchargePercent = kb.festivalSurchargePercent;
    if (typeof kb.deliveryCharges === 'string') deliveryCharges = kb.deliveryCharges;
    if (typeof kb.packagingChargesPerOrder === 'string') packagingChargesPerOrder = kb.packagingChargesPerOrder;
    if (typeof kb.packagingChargesPerItem === 'string') packagingChargesPerItem = kb.packagingChargesPerItem;
    if (typeof kb.minimumOrder === 'string') minimumOrder = kb.minimumOrder;
    if (typeof kb.deliveryRadius === 'string') deliveryRadius = kb.deliveryRadius;
  } catch { /* ignore */ }

  const calorieDisclosureRequired = fssaiCentralLicence || outletCount >= 10;

  const flatItems: Array<{
    id: string;
    category: string;
    name: string;
    price: string;
    description: string;
    isVeg: boolean;
    isBestseller: boolean;
    sizes: Array<{ label: string; price: number }>;
    allergens: string[];
    unavailable?: boolean;
    unavailableReason?: string;
  }> = [];
  menu.forEach((cat, ci) => {
    (cat.items || []).forEach((it, ii) => {
      const name = (it.name || '').trim();
      if (!name) return;
      let validSizes: Array<{ label: string; price: number }> = Array.isArray(it.sizes)
        ? it.sizes
            .filter((s): s is { label: string; price: number } =>
              !!s && typeof s.label === 'string' && typeof s.price === 'number' && s.price > 0
            )
            .map((s) => ({ label: s.label, price: s.price }))
        : [];
      if (validSizes.length === 0) {
        validSizes = parseSizesFromPriceString(it.price || '');
      }
      const allergens = Array.isArray(it.allergens)
        ? it.allergens.filter((a): a is string => typeof a === 'string' && a.length > 0)
        : [];
      flatItems.push({
        id: `${ci}-${ii}`,
        category: (cat.category || 'Menu').trim() || 'Menu',
        name,
        price: it.price || '',
        description: it.description || '',
        isVeg: it.isVeg !== false,
        isBestseller: !!it.isBestseller,
        sizes: validSizes,
        allergens,
      });
    });
  });

  // ── Live inventory-driven availability (same rules as the storefront) ──
  // Zomato-style "Currently not available" badge for sold-out / paused /
  // out-of-time-window items. Non-fatal — DB hiccup leaves everything as
  // available rather than black-holing the menu.
  try {
    const inv = await getActiveInventory(canonicalClientId);
    if (inv.length > 0) {
      for (const fi of flatItems) {
        const match = findBestMatch(inv, fi.name);
        if (!match) continue;
        if (match.is_active === false) {
          fi.unavailable = true;
          fi.unavailableReason = 'Currently paused by the kitchen';
          continue;
        }
        if (match.tracks_stock !== false && match.stock <= 0) {
          fi.unavailable = true;
          fi.unavailableReason = 'Out of stock right now';
          continue;
        }
        if (!isItemAvailableNow(match)) {
          fi.unavailable = true;
          fi.unavailableReason = `Available ${formatAvailabilityHuman(match)}`;
          continue;
        }
      }
    }
  } catch (err) {
    console.error('[table-session] inventory availability resolve failed (non-fatal):', err);
  }

  // ── Render the polished MenuPublicClient with dine-in mode pre-locked ──
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
      />
      <MenuPublicClient
        businessName={client.business_name}
        clientId={canonicalClientId}
        items={flatItems}
        brandLogoUrl={brandLogoUrl}
        brandColor={brandColor}
        tagline={tagline}
        city={client.city}
        cuisineType={cuisineType}
        workingHours={workingHours}
        phone={client.contact_number || client.whatsapp_number}
        address={address}
        palette={palette}
        prefillPhone={prefillPhone}
        // QR-scan customer is physically at the table — only dine-in
        // makes sense. The MenuPublicClient + DesktopView/MobileView
        // honour these flags to suppress the mode picker for delivery
        // / takeaway. dineInLock additionally pre-fills the table
        // number and forwards sessionId on submit.
        deliveryAvailable={false}
        dineInEnabled
        takeawayEnabled={false}
        dineInLock={{ tableNumber: table, sessionId: session }}
        compliance={{
          fssaiLicenseNumber,
          fssaiExpiryDate,
          gstin,
          jainCertified,
          pureVeg,
          sharedKitchenWithNonVeg,
          calorieDisclosureRequired,
        }}
        pricing={{
          rainSurchargePercent,
          peakHourSurchargePercent,
          festivalSurchargePercent,
          deliveryCharges,
          packagingChargesPerOrder,
          packagingChargesPerItem,
          minimumOrder,
          deliveryRadius,
        }}
        outletMarkers={(await getOutletsForClient(canonicalClientId).catch(() => []))
          .filter((o) => o.isActive && typeof o.latitude === 'number' && typeof o.longitude === 'number')
          .map((o) => ({
            id: o.id,
            slug: o.slug,
            name: o.name,
            latitude: o.latitude as number,
            longitude: o.longitude as number,
            deliveryRadiusKm: o.deliveryRadiusKm,
          }))}
      />
    </>
  );
}
