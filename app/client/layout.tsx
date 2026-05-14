import { requireClientWithBots } from '@/lib/auth';
import { UserButton } from '@clerk/nextjs';
import { BotSwitcher } from '@/components/client/bot-switcher';
import { SidebarNav } from '@/components/client/sidebar-nav';
import { BotContextCard } from '@/components/client/bot-context-card';
import { getActiveSubscription } from '@/lib/subscription';
import { PLANS, TRIAL_MESSAGE_LIMIT, isTrialPlan } from '@/lib/plans';
import { getOutboundCountForOwner } from '@/lib/db/conversations';
import { findActiveMembershipForEmail } from '@/lib/db/team-members';
import { getClientById } from '@/lib/db/clients';
import Link from 'next/link';
import { WelcomeTrigger } from '@/components/welcome-trigger';

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const user = await requireClientWithBots();

  // Phase 3I v2 — outlet-manager detection. A user with NO owned bots
  // but an active team_members row for someone else's restaurant
  // should still see the restaurant nav (read-only-ish, owner-only
  // pages gated server-side). We synthesise an effective bot type so
  // VERTICAL_ITEMS lookup works, and pass `isOutletManager` so the
  // sidebar hides owner-only entries (Outlets, Team Members).
  let isOutletManager = false;
  let effectiveBotType: string | undefined = user.activeBot?.type;
  if (!user.activeBot && user.email) {
    try {
      const memberships = await findActiveMembershipForEmail(user.email);
      for (const m of memberships) {
        const ownerBot = await getClientById(m.owner_client_id);
        if (ownerBot && ownerBot.type === 'restaurant') {
          isOutletManager = true;
          effectiveBotType = 'restaurant';
          break;
        }
      }
    } catch { /* fail open — no nav scoping if lookup fails */ }
  }

  let planName: string | null = null;
  let planPrice: number | null = null;
  let usagePercent = 0;
  let daysRemaining = 0;
  let expiryWarning = false;
  let hasActive = false;
  let isTrial = false;
  let trialUsed = 0;
  let trialCapHit = false;

  try {
    const sub = await getActiveSubscription(user.userId);
    if (sub) {
      hasActive = true;
      const plan = PLANS[sub.plan];
      planName = plan?.name || sub.plan;
      planPrice = plan?.price || null;
      isTrial = isTrialPlan(sub.plan);
      if (isTrial) {
        // For the free tier we don't show time-based progress (it's
        // effectively forever) — show usage of the 50-message lifetime
        // cap instead, since that's the real cap that matters.
        trialUsed = await getOutboundCountForOwner(user.userId).catch(() => 0);
        usagePercent = Math.min(
          Math.round((trialUsed / TRIAL_MESSAGE_LIMIT) * 100),
          100
        );
        trialCapHit = trialUsed >= TRIAL_MESSAGE_LIMIT;
      } else {
        const start = new Date(sub.startDate).getTime();
        const end = new Date(sub.endDate).getTime();
        const now = Date.now();
        const total = end - start;
        const elapsed = now - start;
        usagePercent = Math.min(Math.max(Math.round((elapsed / total) * 100), 0), 100);
        daysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
        expiryWarning = daysRemaining <= 5;
      }
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
            <b className={`${hasActive ? (isTrial ? 'text-[#ffb54a]' : 'text-[var(--accent)]') : 'text-[#ffb54a]'} tracking-[-0.01em]`}>
              {hasActive
                ? isTrial
                  ? 'Free'
                  : `${planName}${planPrice ? ` · ₹${planPrice.toLocaleString('en-IN')}/mo` : ''}`
                : 'No active plan'}
            </b>
            <Link
              href="/client/subscription"
              className={`${hasActive && !isTrial ? 'text-[var(--accent)] border-[var(--accent)]' : 'text-[#ffb54a] border-[#ffb54a]'} font-semibold text-[11px] border-b`}
            >
              {hasActive ? (isTrial ? 'Upgrade now' : 'Manage') : 'Subscribe'}
            </Link>
          </div>
          {hasActive ? (
            isTrial ? (
              <>
                <div className={`h-[3px] rounded-[3px] mt-2 mb-1.5 overflow-hidden ${trialCapHit ? 'bg-red-500/20' : 'bg-white/10'}`}>
                  <i
                    className={`block h-full ${trialCapHit ? 'bg-red-500' : 'bg-[#ffb54a]'}`}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <div className={`text-[10.5px] zt-mono ${trialCapHit ? 'text-red-400 font-semibold' : 'text-white/55'}`}>
                  {trialCapHit
                    ? `⚠ Free cap used — upgrade to keep replying`
                    : `${trialUsed} / ${TRIAL_MESSAGE_LIMIT} free replies used`}
                </div>
              </>
            ) : (
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
            )
          ) : (
            <div className="text-[10.5px] text-[#ffb54a] mt-1">Subscribe to create bots</div>
          )}
        </div>

        <SidebarNav isTrial={isTrial} activeBotType={effectiveBotType} isOutletManager={isOutletManager} />

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
          <BotContextCard
            activeBot={user.activeBot}
            multiBot={user.allBots.length > 1}
            sub={{ hasActive, planName, daysRemaining, expiryWarning }}
          />
        )}
        {children}
      </main>
    </div>
  );
}

