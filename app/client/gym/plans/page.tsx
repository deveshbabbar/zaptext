import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { FlatCatalogEditor } from '@/components/client/flat-catalog-editor';
import { GymPlansBulkImport } from '@/components/forms/bulk-import-buttons';

export default async function GymPlansPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'gym') redirect('/client/dashboard');
  return (
    <FlatCatalogEditor
      businessName={user.activeBot.business_name}
      crumbVertical="Gym"
      crumbVerticalHref="/client/gym"
      crumbLabel="Plans"
      field="membershipPlans"
      fields={[
        { key: 'name', label: 'Plan', placeholder: 'Annual Premium', colSpan: 4 },
        { key: 'duration', label: 'Duration', placeholder: '12 months', colSpan: 3 },
        { key: 'price', label: 'Price', placeholder: 'Rs.15,000 or Standard Rs.10000 / PT Rs.18000', colSpan: 5 },
        { key: 'includes', label: 'Includes', placeholder: 'PT, yoga, sauna', colSpan: 12 },
      ]}
      newItem={() => ({ name: '', duration: '', price: '', includes: '' })}
      emptyHint="Bulk-import your plans from photo / paste / Excel, or add one manually."
      addLabel="Add plan"
      BulkImport={GymPlansBulkImport}
    />
  );
}
