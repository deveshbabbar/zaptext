'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ClientRow } from '@/lib/types';
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
          title={
            isPending
              ? 'Bot under review.'
              : <>Customers can chat <span className="zt-serif">24/7</span>, boss.</>
          }
          desc={
            isPending
              ? 'Our team is setting up your bot. It will be activated within 48 hours.'
              : <>Your AI handled <b style={{ color: '#fff' }}>{stats?.totalMessages ?? 0}</b> messages total.</>
          }
          emoji={icon}
          chip={
            <NumChip onCopy={activeBot.whatsapp_number ? copyNumber : undefined} copied={copied}>
              📱 {activeBot.whatsapp_number || 'Pending setup'}
            </NumChip>
          }
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
          <StatCard emoji="📅" label="Today's bookings" value={stats?.todayBookings ?? 0} />
          <StatCard emoji="💬" label="Messages total" value={stats?.totalMessages ?? 0} />
          <StatCard emoji="👥" label="Unique customers" value={stats?.uniqueCustomers ?? 0} />
          <StatCard emoji="⚡" label="Avg response" value="2.1s" sub="Instant replies" />
        </div>

        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-3.5">
          <Panel
            title="Today's schedule"
            sub={todayBookings.length === 0 ? 'No bookings yet today' : `${todayBookings.length} booked`}
            action={
              <Link href="/client/calendar" className="text-[var(--ink)]">
                View calendar →
              </Link>
            }
          >
            {todayBookings.length === 0 ? (
              <p className="text-[13px] text-[var(--mute)] m-0">Nothing scheduled today.</p>
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
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
