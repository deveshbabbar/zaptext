'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ClientRow, BusinessType } from '@/lib/types';
import {
  PageTopbar,
  PageHead,
  HeroCard,
  NumChip,
  StatCard,
  Panel,
  Pill,
  StatusPill,
  MonoLabel,
} from '@/components/app/primitives';

// Vertical-specific dashboard copy. The bot is a gym/restaurant/salon/etc.
// in the customer's mind, not a generic "bookings" engine — so the
// dashboard greets the owner in the language of their actual business.
//
// Each entry maps a BusinessType to:
//   - heroTitle / heroDesc: the big top card
//   - todayLabel: stat-card label for "today's primary thing"
//   - scheduleTitle / scheduleEmpty / scheduleSub: the bookings panel
//   - quickLink: a vertical-relevant deep link (e.g. trainers for gym,
//     menu for restaurant)
interface DashboardCopy {
  heroTitle: ReactNode;
  heroDesc: (totalMessages: number) => ReactNode;
  todayLabel: string;
  scheduleTitle: string;
  scheduleEmpty: string;
  scheduleSub: (count: number) => string;
  quickLink?: { href: string; emoji: string; label: string };
}

const DEFAULT_COPY: DashboardCopy = {
  heroTitle: (
    <>
      Customers can chat <span className="zt-serif">24/7</span>, boss.
    </>
  ),
  heroDesc: (n) => (
    <>
      Your AI handled <b style={{ color: '#fff' }}>{n}</b> messages total.
    </>
  ),
  todayLabel: "Today's bookings",
  scheduleTitle: "Today's schedule",
  scheduleEmpty: 'Nothing scheduled today.',
  scheduleSub: (n) => (n === 0 ? 'No bookings yet today' : `${n} booked`),
};

