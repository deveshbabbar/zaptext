import { requireAdmin } from '@/lib/auth';
import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';

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
      <aside
        className="w-[268px] bg-[var(--sidebar)] text-[var(--sidebar-foreground)] flex flex-col overflow-y-auto"
        style={{ padding: '18px 14px' }}
      >
        <Link
          href="/"
          className="flex items-center gap-2.5 pb-4 border-b border-white/10 mb-3.5"
          style={{ padding: '4px 8px 16px' }}
        >
          <span className="w-8 h-8 rounded-[8px] bg-[var(--accent)] text-[var(--accent-2)] grid place-items-center zt-mono font-extrabold text-[18px]">
            Z
          </span>
          <div>
            <div className="font-bold tracking-[-0.01em]">ZapText</div>
            <div className="text-[10.5px] text-white/55 zt-mono uppercase tracking-[.08em]">Admin workspace</div>
          </div>
        </Link>

        <SideSec>Overview</SideSec>
        <nav className="flex flex-col gap-px">
          <SideLink href="/admin/dashboard" icon="📊" label="Dashboard" />
          <SideLink href="/admin/analytics" icon="📈" label="Analytics" />
          <SideLink href="/admin/revenue" icon="💰" label="Revenue" />
        </nav>

        <SideSec>Manage</SideSec>
        <nav className="flex flex-col gap-px">
          <SideLink href="/admin/onboard" icon="➕" label="Onboard client" />
          <SideLink href="/admin/clients" icon="👥" label="All clients" />
          <SideLink href="/admin/subscriptions" icon="💳" label="Subscriptions" />
          <SideLink href="/admin/messages" icon="📨" label="Messages" />
        </nav>

        <SideSec>Settings</SideSec>
        <nav className="flex flex-col gap-px">
          <SideLink href="/admin/workspace" icon="⚙️" label="Workspace" />
          <SideLink href="/admin/api-keys" icon="🔑" label="API keys" />
        </nav>

        <div className="mt-auto pt-3 border-t border-white/10 flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] rounded-full bg-[var(--accent)] text-[var(--accent-2)] grid place-items-center font-bold text-[13px]">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold truncate">{admin.name || 'Admin'}</div>
            <div className="text-[10.5px] text-white/50 truncate">{admin.email}</div>
          </div>
          <UserButton />
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-background">{children}</main>
    </div>
  );
}

function SideSec({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="zt-mono text-[10px] uppercase tracking-[.09em] text-white/55"
      style={{ padding: '14px 8px 4px' }}
    >
      {children}
    </div>
  );
}

function SideLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-[9px] text-white/65 hover:text-white hover:bg-white/5 transition-colors font-medium text-[13.5px]"
      style={{ padding: '9px 10px' }}
    >
      <span className="w-4 text-center text-[13px]">{icon}</span>
      {label}
    </Link>
  );
}
