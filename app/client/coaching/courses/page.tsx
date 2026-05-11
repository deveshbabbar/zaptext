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
        { key: 'name', label: 'Course name', placeholder: 'JEE Main + Advanced', colSpan: 4 },
        { key: 'targetAudience', label: 'Audience', placeholder: 'Class 11-12', colSpan: 3 },
        { key: 'duration', label: 'Duration', placeholder: '1 year', colSpan: 2 },
        { key: 'fee', label: 'Fee', placeholder: 'Rs.85,000', colSpan: 3 },
        { key: 'schedule', label: 'Schedule', placeholder: 'Mon-Fri 4-7 PM', colSpan: 6 },
        { key: 'mode', label: 'Mode', placeholder: 'Offline / Online / Hybrid', colSpan: 6 },
      ]}
      newItem={() => ({ name: '', targetAudience: '', duration: '', fee: '', schedule: '', mode: '' })}
      emptyHint="Bulk import your course list from a photo / paste / Excel — or start by adding one manually."
      addLabel="Add course"
      BulkImport={CoachingCoursesBulkImport}
    />
  );
}