const TYPE_COPY: Record<BusinessType, DashboardCopy> = {
  gym: {
    heroTitle: (
      <>
        Training requests <span className="zt-serif">all day</span>.
      </>
    ),
    heroDesc: (n) => (
      <>
        Your AI handled <b style={{ color: '#fff' }}>{n}</b> messages — booking sessions and answering members.
      </>
    ),
    todayLabel: "Today's sessions",
    scheduleTitle: "Today's training sessions",
    scheduleEmpty: 'No sessions booked yet today.',
    scheduleSub: (n) => (n === 0 ? 'No sessions yet' : `${n} session${n === 1 ? '' : 's'} booked`),
    quickLink: { href: '/client/staff', emoji: '🏋️', label: 'Trainers' },
  },
  restaurant: {
    heroTitle: (
      <>
        Orders rolling in <span className="zt-serif">all day</span>.
      </>
    ),
    heroDesc: (n) => (
      <>
        Your AI took <b style={{ color: '#fff' }}>{n}</b> messages — turning chats into orders.
      </>
    ),
    todayLabel: "Today's orders",
    scheduleTitle: "Today's reservations",
    scheduleEmpty: 'No reservations yet today.',
    scheduleSub: (n) => (n === 0 ? 'No reservations yet' : `${n} reservation${n === 1 ? '' : 's'}`),
    quickLink: { href: '/client/inventory', emoji: '🍽️', label: 'Menu' },
  },
  salon: {
    heroTitle: (
      <>
        Bookings flowing in <span className="zt-serif">non-stop</span>.
      </>
    ),
    heroDesc: (n) => (
      <>
        Your AI handled <b style={{ color: '#fff' }}>{n}</b> messages — filling chairs.
      </>
    ),
    todayLabel: "Today's appointments",
    scheduleTitle: "Today's appointments",
    scheduleEmpty: 'No appointments yet today.',
    scheduleSub: (n) => (n === 0 ? 'No appointments yet' : `${n} appointment${n === 1 ? '' : 's'}`),
    quickLink: { href: '/client/staff', emoji: '💇', label: 'Stylists' },
  },
  coaching: {
    heroTitle: (
      <>
        Students signing up <span className="zt-serif">round the clock</span>.
      </>
    ),
    heroDesc: (n) => (
      <>
        Your AI handled <b style={{ color: '#fff' }}>{n}</b> messages — converting interest into demos.
      </>
    ),
    todayLabel: "Today's demos",
    scheduleTitle: "Today's demo classes",
    scheduleEmpty: 'No demos booked yet today.',
    scheduleSub: (n) => (n === 0 ? 'No demos yet' : `${n} demo${n === 1 ? '' : 's'}`),
    quickLink: { href: '/client/staff', emoji: '📚', label: 'Faculty' },
  },
  realestate: {
    heroTitle: (
      <>
        Property inquiries <span className="zt-serif">24/7</span>.
      </>
    ),
    heroDesc: (n) => (
      <>
        Your AI handled <b style={{ color: '#fff' }}>{n}</b> messages — qualifying leads.
      </>
    ),
    todayLabel: "Today's site visits",
    scheduleTitle: "Today's site visits",
    scheduleEmpty: 'No site visits scheduled yet.',
    scheduleSub: (n) => (n === 0 ? 'No site visits yet' : `${n} site visit${n === 1 ? '' : 's'}`),
    quickLink: { href: '/client/inventory', emoji: '🏠', label: 'Listings' },
  },
  d2c: {
    heroTitle: (
      <>
        Orders dropping in <span className="zt-serif">your DMs</span>.
      </>
    ),
    heroDesc: (n) => (
      <>
        Your AI handled <b style={{ color: '#fff' }}>{n}</b> messages — recovering carts and closing sales.
      </>
    ),
    todayLabel: "Today's orders",
    scheduleTitle: "Today's orders",
    scheduleEmpty: 'No orders yet today.',
    scheduleSub: (n) => (n === 0 ? 'No orders yet' : `${n} order${n === 1 ? '' : 's'}`),
    quickLink: { href: '/client/inventory', emoji: '🛍️', label: 'Products' },
  },
  tiffin: {
    heroTitle: (
      <>
        Subscriptions filling up <span className="zt-serif">all day</span>.
      </>
    ),
    heroDesc: (n) => (
      <>
        Your AI handled <b style={{ color: '#fff' }}>{n}</b> messages — taking dabba orders and answering menu queries.
      </>
    ),
    todayLabel: "Today's tiffins",
    scheduleTitle: "Today's deliveries",
    scheduleEmpty: 'No deliveries scheduled yet.',
    scheduleSub: (n) => (n === 0 ? 'No deliveries yet' : `${n} tiffin${n === 1 ? '' : 's'} out`),
    quickLink: { href: '/client/inventory', emoji: '🍱', label: 'Plans' },
  },
  grocery: {
    heroTitle: (
      <>
        Orders coming in <span className="zt-serif">all day</span>.
      </>
    ),
    heroDesc: (n) => (
      <>
        Your AI handled <b style={{ color: '#fff' }}>{n}</b> messages — taking grocery orders and answering stock queries.
      </>
    ),
    todayLabel: "Today's orders",
    scheduleTitle: "Today's deliveries",
    scheduleEmpty: 'No deliveries scheduled yet.',
    scheduleSub: (n) => (n === 0 ? 'No deliveries yet' : `${n} order${n === 1 ? '' : 's'} out`),
    quickLink: { href: '/client/inventory', emoji: '🥬', label: 'Stock' },
  },
  ecommerce: {
    heroTitle: (
      <>
        Orders streaming in <span className="zt-serif">all day</span>.
      </>
    ),
    heroDesc: (n) => (
      <>
        Your AI handled <b style={{ color: '#fff' }}>{n}</b> messages — answering product queries, tracking orders, recovering carts.
      </>
    ),
    todayLabel: "Today's orders",
    scheduleTitle: "Today's orders",
    scheduleEmpty: 'No orders yet today.',
    scheduleSub: (n) => (n === 0 ? 'No orders yet' : `${n} order${n === 1 ? '' : 's'}`),
    quickLink: { href: '/client/inventory', emoji: '🛒', label: 'Catalog' },
  },
};

interface Stats {
  totalBookings: number;
  todayBookings: number;
  totalMessages: number;
  uniqueCustomers: number;
}

interface BookingItem {
  customer_name: string;
  customer_phone: string;
  time_slot: string;
  end_time: string;
  service: string;
}

