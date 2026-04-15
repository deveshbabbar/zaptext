import { requireAdmin } from '@/lib/auth';
import { UserButton } from '@clerk/nextjs';
import { ThemeToggle } from '@/components/theme-toggle';
import Image from 'next/image';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const initials = (admin.name || admin.email).split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="flex h-screen">
      <aside className="w-[260px] bg-sidebar text-sidebar-foreground p-4 flex flex-col overflow-y-auto">
        <div className="flex items-center gap-2.5 px-2 pb-5 border-b border-sidebar-border mb-4">
          <Image src="/logo.png" alt="ZapText" width={36} height={36} className="rounded-xl" />
          <div>
            <div className="font-bold text-base">ZapText</div>
            <div className="text-[11px] text-sidebar-foreground/50">Admin Workspace</div>
          </div>
        </div>

        <div className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">Overview</div>
        <AdminLink href="/admin/dashboard" icon="📊" label="Dashboard" />
        <AdminLink href="/admin/analytics" icon="📈" label="Analytics" />
        <AdminLink href="/admin/revenue" icon="💰" label="Revenue" />

        <div className="px-2 mt-4 mb-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">Manage</div>
        <AdminLink href="/admin/onboard" icon="➕" label="Onboard Client" />
        <AdminLink href="/admin/clients" icon="👥" label="All Clients" />
        <AdminLink href="/admin/subscriptions" icon="💳" label="Subscriptions" />
        <AdminLink href="/admin/messages" icon="📨" label="Messages" />

        <div className="px-2 mt-4 mb-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">Settings</div>
        <AdminLink href="/admin/workspace" icon="⚙️" label="Workspace" />
        <AdminLink href="/admin/api-keys" icon="🔑" label="API Keys" />

        <div className="mt-auto pt-3 border-t border-sidebar-border flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold text-xs">{initials}</div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold truncate">{admin.name || 'Admin'}</div>
            <div className="text-[11px] text-sidebar-foreground/50">Admin</div>
          </div>
          <ThemeToggle />
          <UserButton />
        </div>
      </aside>
      <main className="flex-1 overflow-auto bg-background">{children}</main>
    </div>
  );
}

function AdminLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground text-sm transition-colors"
    >
      <span className="w-[18px] text-center">{icon}</span>
      {label}
    </a>
  );
}
