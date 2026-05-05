'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Two-section client-side nav with active-route highlighting. Lives in a
// client component because the parent layout is a server component (loads
// auth + active bot) and usePathname() requires the client.
//
// Active state matches by exact path OR path-prefix, so /client/staff and
// /client/staff/123 both light up the "My Team" item without per-route
// config. The active style uses the accent color + a left bar so the
// current section reads at a glance even when the sidebar is busy.

interface NavItem {
  href: string;
  icon: string;
  label: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    title: 'Workspace',
    items: [
      { href: '/client/dashboard', icon: '📊', label: 'Dashboard' },
      { href: '/client/analytics', icon: '📈', label: 'Analytics' },
      { href: '/client/conversations', icon: '💬', label: 'Conversations' },
      { href: '/client/bookings', icon: '📅', label: 'Bookings' },
      { href: '/client/inventory', icon: '📦', label: 'Inventory' },
      { href: '/client/staff', icon: '👥', label: 'My Team' },
      { href: '/client/availability', icon: '⏰', label: 'Availability' },
      { href: '/client/calendar', icon: '📆', label: 'Calendar' },
      { href: '/client/settings', icon: '⚙️', label: 'Bot Settings' },
      { href: '/client/welcome-menu', icon: '👋', label: 'Welcome menu' },
    ],
  },
  {
    title: 'Account',
    items: [
      { href: '/client/subscription', icon: '💳', label: 'Subscription' },
      { href: '/client/bots', icon: '🤖', label: 'All bots' },
      { href: '/client/create-bot', icon: '✨', label: 'Create bot' },
    ],
  },
];

function isActive(currentPath: string, href: string): boolean {
  if (currentPath === href) return true;
  return currentPath.startsWith(`${href}/`);
}

export function SidebarNav() {
  const pathname = usePathname() || '';
  return (
    <>
      {SECTIONS.map((section) => (
        <div key={section.title}>
          <div
            className="zt-mono text-[10px] uppercase tracking-[.09em] text-white/55"
            style={{ padding: '14px 8px 4px' }}
          >
            {section.title}
          </div>
          <nav className="flex flex-col gap-px">
            {section.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-2.5 rounded-[9px] transition-all font-medium text-[13.5px] ${
                    active
                      ? 'text-white font-semibold'
                      : 'text-white/65 hover:text-white hover:bg-white/5'
                  }`}
                  style={{
                    padding: '9px 10px',
                    background: active
                      ? 'color-mix(in oklab, var(--accent) 16%, transparent)'
                      : undefined,
                  }}
                  aria-current={active ? 'page' : undefined}
                >
                  {/* Left bar accent for the active item */}
                  {active && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] rounded-r-full bg-[var(--accent)]"
                      aria-hidden="true"
                    />
                  )}
                  <span className="w-4 text-center text-[13px]">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
    </>
  );
}
