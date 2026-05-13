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
        // ─── Basics ───
        { sectionHeader: 'Plan basics',
          key: 'name', label: 'Plan name', placeholder: 'Monthly Lunch', colSpan: 4 },
        { key: 'duration', label: 'Duration', placeholder: '30 tiffins / 1 month', colSpan: 3 },
        { key: 'price', label: 'Price ₹', placeholder: '2500', colSpan: 2 },
        { key: 'mealType', label: 'Meal', type: 'select', colSpan: 3, options: [
          { value: 'lunch', label: 'Lunch' },
          { value: 'dinner', label: 'Dinner' },
          { value: 'both', label: 'Lunch + Dinner' },
          { value: 'breakfast', label: 'Breakfast' },
        ] },
        { key: 'foodType', label: 'Food type', type: 'select', colSpan: 3, options: [
          { value: 'veg', label: 'Pure veg' },
          { value: 'non-veg', label: 'Non-veg' },
          { value: 'jain', label: 'Jain' },
          { value: 'mixed', label: 'Mixed (veg + non-veg days)' },
        ] },

        // ─── Meal composition (what's in each dabba) ───
        { sectionHeader: 'What\'s in each dabba',
          key: 'rotiCount', label: 'Rotis count', type: 'number', placeholder: '4', colSpan: 2 },
        { key: 'rotiType', label: 'Roti type', type: 'select', colSpan: 3, options: [
          { value: 'phulka', label: 'Phulka' },
          { value: 'tawa', label: 'Tawa roti' },
          { value: 'tandoori', label: 'Tandoori' },
          { value: 'paratha', label: 'Paratha' },
          { value: 'multi-grain', label: 'Multi-grain' },
        ] },
        { key: 'riceIncluded', label: 'Rice included', type: 'boolean', colSpan: 2 },
        { key: 'dalIncluded', label: 'Dal included', type: 'boolean', colSpan: 2 },
        { key: 'sabziCount', label: 'Sabzi varieties', type: 'number', placeholder: '2', colSpan: 3 },
        { key: 'portionSize', label: 'Portion size', type: 'select', colSpan: 3, options: [
          { value: 'small', label: 'Small' },
          { value: 'standard', label: 'Standard' },
          { value: 'large', label: 'Large' },
          { value: 'jumbo', label: 'Jumbo' },
        ] },
        { key: 'saladPickleIncluded', label: 'Salad + pickle', type: 'boolean', colSpan: 3 },
        { key: 'drinkingWaterIncluded', label: 'Water bottle', type: 'boolean', colSpan: 3 },
        { key: 'sweetDishFrequency', label: 'Sweet dish', type: 'select', colSpan: 3, options: [
          { value: 'never', label: 'Never' },
          { value: 'weekly', label: 'Weekly' },
          { value: 'festivals', label: 'Festivals only' },
          { value: 'daily', label: 'Daily' },
        ] },

        // ─── Full description ───
        { sectionHeader: 'Free-text details',
          key: 'includes', label: 'What\'s included (display copy)', type: 'textarea', colSpan: 12,
          placeholder: '4 phulka rotis + 1 dry + 1 gravy sabzi + dal + rice + salad + pickle. Sweet on Fridays.' },
      ]}
      newItem={{
        name: '', duration: '', price: '', mealType: 'lunch', foodType: 'veg', includes: '',
        rotiCount: 4, riceIncluded: true, dalIncluded: true, sabziCount: 2,
      }}
      emptyHint="Bulk-import your plans from photo / paste / Excel, or add manually."
      addLabel="Add plan"
      BulkImport={TiffinPlansBulkImport}
    />
  );
}
