import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { FlatCatalogEditor } from '@/components/client/flat-catalog-editor';
import { RealEstateListingsBulkImport } from '@/components/forms/bulk-import-buttons';

// Listings editor — exposes the full PropertyListing schema (lib/types.ts:466)
// including RERA fields that the bot HARD-BLOCKS sends on when missing
// (`blockSendIfReraMissing` gate in prompt-generator).
//
// Field grouping mirrors what a broker fills out per listing in real life:
// identity → RERA + areas (legal) → unit details → pricing → status →
// city-specific (khata) → media. Keeps the form scannable instead of one
// 25-field wall.

export default async function RealEstateListingsPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'realestate') redirect('/client/dashboard');
  return (
    <FlatCatalogEditor
      businessName={user.activeBot.business_name}
      crumbVertical="Real Estate"
      crumbVerticalHref="/client/realestate"
      crumbLabel="Listings"
      field="currentListings"
      fields={[
        // ─── Identity ───
        { sectionHeader: 'Identity', key: 'title', label: 'Title', placeholder: '3BHK Whitefield', colSpan: 6 },
        { key: 'type', label: 'Listing type', type: 'select', colSpan: 3, options: [
          { value: 'sale', label: 'Sale' },
          { value: 'rent', label: 'Rent' },
          { value: 'lease', label: 'Lease' },
          { value: 'pg', label: 'PG / Co-living' },
        ] },
        { key: 'configuration', label: 'Configuration', type: 'select', colSpan: 3, options: [
          { value: '1RK', label: '1RK' },
          { value: '1BHK', label: '1BHK' },
          { value: '2BHK', label: '2BHK' },
          { value: '2.5BHK', label: '2.5BHK' },
          { value: '3BHK', label: '3BHK' },
          { value: '3.5BHK', label: '3.5BHK' },
          { value: '4BHK', label: '4BHK' },
          { value: 'Penthouse', label: 'Penthouse' },
          { value: 'Plot', label: 'Plot' },
          { value: 'Commercial', label: 'Commercial' },
          { value: 'Other', label: 'Other' },
        ] },

        // ─── RERA + Areas (legal-mandatory) ───
        { sectionHeader: 'RERA + Areas (RERA Act §4 — mandatory on every advert)',
          key: 'reraNumber', label: 'RERA number', placeholder: 'PRM/KA/RERA/1251/...', colSpan: 6,
          hint: 'Bot will refuse to share this listing if missing.' },
        { key: 'reraQrUrl', label: 'RERA QR / verification URL', placeholder: 'https://rera.karnataka.gov.in/...', colSpan: 6 },
        { key: 'carpetAreaSqft', label: 'Carpet area (sqft) *', placeholder: '950', colSpan: 4,
          hint: 'RERA-mandated metric. Quote this, NOT super-built-up.' },
        { key: 'builtUpAreaSqft', label: 'Built-up area (sqft)', placeholder: '1100', colSpan: 4 },
        { key: 'superBuiltUpAreaSqft', label: 'Super built-up (sqft)', placeholder: '1450', colSpan: 4 },
        { key: 'loadingFactorPct', label: 'Loading factor %', type: 'number', placeholder: '25', colSpan: 4,
          hint: 'Disclose openly.' },
        { key: 'priceBasis', label: 'Price quoted on', type: 'select', colSpan: 4, options: [
          { value: 'carpet', label: 'Carpet' },
          { value: 'rera_carpet', label: 'RERA Carpet' },
          { value: 'super_built_up', label: 'Super built-up' },
        ] },
        { key: 'pricePerSqft', label: 'Price per sqft', placeholder: '₹12,500', colSpan: 4 },

        // ─── Pricing ───
        { sectionHeader: 'Pricing', key: 'price', label: 'Total price / rent', placeholder: '₹1.2 Cr or ₹35,000/mo', colSpan: 6 },
        { key: 'area', label: 'Area / locality (display)', placeholder: 'Whitefield, Bangalore', colSpan: 6 },

        // ─── Unit details ───
        { sectionHeader: 'Unit details',
          key: 'parkingCount', label: 'Parking count', type: 'number', colSpan: 3 },
        { key: 'parkingType', label: 'Parking type', type: 'select', colSpan: 3, options: [
          { value: 'covered', label: 'Covered' },
          { value: 'open', label: 'Open' },
          { value: 'mechanical', label: 'Mechanical' },
          { value: 'none', label: 'None' },
        ] },
        { key: 'facing', label: 'Facing', type: 'select', colSpan: 3, options: [
          { value: 'N', label: 'North' }, { value: 'S', label: 'South' },
          { value: 'E', label: 'East' }, { value: 'W', label: 'West' },
          { value: 'NE', label: 'NE' }, { value: 'NW', label: 'NW' },
          { value: 'SE', label: 'SE' }, { value: 'SW', label: 'SW' },
        ] },
        { key: 'vastuCompliant', label: 'Vastu compliant', type: 'boolean', colSpan: 3 },
        { key: 'floorRange', label: 'Floor range', placeholder: '5–10 (out of 22)', colSpan: 4 },
        { key: 'unitsAvailable', label: 'Units available', type: 'number', colSpan: 4 },
        { key: 'furnishingStatus', label: 'Furnishing', type: 'select', colSpan: 4, options: [
          { value: 'unfurnished', label: 'Unfurnished' },
          { value: 'semi_furnished', label: 'Semi-furnished' },
          { value: 'fully_furnished', label: 'Fully furnished' },
        ] },

        // ─── Compliance status ───
        { sectionHeader: 'OC / CC / Possession (material disclosure)',
          key: 'ocStatus', label: 'OC status', type: 'select', colSpan: 4, options: [
          { value: 'received', label: 'Received' },
          { value: 'applied', label: 'Applied' },
          { value: 'pending', label: 'Pending' },
          { value: 'na_under_construction', label: 'Under construction' },
        ] },
        { key: 'ccStatus', label: 'CC status', type: 'select', colSpan: 4, options: [
          { value: 'received', label: 'Received' },
          { value: 'partial', label: 'Partial' },
          { value: 'pending', label: 'Pending' },
        ] },
        { key: 'possessionDate', label: 'Possession date (YYYY-MM)', placeholder: '2026-12', colSpan: 4 },
        { key: 'khataAOrB', label: 'Khata (Bangalore)', type: 'select', colSpan: 4, options: [
          { value: 'A', label: 'A-Khata (loans OK)' },
          { value: 'B', label: 'B-Khata (blocks loans)' },
          { value: 'na', label: 'N/A (other city)' },
        ], hint: 'Bangalore only — B-Khata blocks bank loans.' },

        // ─── Media + highlights ───
        { sectionHeader: 'Highlights + media',
          key: 'highlights', label: 'Highlights', type: 'textarea', colSpan: 12,
          placeholder: 'Park-facing | club + pool | walking distance to ITPL' },
        { key: 'brochureUrl', label: 'Brochure URL', placeholder: 'https://...', colSpan: 6 },
        { key: 'walkthroughVideoUrl', label: 'Walkthrough video URL', placeholder: 'https://youtu.be/...', colSpan: 6 },
      ]}
      newItem={() => ({
        title: '', type: '', price: '', area: '', highlights: '',
        reraNumber: '', carpetAreaSqft: '', configuration: '',
      })}
      emptyHint="Bulk-import your listing book from photo / paste / Excel — or add one manually. RERA number is mandatory per RERA Act §4."
      addLabel="Add listing"
      BulkImport={RealEstateListingsBulkImport}
    />
  );
}
