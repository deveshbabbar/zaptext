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
        // ─── Basics ───
        { sectionHeader: 'Plan basics',
          key: 'name', label: 'Plan name', placeholder: 'Annual Premium', colSpan: 4 },
        { key: 'duration', label: 'Duration label', placeholder: '12 months', colSpan: 3 },
        { key: 'durationMonths', label: 'Duration (months)', type: 'number', placeholder: '12', colSpan: 2 },
        { key: 'price', label: 'Price ₹', placeholder: '15000', colSpan: 3 },

        // ─── Membership type ───
        { sectionHeader: 'Membership type',
          key: 'isCouple', label: 'Couple plan', type: 'boolean', colSpan: 3 },
        { key: 'isFamily', label: 'Family plan', type: 'boolean', colSpan: 3 },
        { key: 'familyMaxMembers', label: 'Max family members', type: 'number', placeholder: '4', colSpan: 3 },
        { key: 'registrationFeeIncluded', label: 'Registration fee included', type: 'boolean', colSpan: 3 },

        // ─── Access ───
        { sectionHeader: 'Access',
          key: 'peakAccess', label: 'Peak hours access', type: 'boolean', colSpan: 3,
          hint: 'Off-peak only plans are typically cheaper' },
        { key: 'offPeakWindow', label: 'Off-peak window', placeholder: '11 AM-4 PM', colSpan: 3 },
        { key: 'accessibleLocations', label: 'Locations covered', type: 'select', colSpan: 6, options: [
          { value: 'home_only', label: 'Home branch only' },
          { value: 'all_branches', label: 'All branches' },
          { value: 'city', label: 'All city branches' },
          { value: 'national', label: 'National access' },
        ] },

        // ─── Includes + excludes ───
        { sectionHeader: 'What\'s in / out',
          key: 'includes', label: 'Includes', type: 'textarea', colSpan: 12,
          placeholder: 'PT sessions, yoga classes, sauna, locker, towel service' },
        { key: 'excludes', label: 'Excludes', type: 'textarea', colSpan: 12,
          placeholder: 'Personal training (paid extra), nutrition consult, supplements' },
      ]}
      newItem={{
        name: '', duration: '', price: '', includes: '',
        isCouple: false, isFamily: false, peakAccess: true,
      }}
      emptyHint="Bulk-import your plans from photo / paste / Excel, or add one manually."
      addLabel="Add plan"
      BulkImport={GymPlansBulkImport}
    />
  );
}