export function ClientDashboard({
  userName,
  activeBot,
  allBotsCount,
  icon,
}: {
  userName: string;
  activeBot: ClientRow;
  allBotsCount: number;
  icon: string;
}) {
  const searchParams = useSearchParams();
  const [stats, setStats] = useState<Stats | null>(null);
  const [todayBookings, setTodayBookings] = useState<BookingItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showActivationBanner, setShowActivationBanner] = useState(false);

  useEffect(() => {
    if (activeBot.status === 'pending' || searchParams.get('activated') === 'pending') {
      setShowActivationBanner(true);
    }
  }, [searchParams, activeBot.status]);

  useEffect(() => {
    fetch('/api/auth/welcome', { method: 'POST' }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/client/stats')
      .then((r) => r.json())
      .then((d) => {
        setStats(d.stats);
        setTodayBookings(d.todayBookings || []);
      })
      .catch(() => {});
  }, [activeBot.client_id]);

  const copyNumber = () => {
    navigator.clipboard.writeText(activeBot.whatsapp_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyLink = () => {
    const link = `${window.location.origin}/clients/${activeBot.client_id}`;
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const isPending = activeBot.status === 'pending';
  // Vertical-aware copy — gym/restaurant/etc. each get their own
  // hero + stat labels + schedule wording. Falls back to generic
  // for any unexpected type leak.
  const copy: DashboardCopy = TYPE_COPY[activeBot.type] || DEFAULT_COPY;
  const statsLoading = stats === null;

  return (
    <>
      <PageTopbar
        crumbs={
          <>
            <b className="text-foreground">Dashboard</b> · {today} · {stats?.todayBookings ?? 0} bookings today
          </>
        }
        actions={
          <>
            <Pill variant="ghost" onClick={copyLink}>
              🔗 {linkCopied ? 'Link copied!' : 'Share bot link'}
            </Pill>
            <Pill variant="ink" href="/client/create-bot">
              + New bot
            </Pill>
          </>
        }
      />

      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead title={<>Namaste, <span className="zt-serif">{userName}</span> 👋</>} />

        {!activeBot.phone_number_id && <WebhookSetupCard activeBot={activeBot} />}

        {showActivationBanner && (
          <div
            className="rounded-[18px] flex items-center gap-3.5"
            style={{
              padding: '18px 22px',
              marginBottom: 18,
              background:
                'linear-gradient(90deg, color-mix(in oklab, #E89A1C 20%, transparent), color-mix(in oklab, #E89A1C 5%, transparent))',
              border: '1px solid color-mix(in oklab, #E89A1C 45%, transparent)',
            }}
          >
            <div className="w-11 h-11 rounded-[12px] bg-[#E89A1C] text-white grid place-items-center text-[20px]">
              ⏳
            </div>
            <div className="flex-1">
              <b>Bot pending approval</b>
              <div className="text-[12.5px] text-[var(--ink-2)] mt-0.5">
                Your bot for <b>{activeBot.business_name}</b> is under review. Live within 48 hours.
              </div>
            </div>
            {!isPending && (
              <button
                onClick={() => setShowActivationBanner(false)}
                className="text-[var(--mute)] hover:text-[var(--ink)] text-sm"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {allBotsCount > 1 && (
          <div
            className="border border-dashed rounded-[14px] flex items-center gap-3 mb-4"
            style={{
              padding: 14,
              borderColor: 'color-mix(in oklab, var(--accent) 40%, transparent)',
              background: 'color-mix(in oklab, var(--accent) 10%, transparent)',
            }}
          >
            <div className="text-[22px]">✨</div>
            <div className="flex-1 text-[12.5px]">
              <b>Managing {allBotsCount} bots</b> — currently viewing <b>{activeBot.business_name}</b>.
            </div>
            <Link href="/client/bots" className="text-[var(--ink)] font-semibold text-[12px] border-b border-[var(--ink)]">
              View all →
            </Link>
          </div>
        )}

        <HeroCard
          tag={
            isPending
              ? `${activeBot.business_name.toUpperCase()} — PENDING`
              : `${activeBot.business_name.toUpperCase()} · LIVE`
          }
          title={isPending ? 'Bot under review.' : copy.heroTitle}
          desc={
            isPending
              ? 'Our team is setting up your bot. It will be activated within 48 hours.'
              : copy.heroDesc(stats?.totalMessages ?? 0)
          }
          emoji={icon}
          chip={
            <NumChip onCopy={activeBot.whatsapp_number ? copyNumber : undefined} copied={copied}>
              📱 {activeBot.whatsapp_number || 'Pending setup'}
            </NumChip>
          }
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
          {statsLoading ? (
            <>
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
            </>
          ) : (
            <>
              <StatCard emoji="📅" label={copy.todayLabel} value={stats?.todayBookings ?? 0} />
              <StatCard emoji="💬" label="Messages total" value={stats?.totalMessages ?? 0} />
              <StatCard emoji="👥" label="Unique customers" value={stats?.uniqueCustomers ?? 0} />
              <StatCard emoji="⚡" label="Avg response" value="2.1s" sub="Instant replies" />
            </>
          )}
        </div>

        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-3.5">
          <Panel
            title={copy.scheduleTitle}
            sub={statsLoading ? 'Loading…' : copy.scheduleSub(todayBookings.length)}
            action={
              <Link href="/client/calendar" className="text-[var(--ink)]">
                View calendar →
              </Link>
            }
          >
            {statsLoading ? (
              <ScheduleSkeleton rows={3} />
            ) : todayBookings.length === 0 ? (
              <p className="text-[13px] text-[var(--mute)] m-0">{copy.scheduleEmpty}</p>
            ) : (
              <div className="flex flex-col">
                {todayBookings.map((b, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3.5 py-2.5"
                    style={{ borderBottom: i < todayBookings.length - 1 ? '1px solid var(--line)' : 'none' }}
                  >
                    <div className="zt-mono text-[12.5px] font-bold bg-[var(--accent)] text-[var(--accent-2)] rounded-[7px] px-2.5 py-1">
                      {b.time_slot}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[14px] truncate">{b.customer_name}</div>
                      <div className="text-[12px] text-[var(--mute)]">{b.service || 'General'}</div>
                    </div>
                    <div className="zt-mono text-[12px] text-[var(--mute)] truncate max-w-[140px]">
                      {b.customer_phone}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Needs your attention"
            sub="Conversations flagged by bot"
            action={
              <Link href="/client/conversations" className="text-[var(--ink)]">
                Open inbox →
              </Link>
            }
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-3 py-2" style={{ borderBottom: '1px solid var(--line)' }}>
                <StatusPill variant="active">live</StatusPill>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[13.5px]">{activeBot.business_name}</div>
                  <div className="text-[12px] text-[var(--mute)]">All live, no escalations.</div>
                </div>
              </div>
              <MonoLabel className="mt-3">Quick links</MonoLabel>
              <div className="flex flex-wrap gap-1.5 mt-1">
                <Pill variant="ghost" href="/client/settings">⚙ Bot settings</Pill>
                <Pill variant="ghost" href="/client/availability">⏰ Hours</Pill>
                {copy.quickLink && (
                  <Pill variant="ghost" href={copy.quickLink.href}>
                    {copy.quickLink.emoji} {copy.quickLink.label}
                  </Pill>
                )}
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

// ─── Skeleton placeholders ───
// Replace the silent "0" values that used to flash on first paint with
// actual loading affordances. Keeps the layout dimensions identical to
// the loaded state so nothing jumps when data arrives.

function StatSkeleton() {
  return (
    <div
      className="rounded-[14px] border border-[var(--line)] bg-[var(--card)] flex flex-col gap-2 animate-pulse"
      style={{ padding: '14px 16px', minHeight: 88 }}
    >
      <div className="h-4 w-6 rounded bg-[var(--line)]" />
      <div className="h-3 w-24 rounded bg-[var(--line)]" />
      <div className="h-7 w-16 rounded bg-[var(--line)] mt-auto" />
    </div>
  );
}

function ScheduleSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3.5 py-2.5 animate-pulse"
          style={{ borderBottom: i < rows - 1 ? '1px solid var(--line)' : 'none' }}
        >
          <div className="h-7 w-14 rounded-[7px] bg-[var(--line)]" />
          <div className="flex-1 flex flex-col gap-1.5">
            <div className="h-3.5 w-32 rounded bg-[var(--line)]" />
            <div className="h-3 w-20 rounded bg-[var(--line)]" />
          </div>
          <div className="h-3 w-24 rounded bg-[var(--line)]" />
        </div>
      ))}
    </div>
  );
}

// Setup banner shown when the bot exists but its WhatsApp Business
// `phone_number_id` is empty — meaning the owner hasn't pointed Meta at
// us yet. Without this card the owner sees a "live" dashboard but the
// bot will never receive a message. The card walks them through the
// 3 things to do inside Meta Business Manager and copy-buttons the
// webhook URL so they don't fat-finger it.
function WebhookSetupCard({ activeBot }: { activeBot: ClientRow }) {
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const webhookUrl = origin ? `${origin}/api/webhook` : '/api/webhook';

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* no-op */
    }
  };

  return (
    <div
      className="rounded-[18px] mb-4"
      style={{
        padding: '20px 22px',
        background: 'color-mix(in oklab, #C8FF6E 14%, transparent)',
        border: '1px solid color-mix(in oklab, #C8FF6E 55%, transparent)',
      }}
    >
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-[12px] bg-[var(--ink)] text-[var(--background)] grid place-items-center text-[20px] flex-shrink-0">
          🔌
        </div>
        <div className="flex-1">
          <b className="text-[15px]">Connect your WhatsApp Business account to go live</b>
          <div className="text-[12.5px] text-[var(--ink-2)] mt-1">
            Your bot for <b>{activeBot.business_name}</b> is created but not yet receiving messages.
            Finish the 3-step Meta hand-off below.
          </div>

          {/* Step 1 — webhook URL */}
          <div className="mt-3 rounded-[12px] border border-[var(--line)] bg-[var(--card)] p-3">
            <div className="text-[11px] zt-mono uppercase tracking-[.08em] text-[var(--mute)] mb-1.5">
              Step 1 · Webhook URL
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[12px] bg-[var(--bg-2)] rounded px-2 py-1.5 font-mono break-all">
                {webhookUrl}
              </code>
              <button
                type="button"
                onClick={() => copy(webhookUrl)}
                className="text-[11px] px-2.5 py-1.5 rounded bg-[var(--ink)] text-[var(--background)] font-semibold hover:opacity-90"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="text-[11px] text-[var(--ink-2)] mt-1.5">
              Paste this in <b>Meta Business Suite → WhatsApp → Configuration → Callback URL</b>.
            </div>
          </div>

          {/* Step 2 — verify token */}
          <div className="mt-2 rounded-[12px] border border-[var(--line)] bg-[var(--card)] p-3">
            <div className="text-[11px] zt-mono uppercase tracking-[.08em] text-[var(--mute)] mb-1.5">
              Step 2 · Verify token
            </div>
            <div className="text-[12px] text-[var(--ink-2)]">
              Use the token your ZapText admin shared with you (the same value lives in your account&apos;s
              setup email). Paste it in <b>Verify token</b>, then hit <b>Verify and save</b>.
            </div>
          </div>

          {/* Step 3 — Phone Number ID */}
          <div className="mt-2 rounded-[12px] border border-[var(--line)] bg-[var(--card)] p-3">
            <div className="text-[11px] zt-mono uppercase tracking-[.08em] text-[var(--mute)] mb-1.5">
              Step 3 · Phone Number ID
            </div>
            <div className="text-[12px] text-[var(--ink-2)]">
              In <b>WhatsApp → API Setup</b>, copy the <b>Phone number ID</b> shown next to your number,
              then send it to your ZapText admin (or paste it on{' '}
              <Link href="/client/settings" className="border-b border-[var(--ink)] text-[var(--ink)]">
                Settings
              </Link>
              ). Without it, the bot can&apos;t reply to messages.
            </div>
          </div>

          <div className="text-[11px] text-[var(--mute)] mt-3">
            Stuck? Mail{' '}
            <a className="text-[var(--ink)] border-b border-[var(--ink)]" href="mailto:zaptextofficial@gmail.com">
              zaptextofficial@gmail.com
            </a>{' '}
            with subject <b>&quot;Webhook setup&quot;</b> &mdash; we&apos;ll walk you through it.
          </div>
        </div>
      </div>
    </div>
  );
}
