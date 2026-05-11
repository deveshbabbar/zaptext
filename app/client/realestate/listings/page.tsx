import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { FlatCatalogEditor } from '@/components/client/flat-catalog-editor';
import { RealEstateListingsBulkImport } from '@/components/forms/bulk-import-buttons';

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
        { key: 'title', label: 'Title', placeholder: '3BHK Whitefield', colSpan: 4 },
        { key: 'type', label: 'Type', placeholder: 'sale / rent / lease', colSpan: 2 },
        { key: 'price', label: 'Price', placeholder: 'Rs.1.2 Cr or Rs.35,000/month', colSpan: 3 },
        { key: 'area', label: 'Area', placeholder: '1450 sqft', colSpan: 3 },
        { key: 'highlights', label: 'Highlights / RERA', placeholder: 'Park-facing | RERA: PRM/...', colSpan: 12 },
      ]}
      newItem={() => ({ title: '', type: '', price: '', area: '', highlights: '' })}
      emptyHint="Bulk-import your listing book from photo / paste / Excel — or add one manually. RERA number can go in Highlights."
      addLabel="Add listing"
      BulkImport={RealEstateListingsBulkImport}
    />
  );
}
