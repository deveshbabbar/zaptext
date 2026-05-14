// Public menu + order page for ANY restaurant customer (no QR scan needed).
// URL: /m/<clientId>?p=<customerPhone>
//
// Sister page of /m/<clientId>/<table>/<session> (the dine-in QR flow).
// This route serves customers who got a menu LINK from the bot in chat
// rather than scanning a physical table QR. Customer picks delivery /
// takeaway / dine-in (with table number) on the page itself.
//
// No auth: anyone with the URL can submit. The submit endpoint
// (/api/menu/submit) writes the order and sends a WhatsApp confirmation
// back to the phone number the customer enters (or the ?p= prefill if
// the bot included it in the link).

import { notFound } from 'next/navigation';
import { getClientById } from '@/lib/db/clients';
import { MenuPublicClient } from './menu-public-client';

interface MenuItem {
  name: string;
  price: string;
  description?: string;
  isVeg?: boolean;
  isBestseller?: boolean;
  sizes?: Array<{ label: string; price: number }> | null;
}
interface MenuCategory { category?: string; items?: MenuItem[] }

// Detect "Half Rs.189 / Full Rs.329" / "Quarter Rs.199 / Half Rs.359 / Full Rs.649"
// / "Glass Rs.79 / Jug Rs.219" / "2 pcs Rs.89 / 4 pcs Rs.169" patterns in
// the free-text price string and auto-extract structured size variants.
//
// We use this when the menuCategories item didn't ship with a sizes[]
// array (most legacy + DEMO_BUNDLES rows). Without this, the customer
// could only order at the FIRST price (e.g. "Half") because parsePrice
// just grabbed the first number — Full/Jug/larger variants were lost.
function parseSizesFromPriceString(raw: string): Array<{ label: string; price: number }> {
  if (!raw) return [];
  // Split on slash or " / " — covers most observed separators.
  const segments = raw.split(/\s*\/\s*/);
  if (segments.length < 2) return [];
  const out: Array<{ label: string; price: number }> = [];
  for (const seg of segments) {
    // Match "Label Rs.123" / "Label ₹123" / "Label 123"; label = leading
    // text up to the price token. Accepts trailing words too (e.g. "2 pcs").
    const m = seg.trim().match(/^(.+?)\s*(?:Rs\.?|₹)?\s*(\d{1,5}(?:\.\d{1,2})?)\s*$/i);
    if (!m) return []; // any segment that doesn't parse → bail, treat as single price
    const label = m[1].trim().replace(/\s+/g, ' ');
    const price = parseFloat(m[2]);
    if (!label || !isFinite(price) || price <= 0) return [];
    out.push({ label, price });
  }
  return out.length >= 2 ? out : [];
}

export default async function PublicMenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { clientId } = await params;
  const { p: prefillPhone = '' } = await searchParams;

  const client = await getClientById(clientId).catch(() => null);
  if (!client || client.type !== 'restaurant') notFound();

  let menu: MenuCategory[] = [];
  let brandLogoUrl = '';
  let brandColor = '';
  let tagline = '';
  let deliveryAvailable = true;
  let dineInEnabled = true;
  let takeawayEnabled = true;
  // Compliance disclosures rendered in the page footer / item-row icons.
  // FSSAI Reg 2.4.6 (Aug 2020 gazette) requires veg/non-veg symbol per
  // item for ALL food business operators; allergen disclosure for the 8
  // mandated allergens; calorie/serving info only for FBOs with a
  // central licence OR ≥10 outlets. We surface what the owner has
  // provided; we never invent missing data.
  let fssaiLicenseNumber = '';
  let fssaiExpiryDate = '';
  let fssaiCentralLicence = false;
  let outletCount = 1;
  let gstin = '';
  let halalCertified = false;
  let halalCertNumber = '';
  let jainCertified = false;
  let pureVeg = false;
  let sharedKitchenWithNonVeg = false;
  // Pricing disclosures rendered as a banner ABOVE the menu — CCPA Dark
  // Patterns Guidelines 2023 prohibit "drip pricing" (revealing extra
  // charges only at checkout). Every surcharge / delivery fee / packaging
  // fee the owner has configured is surfaced up-front so the customer
  // can never be surprised by an inflated total. We never invent
  // surcharges; only what the owner explicitly set is shown.
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
    if (typeof kb.fssaiLicenseNumber === 'string') fssaiLicenseNumber = kb.fssaiLicenseNumber;
    if (typeof kb.fssaiExpiryDate === 'string') fssaiExpiryDate = kb.fssaiExpiryDate;
    if (typeof kb.fssaiCentralLicence === 'boolean') fssaiCentralLicence = kb.fssaiCentralLicence;
    if (typeof kb.outletCount === 'number' && kb.outletCount > 0) outletCount = kb.outletCount;
    if (typeof kb.gstin === 'string') gstin = kb.gstin;
    if (typeof kb.halalCertified === 'boolean') halalCertified = kb.halalCertified;
    if (typeof kb.halalCertNumber === 'string') halalCertNumber = kb.halalCertNumber;
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
    // serviceModes is the authoritative on/off list from the restaurant
    // form. Each mode picker on the page must respect it independently —
    // earlier this only gated dine_in, so kitchens that disabled
    // takeaway in the form still saw takeaway as a chooser. The legacy
    // `deliveryAvailable` boolean is honoured as an additional kill-
    // switch for delivery (some owners toggle it without touching
    // serviceModes).
    if (Array.isArray(kb.serviceModes)) {
      const modes = kb.serviceModes as string[];
      dineInEnabled = modes.includes('dine_in');
      takeawayEnabled = modes.includes('takeaway') || modes.includes('parcel_takeaway');
      // Treat missing in serviceModes as "delivery off" only if the
      // owner explicitly populated serviceModes (length > 0). An empty
      // list shouldn't accidentally disable everything.
      if (modes.length > 0) deliveryAvailable = modes.includes('delivery');
    }
    if (typeof kb.deliveryAvailable === 'boolean') {
      deliveryAvailable = deliveryAvailable && kb.deliveryAvailable;
    }
  } catch { /* ignore */ }

  // Calorie display is FSSAI-mandatory only for central-licence FBOs or
  // 10+ outlet chains (Reg 2.4.6). Below the threshold it's optional.
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
  }> = [];
  menu.forEach((cat, ci) => {
    (cat.items || []).forEach((it, ii) => {
      const name = (it.name || '').trim();
      if (!name) return;
      // First trust an explicit sizes[] array on the item (clean schema).
      // If absent, fall back to parsing the free-text price string for
      // patterns like "Half Rs.189 / Full Rs.329" so legacy DEMO data
      // still renders multi-size pickers correctly.
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
      flatItems.push({
        id: `${ci}-${ii}`,
        category: (cat.category || 'Menu').trim() || 'Menu',
        name,
        price: it.price || '',
        description: it.description || '',
        isVeg: it.isVeg !== false,
        isBestseller: !!it.isBestseller,
        sizes: validSizes,
      });
    });
  });

  return (
    <MenuPublicClient
      businessName={client.business_name}
      clientId={clientId}
      items={flatItems}
      brandLogoUrl={brandLogoUrl}
      brandColor={brandColor}
      tagline={tagline}
      prefillPhone={prefillPhone}
      deliveryAvailable={deliveryAvailable}
      dineInEnabled={dineInEnabled}
      takeawayEnabled={takeawayEnabled}
      compliance={{
        fssaiLicenseNumber,
        fssaiExpiryDate,
        gstin,
        halalCertified,
        halalCertNumber,
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
    />
  );
}
