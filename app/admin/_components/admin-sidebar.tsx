'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';

interface AdminSidebarProps {
  name: string;
  email: string;
  initials: string;
}

export default function AdminSidebar({ name, email, initials }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className="w-[268px] max-w-[85vw] bg-[var(--sidebar)] text-[var(--sidebar-foreground)] flex flex-col overflow-y-auto"
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
          <div className="text-[10.5px] text-white/55 zt-mono uppercase tracking-[.08em]">
            Admin workspace
          </div>
        </div>
      </Link>

      <SideSec>Overview</SideSec>
      <nav className="flex flex-col gap-px">
        <SideLink pathname={pathname} href="/admin/dashboard" icon="📊" label="Dashboard" />
        <SideLink pathname={pathname} href="/admin/analytics" icon="📈" label="Analytics" />
        <SideLink pathname={pathname} href="/admin/revenue" icon="💰" label="Revenue" />
      </nav>

      <SideSec>Manage</SideSec>
      <nav className="flex flex-col gap-px">
        <SideLink pathname={pathname} href="/admin/onboard" icon="➕" label="Onboard client" />
        <SideLink pathname={pathname} href="/admin/clients" icon="👥" label="All clients" />
        <SideLink pathname={pathname} href="/admin/subscriptions" icon="💳" label="Subscriptions" />
        <SideLink pathname={pathname} href="/admin/payments" icon="🧾" label="Payments log" />
        <SideLink pathname={pathname} href="/admin/bookings" icon="📅" label="Bookings" />
        <SideLink pathname={pathname} href="/admin/messages" icon="📨" label="Messages" />
      </nav>

      <SideSec>Observability</SideSec>
      <nav className="flex flex-col gap-px">
        <SideLink pathname={pathname} href="/admin/health" icon="🩺" label="Platform health" />
        <SideLink pathname={pathname} href="/admin/compliance" icon="🛡️" label="Compliance" />
        <SideLink pathname={pathname} href="/admin/email-log" icon="📧" label="Email log" />
        <SideLink pathname={pathname} href="/admin/audit-log" icon="📜" label="Audit log" />
      </nav>

      <SideSec>Settings</SideSec>
      <nav className="flex flex-col gap-px">
        <SideLink pathname={pathname} href="/admin/workspace" icon="⚙️" label="Workspace" />
        <SideLink pathname={pathname} href="/admin/api-keys" icon="🔑" label="API keys" />
        <SideLink
          pathname={pathname}
          href="/admin/templates"
          icon="📝"
          label="WhatsApp templates"
        />
      </nav>

      <div className="mt-auto pt-3 border-t border-white/10 flex items-center gap-2.5">
        <div className="w-[34px] h-[34px] rounded-full bg-[var(--accent)] text-[var(--accent-2)] grid place-items-center font-bold text-[13px]">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold truncate">{name || 'Admin'}</div>
          <div className="text-[10.5px] text-white/50 truncate">{email}</div>
        </div>
        <UserButton />
      </div>
    </aside>
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

function SideLink({
  pathname,
  href,
  icon,
  label,
  exact,
}: {
  pathname: string | null;
  href: string;
  icon: string;
  label: string;
  exact?: boolean;
}) {
  // For "exact" matches (e.g. /admin/grocery dashboard), only highlight when
  // pathname is exactly that — otherwise it would also light up for any
  // /admin/grocery/* sub-route. Other links use prefix match so deep child
  // routes still highlight their parent.
  const active = exact
    ? pathname === href
    : pathname === href || (pathname?.startsWith(href + '/') ?? false);

  const baseCls =
    'relative flex items-center gap-2.5 rounded-[9px] transition-colors text-[13.5px]';
  const stateCls = active
    ? 'text-white font-semibold'
    : 'text-white/65 hover:text-white hover:bg-white/5 font-medium';

  return (
    <Link
      href={href}
      className={`${baseCls} ${stateCls}`}
      style={{
        padding: '9px 10px',
        background: active
          ? 'color-mix(in oklab, var(--accent) 18%, transparent)'
          : undefined,
      }}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r"
          style={{ background: 'var(--accent)' }}
        />
      )}
      <span className="w-4 text-center text-[13px]">{icon}</span>
      {label}
    </Link>
  );
}
