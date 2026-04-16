'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ClientRow } from '@/lib/types';

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
  const [showActivationBanner, setShowActivationBanner] = useState(false);

  // Show 48hr activation banner for newly created bots
  useEffect(() => {
    if (searchParams.get('activated') === 'pending') {
      setShowActivationBanner(true);
    }
    // Also show if bot was created within last 48 hours
    if (activeBot.created_at) {
      const createdAt = new Date(activeBot.created_at);
      const now = new Date();
      const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceCreation < 48) {
        setShowActivationBanner(true);
      }
    }
  }, [searchParams, activeBot.created_at]);

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

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">
            Namaste, {userName} 👋
          </h1>
          <div className="text-muted-foreground text-sm mt-1">
            {today} · {stats?.todayBookings ?? 0} bookings today
          </div>
        </div>
        <div className="flex gap-2.5">
          <button className="bg-card border border-border px-3.5 py-2.5 rounded-xl text-[13px] font-semibold flex items-center gap-1.5 hover:border-primary/50 transition-colors">
            🔗 Share Bot Link
          </button>
          <a
            href="/client/create-bot"
            className="bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-[13px] font-semibold flex items-center gap-1.5 hover:bg-primary/90 transition-colors"
          >
            + New Bot
          </a>
        </div>
      </div>

      {showActivationBanner && (
        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-2xl p-5 mb-5 flex items-start gap-4">
          <div className="text-3xl">⏳</div>
          <div className="flex-1">
            <h3 className="font-bold text-foreground text-[15px] mb-1">Bot Activation In Progress</h3>
            <p className="text-sm text-muted-foreground">
              Your AI bot for <strong>{activeBot.business_name}</strong> is being set up.
              It will take <strong>up to 48 hours</strong> to fully activate your WhatsApp AI bot.
              We&apos;ll notify you once it&apos;s live and ready to handle customer conversations!
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-amber-600">Activation pending...</span>
            </div>
          </div>
          <button
            onClick={() => setShowActivationBanner(false)}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {allBotsCount > 1 && (
        <div className="bg-gradient-to-br from-accent/10 to-background border border-dashed border-accent/30 rounded-xl p-3.5 flex items-center gap-3 mb-5">
          <div className="text-2xl">✨</div>
          <div className="flex-1 text-xs text-foreground">
            <strong>Managing {allBotsCount} bots</strong> — currently viewing <strong>{activeBot.business_name}</strong>.
          </div>
          <a href="/client/bots" className="text-primary font-semibold text-xs hover:underline">View all bots →</a>
        </div>
      )}

      <div className="relative overflow-hidden bg-gradient-to-br from-sidebar to-primary rounded-2xl p-6 mb-5 text-sidebar-foreground grid grid-cols-[1fr_auto] gap-5 items-center">
        <div className="absolute text-[180px] -right-8 -top-5 opacity-[0.08] select-none pointer-events-none">{icon}</div>
        <div className="relative">
          <div className="text-[11px] uppercase tracking-wider text-accent mb-2 font-semibold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-accent rounded-full shadow-[0_0_8px_var(--accent)]" />
            {icon} {activeBot.business_name.toUpperCase()} — LIVE
          </div>
          <h2 className="text-[22px] font-bold mb-1">Customers can chat 24/7</h2>
          <p className="text-sidebar-foreground/70 text-[13px]">
            Your AI has handled {stats?.totalMessages ?? 0} messages total.
          </p>
        </div>
        <div className="bg-sidebar-foreground/10 px-[18px] py-3.5 rounded-xl font-mono text-sm flex items-center gap-2.5 relative">
          <span>📱</span>
          <span>{activeBot.whatsapp_number || 'Pending setup'}</span>
          <button onClick={copyNumber} className="text-accent text-xs font-semibold ml-1">
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3.5 mb-5">
        <StatCard label="Today's Bookings" value={stats?.todayBookings ?? 0} icon="📅" />
        <StatCard label="Total Messages" value={stats?.totalMessages ?? 0} icon="💬" />
        <StatCard label="Unique Customers" value={stats?.uniqueCustomers ?? 0} icon="👥" />
        <StatCard label="Avg Response" value="2.1s" icon="⚡" subtitle="Instant replies" />
      </div>

      <div className="grid grid-cols-[1.4fr_1fr] gap-4">
        <Panel title="Today's Schedule" link="/client/calendar" linkText="View calendar →">
          {todayBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bookings today</p>
          ) : (
            <div className="space-y-2">
              {todayBookings.map((b, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <div className="text-[12px] font-bold text-primary w-14">{b.time_slot}</div>
                  <div className="flex-1 text-[13px]">
                    <div className="font-semibold">{b.customer_name}</div>
                    <div className="text-[11px] text-muted-foreground">{b.service || 'General'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Recent Conversations" link="/client/conversations" linkText="View all →">
          <p className="text-sm text-muted-foreground">Click &quot;View all&quot; to see all conversations.</p>
        </Panel>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, subtitle }: { label: string; value: string | number; icon: string; subtitle?: string }) {
  return (
    <div className="relative bg-card border border-border rounded-2xl p-[18px]">
      <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-2.5">{label}</div>
      <div className="text-[28px] font-bold tracking-tight text-foreground">{value}</div>
      {subtitle && <div className="text-[11px] font-semibold text-primary mt-1">{subtitle}</div>}
      <div className="absolute top-[18px] right-[18px] w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-sm">{icon}</div>
    </div>
  );
}

function Panel({ title, link, linkText, children }: { title: string; link?: string; linkText?: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[15px] font-bold text-foreground">{title}</div>
        {link && linkText && (
          <a href={link} className="text-xs text-primary font-semibold hover:underline">{linkText}</a>
        )}
      </div>
      {children}
    </div>
  );
}
