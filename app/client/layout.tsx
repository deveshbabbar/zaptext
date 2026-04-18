import { requireClientWithBots } from '@/lib/auth';
import { UserButton } from '@clerk/nextjs';
import { BotSwitcher } from '@/components/client/bot-switcher';
import { getActiveSubscription } from '@/lib/subscription';
import { PLANS } from '@/lib/plans';
import Link from 'next/link';

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const user = await requireClientWithBots();

  let planName: string | null = null;
  let planPrice: number | null = null;
  let usagePercent = 0;
  let daysRemaining = 0;
  let expiryWarning = false;
  let hasActive = false;

  try {
    const sub = await getActiveSubscription(user.userId);
    if (sub) {
      hasActive = true;
      const plan = PLANS[sub.plan];
      planName = plan?.name || sub.plan;
      planPrice = plan?.price || null;
      const start = new Date(sub.startDate).getTime();
      const end = new Date(sub.endDate).getTime();
      const now = Date.now();
      const total = end - start;
      const elapsed = now - start;
      usagePercent = Math.min(Math.max(Math.round((elapsed / total) * 100), 0), 100);
      daysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
      expiryWarning = daysRemaining <= 5;
    }
  } catch {
    // ignore
  }

  const initials = (user.name || user.email)
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
            <div className="text-[10.5px] text-white/55 zt-mono uppercase tracking-[.08em]">Client workspace</div>
          </div>
        </Link>

        <BotSwitcher bots={user.allBots} activeBotId={user.activeBot?.client_id || null} />

        <div
          className="rounded-[12px] mb-3.5 mt-2 mx-2"
          style={{
            padding: '10px 12px',
            background: hasActive
              ? 'color-mix(in oklab, var(--accent) 14%, transparent)'
              : 'color-mix(in oklab, #E89A1C 14%, transparent)',
            border: hasActive
              ? '1px solid color-mix(in oklab, var(--accent) 30%, transparent)'
              : '1px solid color-mix(in oklab, #E89A1C 40%, transparent)',
          }}
        >
          <div className="flex justify-between text-[12px]">
            <b className={`${hasActive ? 'text-[var(--accent)]' : 'text-[#ffb54a]'} tracking-[-0.01em]`}>
              {hasActive ? `${planName}${planPrice ? ` · ₹${planPrice.toLocaleString('en-IN')}/mo` : ''}` : 'No active plan'}
            </b>
            <Link
              href="/client/subscription"
              className={`${hasActive ? 'text-[var(--accent)] border-[var(--accent)]' : 'text-[#ffb54a] border-[#ffb54a]'} font-semibold text-[11px] border-b`}
            >
              {hasActive ? 'Manage' : 'Subscribe'}
            </Link>
          </div>
          {hasActive ? (
            <>
              <div className={`h-[3px] rounded-[3px] mt-2 mb-1.5 overflow-hidden ${expiryWarning ? 'bg-red-500/20' : 'bg-white/10'}`}>
                <i
                  className={`block h-full ${expiryWarning ? 'bg-red-500' : 'bg-[var(--accent)]'}`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              <div className={`text-[10.5px] zt-mono ${expiryWarning ? 'text-red-400 font-semibold' : 'text-white/55'}`}>
                {expiryWarning
                  ? `⚠ ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left`
                  : `${daysRemaining} days left · Active`}
              </div>
            </>
          ) : (
            <div className="text-[10.5px] text-[#ffb54a] mt-1">Subscribe to create bots</div>
          )}
        </div>

        <SideSec>Workspace</SideSec>
        <nav className="flex flex-col gap-px">
          <SideLink href="/client/dashboard" icon="📊" label="Dashboard" />
          <SideLink href="/client/conversations" icon="💬" label="Conversations" />
          <SideLink href="/client/bookings" icon="📅" label="Bookings" />
          <SideLink href="/client/inventory" icon="📦" label="Inventory" />
          <SideLink href="/client/availability" icon="⏰" label="Availability" />
          <SideLink href="/client/calendar" icon="📆" label="Calendar" />
          <SideLink href="/client/settings" icon="⚙️" label="Bot Settings" />
        </nav>

        <SideSec>Account</SideSec>
        <nav className="flex flex-col gap-px">
          <SideLink href="/client/subscription" icon="💳" label="Subscription" />
          <SideLink href="/client/bots" icon="🤖" label="All bots" />
          <SideLink href="/client/create-bot" icon="✨" label="Create bot" />
        </nav>

        <div className="mt-auto pt-3 border-t border-white/10 flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] rounded-full bg-[var(--accent)] text-[var(--accent-2)] grid place-items-center font-bold text-[13px]">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold truncate">{user.name || 'User'}</div>
            <div className="text-[10.5px] text-white/50 truncate">{user.email}</div>
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

function SideLink({ href, icon, label, count }: { href: string; icon: string; label: string; count?: number }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-[9px] text-white/65 hover:text-white hover:bg-white/5 transition-colors font-medium text-[13.5px]"
      style={{ padding: '9px 10px' }}
    >
      <span className="w-4 text-center text-[13px]">{icon}</span>
      {label}
      {typeof count === 'number' && (
        <span
          className="ml-auto zt-mono text-[10.5px] rounded-full font-semibold text-white/65"
          style={{ padding: '2px 7px', background: '#ffffff10' }}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
