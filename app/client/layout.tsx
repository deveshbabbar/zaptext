import { requireClientWithBots } from '@/lib/auth';
import { UserButton } from '@clerk/nextjs';
import { BotSwitcher } from '@/components/client/bot-switcher';
import { ThemeToggle } from '@/components/theme-toggle';

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const user = await requireClientWithBots();

  const initials = (user.name || user.email)
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex h-screen">
      <aside className="w-[280px] bg-sidebar text-sidebar-foreground p-4 flex flex-col overflow-y-auto">
        <div className="flex items-center gap-2.5 px-2 pb-4 border-b border-sidebar-border mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center text-sidebar-foreground font-bold text-sm">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm truncate">{user.name || 'User'}</div>
            <div className="text-[11px] text-sidebar-foreground/50 truncate">{user.email}</div>
          </div>
        </div>

        <BotSwitcher bots={user.allBots} activeBotId={user.activeBot?.client_id || null} />

        <div className="mx-2 mt-2 bg-primary/10 border border-primary/20 rounded-lg p-2 text-[11px]">
          <div className="flex justify-between text-sidebar-foreground">
            <span className="font-bold">Pro Plan</span>
            <a href="/client/subscription" className="text-accent font-semibold hover:underline">Upgrade</a>
          </div>
          <div className="h-[3px] bg-sidebar-foreground/10 rounded-full mt-1.5 overflow-hidden">
            <div className="h-full w-1/4 bg-gradient-to-r from-accent to-accent/70 rounded-full" />
          </div>
          <div className="text-[10px] text-sidebar-foreground/50 mt-1">Active</div>
        </div>

        <div className="mt-4 mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
          Current Bot
        </div>
        <nav className="space-y-0.5">
          <NavLink href="/client/dashboard" icon="📊" label="Dashboard" />
          <NavLink href="/client/conversations" icon="💬" label="Conversations" />
          <NavLink href="/client/bookings" icon="📅" label="Bookings" />
          <NavLink href="/client/availability" icon="⏰" label="Availability" />
          <NavLink href="/client/calendar" icon="📆" label="Calendar" />
          <NavLink href="/client/settings" icon="⚙️" label="Bot Settings" />
        </nav>

        <div className="mt-4 mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
          Account
        </div>
        <nav className="space-y-0.5">
          <NavLink href="/client/subscription" icon="💳" label="Subscription" />
          <NavLink href="/client/bots" icon="🤖" label="All Bots" />
        </nav>

        <div className="mt-auto pt-3 border-t border-sidebar-border flex gap-1.5 items-center">
          <ThemeToggle />
          <div className="ml-auto">
            <UserButton />
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-background">{children}</main>
    </div>
  );
}

function NavLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground text-[13px] transition-colors"
    >
      <span className="w-[18px] text-center text-sm">{icon}</span>
      {label}
    </a>
  );
}
