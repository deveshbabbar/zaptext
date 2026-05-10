import { requireAdmin } from '@/lib/auth';
import { WelcomeTrigger } from '@/components/welcome-trigger';
import AdminSidebar from './_components/admin-sidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const initials = (admin.name || admin.email)
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex h-screen">
      <WelcomeTrigger />
      <AdminSidebar name={admin.name} email={admin.email} initials={initials} />
      <main className="flex-1 overflow-auto bg-background">{children}</main>
    </div>
  );
}
