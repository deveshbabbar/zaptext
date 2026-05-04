import { requireClientWithBots } from '@/lib/auth';
import { UserButton } from '@clerk/nextjs';
import { BotSwitcher } from '@/components/client/bot-switcher';
import { SidebarNav } from '@/components/client/sidebar-nav';
import { getActiveSubscription } from '@/lib/subscription';
import { PLANS } from '@/lib/plans';
import Link from 'next/link';
import { WelcomeTrigger } from '@/components/welcome-trigger';

const TYPE_ICONS: Record<string, string> = {
  restaurant: '🍽️',
  coaching: '📚',
  realestate: '🏠',
  salon: '💇',
  d2c: '🛍️',
  gym: '💪',
};

const TYPE_BG: Record<string, string> = {
  restaurant: 'bg-amber-100',
  coaching: 'bg-purple-100',
  realestate: 'bg-green-100',
  salon: 'bg-pink-100',
  d2c: 'bg-teal-100',
  gym: 'bg-red-100',
};

const TYPE_LABEL: Record<string, string> = {
  restaurant: 'Restaurant',
  coaching: 'Coaching',
  realestate: 'Real Estate',
  salon: 'Salon',
  d2c: 'D2C',
  gym: 'Gym',
};

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
      <WelcomeTrigger />
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

        <SidebarNav />

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

      <main className="flex-1 overflow-auto bg-background">
        {user.activeBot && (
          <div
            className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--card)]/95 backdrop-blur flex items-center gap-3"
            style={{ padding: '12px 24px' }}
          >
            <div
              className={`w-11 h-11 rounded-[12px] grid place-items-center text-[22px] flex-shrink-0 ${TYPE_BG[user.activeBot.type] || 'bg-gray-100'}`}
              aria-hidden="true"
            >
              {TYPE_ICONS[user.activeBot.type] || '🤖'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-semibold uppercase tracking-[.08em] text-[var(--mute)]">
                  Now editing
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[.05em] px-1.5 py-0.5 rounded-full ${
                    user.activeBot.status === 'active'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                      : 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      user.activeBot.status === 'active' ? 'bg-emerald-500' : 'bg-yellow-500'
                    }`}
                  />
                  {user.activeBot.status}
                </span>
              </div>
              <div className="text-[16px] font-bold text-foreground leading-tight truncate">
                {user.activeBot.business_name || '(unnamed bot)'}
              </div>
              <div className="text-[12px] text-[var(--mute)] mt-0.5 truncate">
                {TYPE_LABEL[user.activeBot.type] || user.activeBot.type}
                {user.activeBot.whatsapp_number ? ` · ${user.activeBot.whatsapp_number}` : ''}
              </div>
            </div>
            {user.allBots.length > 1 && (
              <span className="hidden md:inline-block text-[11px] text-[var(--mute)] flex-shrink-0">
                Switch bots from sidebar ↖
              </span>
            )}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}

