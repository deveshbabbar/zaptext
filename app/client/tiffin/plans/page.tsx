import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { FlatCatalogEditor } from '@/components/client/flat-catalog-editor';
import { TiffinPlansBulkImport } from '@/components/forms/bulk-import-buttons';

export default async function TiffinPlansPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'tiffin') redirect('/client/dashboard');
  return (
    <FlatCatalogEditor
      businessName={user.activeBot.business_name}
      crumbVertical="Tiffin"
      crumbVerticalHref="/client/tiffin"
      crumbLabel="Plans"
      field="plans"
      fields={[
        { key: 'name', label: 'Plan', placeholder: 'Monthly Lunch', colSpan: 4 },
        { key: 'duration', label: 'Duration', placeholder: '30 tiffins / 1 month', colSpan: 3 },
        { key: 'price', label: 'Price', placeholder: 'Rs.2,500', colSpan: 2 },
        { key: 'mealType', label: 'Meal', placeholder: 'lunch / dinner / both', colSpan: 3 },
        { key: 'foodType', label: 'Food type', placeholder: 'veg / non-veg / jain', colSpan: 3 },
        { key: 'includes', label: 'Includes', placeholder: '4 rotis + 1 sabzi + dal + rice + salad', colSpan: 9 },
      ]}
      newItem={{ name: '', duration: '', price: '', mealType: 'lunch', foodType: 'veg', includes: '' }}
      emptyHint="Bulk-import your plans from photo / paste / Excel, or add manually."
      addLabel="Add plan"
      BulkImport={TiffinPlansBulkImport}
    />
  );
}
