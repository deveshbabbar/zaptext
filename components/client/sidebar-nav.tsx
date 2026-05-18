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
  // Customers = unified directory of every phone that has chatted,
  // booked, or placed an order with this bot (WhatsApp chat, /m
  // menu-page orders, dine-in / takeaway, bookings, grocery).
  // Conversations only surfaces people who messaged — Customers
  // also catches /m-page orderers who never DMed the bot.
  { href: '/client/customers', icon: '👥', label: 'Customers' },
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

// Find the SINGLE item in `items` whose href best matches `currentPath`.
// Exact match wins; otherwise the longest prefix-matching href wins.
// Returns null when no item matches (e.g. on a page that isn't in this
// section). Avoiding the previous bug where multiple items lit up at
// once — e.g. on /client/restaurant/tables, both /client/restaurant
// (overview, prefix-match) AND /client/restaurant/tables (exact-match)
// were highlighted. Now only the most-specific item wins per section.
function bestMatchHref(currentPath: string, items: NavItem[]): string | null {
  let bestHref: string | null = null;
  let bestLen = -1;
  for (const item of items) {
    const matches =
      currentPath === item.href ||
      currentPath.startsWith(`${item.href}/`);
    if (matches && item.href.length > bestLen) {
      bestHref = item.href;
      bestLen = item.href.length;
    }
  }
  return bestHref;
}

interface SidebarNavProps {
  isTrial?: boolean;
  activeBotType?: string;
  /** Phase 3I v2 — when true, hide all owner-only nav items
   *  (Outlets, Team Members) and the owner-scoped common items
   *  (Dashboard, Conversations, Bot Settings, Welcome menu).
   *  Outlet managers only see their outlet's working surfaces
   *  (orders, menu, tables-live, etc.). */
  isOutletManager?: boolean;
}

// Restaurant nav items that only the chain OWNER should see. Outlet
// managers don't manage outlet configs, team membership, the chain-wide
// menu, or chain-wide specials. The pages themselves redirect outlet
// managers back to /client/restaurant (owner-only at the server) —
// listing them in the sidebar produced a "link does nothing" UX where
// clicking Menu silently bounced back to the overview.
const OWNER_ONLY_RESTAURANT_HREFS: ReadonlySet<string> = new Set([
  '/client/restaurant/outlets',
  '/client/restaurant/team',
  '/client/restaurant/menu',
  '/client/restaurant/specials',
]);

// Vertical-specific workspace links. These are MERGED into the Workspace
// section based on the active bot's type — no separate "Vertical · X"
// header. Each list appears between Dashboard and the common items.
const VERTICAL_ITEMS: Record<string, NavItem[]> = {
  restaurant: [
    { href: '/client/restaurant', icon: '🍽️', label: 'Restaurant overview' },
    { href: '/client/restaurant/analytics', icon: '📊', label: 'Analytics' },
    { href: '/client/restaurant/menu', icon: '📋', label: 'Menu' },
    // Stock / inventory — `/client/inventory` is universal across verticals
    // but it's surfaced here next to Menu because that's where restaurant
    // owners naturally look ("dum biryani ke 20 plates available" lives
    // next to the dum biryani menu entry). LOCKED_FOR_TRIAL adds the 🔒
    // badge on the free plan; paid plans see it normally.
    { href: '/client/inventory', icon: '📦', label: 'Inventory' },
    { href: '/client/restaurant/tables-live', icon: '🟢', label: 'Live tables' },
    { href: '/client/restaurant/qr-codes', icon: '📱', label: 'QR codes' },
    { href: '/client/restaurant/orders', icon: '📦', label: "Today's orders" },
    { href: '/client/restaurant/tables', icon: '🪑', label: 'Reservations' },
    // Availability = the weekly schedule that drives Reservations. The page
    // is at /client/availability (not under /restaurant/) because the same
    // schedule serves salon appointments, gym classes, coaching demos, etc.
    // — but it's surfaced here next to Reservations so the restaurant owner
    // doesn't have to hunt for "where do I set my open hours for bookings?".
    // The webhook ALREADY reads weekly_slots and injects them into the AI
    // prompt for booking-related messages on paid plans (see
    // app/api/webhook/route.ts L897-L908) — the only previous gap was that
    // this UI was unreachable from the sidebar.
    { href: '/client/availability', icon: '🕒', label: 'Availability' },
    { href: '/client/restaurant/specials', icon: '⭐', label: 'Specials' },
    { href: '/client/restaurant/outlets', icon: '🏢', label: 'Outlets' },
    { href: '/client/restaurant/storefront', icon: '🛒', label: 'Storefront' },
    { href: '/client/restaurant/team', icon: '👥', label: 'Team Members' },
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
  grocery: [
    { href: '/client/grocery', icon: '🛍️', label: 'Grocery overview' },
    { href: '/client/grocery/catalog', icon: '🥬', label: "Today's catalog" },
    { href: '/client/grocery/products', icon: '📦', label: 'Products' },
    { href: '/client/grocery/zones', icon: '📍', label: 'Delivery zones' },
    { href: '/client/grocery/slots', icon: '⏰', label: 'Delivery slots' },
    { href: '/client/grocery/orders', icon: '🧾', label: 'Orders' },
    { href: '/client/grocery/recurring', icon: '🔁', label: 'Recurring orders' },
  ],
};

function buildSections(activeBotType?: string, isOutletManager = false): NavSection[] {
  const rawVerticalItems = activeBotType ? VERTICAL_ITEMS[activeBotType] || [] : [];
  // Outlet managers don't see Outlets / Team Members links — those
  // are owner-only (page-level redirects are the real enforcement;
  // this is the UX layer).
  const verticalItems = isOutletManager
    ? rawVerticalItems.filter((it) => !OWNER_ONLY_RESTAURANT_HREFS.has(it.href))
    : rawVerticalItems;

  if (isOutletManager) {
    // Outlet managers don't need the chain-wide common items
    // (Dashboard / Conversations / Bot Settings / Welcome menu —
    // each of these is owner-scoped at the page level too). They
    // see ONLY the restaurant working surfaces.
    return [
      {
        title: 'Outlet workspace',
        items: verticalItems,
      },
      // Skip ACCOUNT_SECTION (subscription / all bots / create bot
      // are owner-only).
    ];
  }

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

export function SidebarNav({ isTrial = false, activeBotType, isOutletManager = false }: SidebarNavProps) {
  const pathname = usePathname() || '';
  const sections = buildSections(activeBotType, isOutletManager);
  // Pre-compute the SINGLE active href per section — only that item
  // gets highlighted, even if multiple items in the same section
  // technically prefix-match the current URL.
  const activeHrefPerSection: Record<string, string | null> = {};
  for (const section of sections) {
    activeHrefPerSection[section.title] = bestMatchHref(pathname, section.items);
  }
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
              const active = activeHrefPerSection[section.title] === item.href;
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
