import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { FlatCatalogEditor } from '@/components/client/flat-catalog-editor';
import { CoachingCoursesBulkImport } from '@/components/forms/bulk-import-buttons';

export default async function CoachingCoursesPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'coaching') redirect('/client/dashboard');
  return (
    <FlatCatalogEditor
      businessName={user.activeBot.business_name}
      crumbVertical="Coaching"
      crumbVerticalHref="/client/coaching"
      crumbLabel="Courses"
      field="coursesOffered"
      fields={[
        // ─── Basics ───
        { sectionHeader: 'Course basics', key: 'name', label: 'Course name', placeholder: 'JEE Main + Advanced', colSpan: 5 },
        { key: 'category', label: 'Category', type: 'select', colSpan: 4, options: [
          { value: 'entrance-exam', label: 'Entrance exam' },
          { value: 'school-prep', label: 'School / Board prep' },
          { value: 'hobby', label: 'Hobby / Skill' },
          { value: 'professional', label: 'Professional / Govt' },
          { value: 'kids', label: 'Kids' },
        ] },
        { key: 'mode', label: 'Mode', type: 'select', colSpan: 3, options: [
          { value: 'offline', label: 'Offline' },
          { value: 'online', label: 'Online' },
          { value: 'hybrid', label: 'Hybrid' },
          { value: 'recorded', label: 'Recorded only' },
        ] },

        // ─── Audience ───
        { sectionHeader: 'Target audience',
          key: 'targetAudience', label: 'Audience description', placeholder: 'Class 11-12 PCM students', colSpan: 6 },
        { key: 'entranceExam', label: 'Entrance exam', placeholder: 'JEE / NEET / CAT / CLAT', colSpan: 3 },
        { key: 'targetClass', label: 'Target class', placeholder: '11, 12, dropper', colSpan: 3 },
        { key: 'ageBandMin', label: 'Min age', type: 'number', placeholder: '15', colSpan: 3 },
        { key: 'ageBandMax', label: 'Max age', type: 'number', placeholder: '19', colSpan: 3 },

        // ─── Schedule + batch ───
        { sectionHeader: 'Schedule + batch',
          key: 'duration', label: 'Duration', placeholder: '1 year', colSpan: 3 },
        { key: 'schedule', label: 'Schedule', placeholder: 'Mon-Fri 4-7 PM', colSpan: 5 },
        { key: 'daysPerWeek', label: 'Days/week', type: 'number', placeholder: '5', colSpan: 2 },
        { key: 'hoursPerDay', label: 'Hours/day', type: 'number', placeholder: '3', colSpan: 2 },
        { key: 'batchSizeMin', label: 'Min batch size', type: 'number', placeholder: '10', colSpan: 3 },
        { key: 'batchSizeMax', label: 'Max batch size', type: 'number', placeholder: '40', colSpan: 3 },
        { key: 'weekendBatch', label: 'Weekend-only batch', type: 'boolean', colSpan: 3 },
        { key: 'level', label: 'Level', type: 'select', colSpan: 3, options: [
          { value: 'foundation', label: 'Foundation' },
          { value: 'standard', label: 'Standard' },
          { value: 'advanced', label: 'Advanced' },
          { value: 'crash', label: 'Crash course' },
        ] },

        // ─── Fee + payment ───
        { sectionHeader: 'Fee + payment',
          key: 'fee', label: 'Total fee', placeholder: 'Rs.85,000', colSpan: 3 },
        { key: 'feeBreakupTuition', label: 'Tuition portion ₹', placeholder: '70000', colSpan: 3 },
        { key: 'feeBreakupBooks', label: 'Books / Material ₹', placeholder: '10000', colSpan: 3 },
        { key: 'feeBreakupRegistration', label: 'Registration ₹', placeholder: '5000', colSpan: 3 },
        { key: 'gstIncludedInFee', label: 'GST included in fee', type: 'boolean', colSpan: 3 },
        { key: 'fullPaymentAvailable', label: 'Full payment option', type: 'boolean', colSpan: 3 },
        { key: 'installmentsCount', label: 'EMI installments', type: 'number', placeholder: '3', colSpan: 3 },
        { key: 'payAfterPlacementAvailable', label: 'Pay after placement', type: 'boolean', colSpan: 3 },

        // ─── Extras ───
        { sectionHeader: 'Extras',
          key: 'recordedAccessIncluded', label: 'Recorded access included', type: 'boolean', colSpan: 3 },
        { key: 'certificateIssued', label: 'Certificate issued', type: 'boolean', colSpan: 3 },
        { key: 'placementGuaranteeOffered', label: 'Placement guarantee', type: 'boolean', colSpan: 3,
          hint: 'Bot will hard-block "100% selection pakka" claims — Raj Bill.' },
        { key: 'prerequisites', label: 'Prerequisites', type: 'textarea', colSpan: 12,
          placeholder: 'Class 10 math, prior coding exposure helpful' },
      ]}
      newItem={{
        name: '', targetAudience: '', duration: '', fee: '', schedule: '', mode: '',
        category: '', entranceExam: '', targetClass: '',
      }}
      emptyHint="Bulk import your course list from a photo / paste / Excel — or start by adding one manually."
      addLabel="Add course"
      BulkImport={CoachingCoursesBulkImport}
    />
  );
}
