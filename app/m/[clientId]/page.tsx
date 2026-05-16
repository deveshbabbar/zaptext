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
import { headers } from 'next/headers';
import { getClientByIdOrSlug } from '@/lib/db/clients';
import { getOutletsForClient } from '@/lib/db/outlets';
import { getRecentOrderForCustomer } from '@/lib/db/restaurant-dine-in';
import { MenuPublicClient } from './menu-public-client';
import { PincodeGate } from './pincode-gate';

// 6-digit Indian pincode validator — same shape used by the storefront
// settings API. Defensive parse: malformed JSON or non-array contents
// degrade to "no gating" rather than crashing the page.
const PINCODE_REGEX = /^[1-8]\d{5}$/;
function parseServicePincodes(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is string => typeof x === 'string' && PINCODE_REGEX.test(x));
  } catch {
    return [];
  }
}

interface MenuItem {
  name: string;
  price: string;
  description?: string;
  isVeg?: boolean;
  isBestseller?: boolean;
  sizes?: Array<{ label: string; price: number }> | null;
  // FSSAI Reg 2.4.6 — one or more of the 8 listed allergen keys.
  allergens?: string[];
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
  searchParams: Promise<{ p?: string; q?: string; lat?: string; lng?: string; new?: string }>;
}) {
  const { clientId } = await params;
  const { p: prefillPhone = '', q: prefillQuery = '', lat: latRaw = '', lng: lngRaw = '', new: bypassRecentRaw = '' } = await searchParams;
  // ?new=1 is set when the customer clicks "Place a different order"
  // from the recent-order intercept below. Skips the duplicate guard
  // so a genuine second order (colleague at the table, different
  // address) can go through immediately.
  const bypassRecent = bypassRecentRaw === '1' || bypassRecentRaw === 'true';
  // Parse + validate location once at the server boundary. Invalid
  // values (non-numeric, out-of-range) are silently dropped so a
  // malformed link never crashes the page.
  const latNum = parseFloat(latRaw);
  const lngNum = parseFloat(lngRaw);
  const prefillLat = Number.isFinite(latNum) && Math.abs(latNum) <= 90 ? latNum : null;
  const prefillLng = Number.isFinite(lngNum) && Math.abs(lngNum) <= 180 ? lngNum : null;

  // Accepts either the opaque client_id (legacy /m links from the bot) or
  // the human-readable slug (storefront subdomain rewrites from middleware).
  const client = await getClientByIdOrSlug(clientId).catch(() => null);
  if (!client || client.type !== 'restaurant') notFound();

  // Storefront-enabled gate. The middleware sets `x-storefront-host: 1` on
  // every subdomain rewrite so we can tell the difference between:
  //   (a) "customer arrived via <slug>.zaptext.shop" — public discovery,
  //       must be opted-in by the owner via storefront_enabled
  //   (b) "customer arrived via the /m/<id> link the bot sent them in chat"
  //       — already trusted (bot only emits the link to known opted-in
  //       customers), so storefront_enabled is irrelevant
  // Without this branch, anyone who guessed a slug could browse a menu
  // the owner hasn't published yet.
  const h = await headers();
  if (h.get('x-storefront-host') === '1' && !client.storefront_enabled) {
    notFound();
  }

  // Double-tap / spam guard. When the link carries a phone (?p=…)
  // AND that phone has placed a non-cancelled order in the last
  // 2 minutes AND the URL has no `?new=1` bypass flag, render an
  // "already ordered" intercept instead of the menu form. Customer
  // can click "Place a different order" to bypass (sets ?new=1).
  //
  // 2 min is anti-double-tap, not a hard cap — a customer waiting
  // 3 minutes for whatever reason sees the normal form again.
  if (prefillPhone && !bypassRecent) {
    const phoneDigits = prefillPhone.replace(/\D/g, '');
    if (phoneDigits.length >= 10) {
      const recent = await getRecentOrderForCustomer(clientId, phoneDigits).catch(() => null);
      if (recent) {
        const minutesAgo = Math.max(1, Math.round((Date.now() - new Date(recent.created_at).getTime()) / 60000));
        // Build the bypass URL — preserves the existing query params so
        // the customer doesn't lose location prefill / cart-query state.
        const bypassParams = new URLSearchParams();
        bypassParams.set('p', prefillPhone);
        if (prefillQuery) bypassParams.set('q', prefillQuery);
        if (latRaw) bypassParams.set('lat', latRaw);
        if (lngRaw) bypassParams.set('lng', lngRaw);
        bypassParams.set('new', '1');
        const bypassUrl = `/m/${clientId}?${bypassParams.toString()}`;
        return (
          <div
            style={{
              fontFamily: 'system-ui, sans-serif',
              maxWidth: 460,
              margin: '0 auto',
              padding: '60px 24px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 56, marginBottom: 14 }}>✅</div>
            <h1 style={{ fontSize: 22, marginBottom: 8 }}>Order already placed</h1>
            <p style={{ color: '#444', marginBottom: 14, fontSize: 14, lineHeight: 1.55 }}>
              You sent an order to <b>{client.business_name}</b> {minutesAgo === 1 ? 'a moment' : `${minutesAgo} minutes`} ago. The kitchen is on it — you&apos;ll get a WhatsApp confirmation soon.
            </p>
            <p style={{ color: '#666', fontSize: 13, marginTop: 4, marginBottom: 28 }}>
              Order place ho gaya {minutesAgo === 1 ? 'abhi' : `${minutesAgo} min pehle`}. Kitchen mein lag gaya hai.
            </p>
            <a
              href={bypassUrl}
              style={{
                display: 'inline-block',
                padding: '12px 22px',
                borderRadius: 99,
                background: '#111',
                color: '#fff',
                fontWeight: 600,
                textDecoration: 'none',
                fontSize: 14,
              }}
            >
              Place a different order →
            </a>
            <div style={{ marginTop: 12, fontSize: 12, color: '#888', lineHeight: 1.5 }}>
              Different address ya kisi or ke liye? Tap above.
              <br />
              Add items to the existing order? Reply to the kitchen on WhatsApp.
            </div>
          </div>
        );
      }
    }
  }

  let menu: MenuCategory[] = [];
  let brandLogoUrl = '';
  let brandColor = '';
  let coverImageUrl = '';
  let tagline = '';
  let cuisineType = '';
  let workingHours = '';
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
    if (typeof kb.coverImageUrl === 'string') coverImageUrl = kb.coverImageUrl;
    if (typeof kb.tagline === 'string') tagline = kb.tagline;
    if (typeof kb.cuisineType === 'string') cuisineType = kb.cuisineType;
    if (typeof kb.workingHours === 'string') workingHours = kb.workingHours;
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
    allergens: string[];
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

  const servicePincodes = parseServicePincodes(client.service_pincodes);
  // Storage key: prefer the human-readable slug when available so a
  // customer who later visits the same restaurant via the subdomain
  // doesn't get re-prompted. Falls back to client_id for bots that
  // haven't picked a slug yet.
  const pincodeStorageKey = client.slug || client.client_id;

  return (
    <PincodeGate
      storageKey={pincodeStorageKey}
      businessName={client.business_name}
      servicePincodes={servicePincodes}
    >
      <MenuPublicClient
        businessName={client.business_name}
        clientId={clientId}
        items={flatItems}
        brandLogoUrl={brandLogoUrl}
        brandColor={brandColor}
        coverImageUrl={coverImageUrl}
        tagline={tagline}
        city={client.city}
        cuisineType={cuisineType}
        workingHours={workingHours}
        prefillPhone={prefillPhone}
        prefillQuery={prefillQuery}
        prefillLat={prefillLat}
        prefillLng={prefillLng}
        bypassRecentOrderGuard={bypassRecent}
        deliveryAvailable={deliveryAvailable}
        dineInEnabled={dineInEnabled}
        takeawayEnabled={takeawayEnabled}
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
        outletMarkers={(await getOutletsForClient(clientId).catch(() => []))
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
    </PincodeGate>
  );
}
