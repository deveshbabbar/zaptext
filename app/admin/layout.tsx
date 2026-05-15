import { requireAdmin } from '@/lib/auth';
import { WelcomeTrigger } from '@/components/welcome-trigger';
import AdminSidebar from './_components/admin-sidebar';
import { AppShell } from '@/components/app/app-shell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const initials = (admin.name || admin.email)
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <>
      <WelcomeTrigger />
      <AppShell
        brandSub="Admin"
        aside={<AdminSidebar name={admin.name} email={admin.email} initials={initials} />}
      >
        {children}
      </AppShell>
    </>
  );
}
