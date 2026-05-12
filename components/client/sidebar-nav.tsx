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
//
// Plan-gating (Option B): when `isTrial` is true and an item's href is in
// `LOCKED_FOR_TRIAL`, the item renders with a 🔒 badge, dims the colour,
// and rewrites the link target to /client/subscription so a click drives
// the upsell instead of landing on a useless configuration page. The
// matching API write routes still hard-block these features at the
// server (defence in depth) — this is just the UX/upsell layer.

interface NavItem {
  href: string;
  icon: string;
  label: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

// Common workspace items — appear in EVERY active bot's sidebar.
const COMMON_WORKSPACE_ITEMS: NavItem[] = [
  { href: '/client/dashboard', icon: '📊', label: 'Dashboard' },
  { href: '/client/conversations', icon: '💬', label: 'Conversations' },
  { href: '/client/settings', icon: '⚙️', label: 'Bot Settings' },
  { href: '/client/welcome-menu', icon: '👋', label: 'Welcome menu' },
];

const ACCOUNT_SECTION: NavSection = {
  title: 'Account',
  items: [
    { href: '/client/subscription', icon: '💳', label: 'Subscription' },
    { href: '/client/bots', icon: '🤖', label: 'All bots' },
    { href: '/client/create-bot', icon: '✨', label: 'Create bot' },
  ],
};

// Pages whose underlying feature isn't included in the Free plan (per
// PLANS.trial.features in lib/plans.ts: bookings/payments/inventory/
// staff_management = false). Availability + Calendar are listed because
// they only make sense alongside Bookings.
const LOCKED_FOR_TRIAL: ReadonlySet<string> = new Set([
  '/client/bookings',
  '/client/inventory',
  '/client/staff',
  '/client/availability',
  '/client/calendar',
]);

function isActive(currentPath: string, href: string): boolean {
  if (currentPath === href) return true;
  return currentPath.startsWith(`${href}/`);
}

interface SidebarNavProps {
  isTrial?: boolean;
  activeBotType?: string;
}

// Vertical-specific workspace links. These are MERGED into the Workspace
// section based on the active bot's type — no separate "Vertical · X"
// header. Each list appears between Dashboard and the common items.
const VERTICAL_ITEMS: Record<string, NavItem[]> = {
  restaurant: [
    { href: '/client/restaurant', icon: '🍽️', label: 'Restaurant overview' },
    { href: '/client/restaurant/analytics', icon: '📊', label: 'Analytics' },
    { href: '/client/restaurant/menu', icon: '📋', label: 'Menu' },
    { href: '/client/restaurant/tables-live', icon: '🟢', label: 'Live tables' },
    { href: '/client/restaurant/qr-codes', icon: '📱', label: 'QR codes' },
    { href: '/client/restaurant/orders', icon: '📦', label: "Today's orders" },
    { href: '/client/restaurant/tables', icon: '🪑', label: 'Reservations' },
    { href: '/client/restaurant/specials', icon: '⭐', label: 'Specials' },
  ],
  coaching: [
    { href: '/client/coaching', icon: '🎓', label: 'Coaching overview' },
    { href: '/client/coaching/courses', icon: '📚', label: 'Courses' },
    { href: '/client/coaching/batches', icon: '📅', label: 'Batches' },
  ],
  realestate: [
    { href: '/client/realestate', icon: '🏠', label: 'Real Estate overview' },
    { href: '/client/realestate/listings', icon: '🏷️', label: 'Listings' },
    { href: '/client/realestate/visits', icon: '📅', label: 'Site visits' },
  ],
  salon: [
    { href: '/client/salon', icon: '💇', label: 'Salon overview' },
    { href: '/client/salon/services', icon: '✂️', label: 'Services' },
    { href: '/client/salon/appointments', icon: '📅', label: 'Appointments' },
  ],
  gym: [
    { href: '/client/gym', icon: '💪', label: 'Gym overview' },
    { href: '/client/gym/plans', icon: '🎟️', label: 'Plans' },
    { href: '/client/gym/schedule', icon: '📅', label: 'Schedule' },
  ],
  tiffin: [
    { href: '/client/tiffin', icon: '🍱', label: 'Tiffin overview' },
    { href: '/client/tiffin/plans', icon: '📋', label: 'Plans' },
    { href: '/client/tiffin/route', icon: '📍', label: "Today's route" },
  ],
  ecommerce: [
    { href: '/client/ecommerce', icon: '🛒', label: 'Ecommerce overview' },
    { href: '/client/ecommerce/products', icon: '📦', label: 'Products' },
    { href: '/client/ecommerce/orders', icon: '🧾', label: 'Orders' },
  ],
};

function buildSections(activeBotType?: string): NavSection[] {
  const verticalItems = activeBotType ? VERTICAL_ITEMS[activeBotType] || [] : [];
  // Order: Dashboard → vertical items → common items below
  const dashboardItem = COMMON_WORKSPACE_ITEMS[0];
  const restCommon = COMMON_WORKSPACE_ITEMS.slice(1);
  return [
    {
      title: 'Workspace',
      items: [dashboardItem, ...verticalItems, ...restCommon],
    },
    ACCOUNT_SECTION,
  ];
}

export function SidebarNav({ isTrial = false, activeBotType }: SidebarNavProps) {
  const pathname = usePathname() || '';
  const sections = buildSections(activeBotType);
  return (
    <>
      {sections.map((section) => (
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
              const locked = isTrial && LOCKED_FOR_TRIAL.has(item.href);
              const targetHref = locked ? '/client/subscription#upgrade' : item.href;
              const colourCls = locked
                ? 'text-white/35 hover:text-white/55 hover:bg-white/5'
                : active
                ? 'text-white font-semibold'
                : 'text-white/65 hover:text-white hover:bg-white/5';
              return (
                <Link
                  key={item.href}
                  href={targetHref}
                  title={locked ? 'Available on Starter (₹599/mo). Click to upgrade.' : undefined}
                  className={`relative flex items-center gap-2.5 rounded-[9px] transition-all font-medium text-[13.5px] ${colourCls}`}
                  style={{
                    padding: '9px 10px',
                    background:
                      !locked && active
                        ? 'color-mix(in oklab, var(--accent) 16%, transparent)'
                        : undefined,
                  }}
                  aria-current={active ? 'page' : undefined}
                  aria-disabled={locked || undefined}
                >
                  {/* Left bar accent for the active item (paid only) */}
                  {!locked && active && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] rounded-r-full bg-[var(--accent)]"
                      aria-hidden="true"
                    />
                  )}
                  <span className="w-4 text-center text-[13px]">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {locked && (
                    <span
                      className="text-[11px] text-[#ffb54a]"
                      aria-label="Upgrade required"
                    >
                      🔒
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
    </>
  );
}
