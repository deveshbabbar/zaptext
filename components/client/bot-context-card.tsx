'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ClientRow, BusinessType } from '@/lib/types';

const TYPE_ICONS: Record<BusinessType, string> = {
  restaurant: '🍽️',
  coaching: '📚',
  realestate: '🏠',
  salon: '💇',
  d2c: '🛍️',
  gym: '💪',
};

const TYPE_BG: Record<BusinessType, string> = {
  restaurant: 'bg-amber-100',
  coaching: 'bg-purple-100',
  realestate: 'bg-green-100',
  salon: 'bg-pink-100',
  d2c: 'bg-teal-100',
  gym: 'bg-red-100',
};

const TYPE_LABEL: Record<BusinessType, string> = {
  restaurant: 'Restaurant',
  coaching: 'Coaching',
  realestate: 'Real Estate',
  salon: 'Salon',
  d2c: 'D2C',
  gym: 'Gym',
};

export interface SubInfo {
  hasActive: boolean;
  planName: string | null;
  daysRemaining: number;
  expiryWarning: boolean;
}

interface Props {
  activeBot: ClientRow;
  multiBot: boolean;
  sub: SubInfo;
}

// Sticky top-of-main bot context card. Replaces the inline server-side
// bar so we can attach the Pause/Resume button (needs onClick) and a
// loading state during the toggle. Sub mini-progress is shown inline so
// owners see plan health at a glance without leaving the page.
export function BotContextCard({ activeBot, multiBot, sub }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActive = activeBot.status === 'active';
  const isPaused = activeBot.status === 'paused';
  const togglable = isActive || isPaused;

  const togglePause = async () => {
    if (!togglable) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/client/pause-toggle', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || data.error || 'Failed');
        setBusy(false);
        return;
      }
      // Server-side status changed → refresh the layout so this very
      // component re-renders with the new ClientRow.status.
      startTransition(() => router.refresh());
    } catch {
      setError('Network error');
      setBusy(false);
    }
  };

  // Drop the local busy flag once the layout-refresh transition lands.
  // (Status will already reflect the new value because we re-render on
  // fresh props.)
  if (!isPending && busy) {
    queueMicrotask(() => setBusy(false));
  }

  const subPillBg = sub.hasActive
    ? sub.expiryWarning
      ? 'color-mix(in oklab, #ef4444 14%, transparent)'
      : 'color-mix(in oklab, var(--accent) 14%, transparent)'
    : 'color-mix(in oklab, #E89A1C 14%, transparent)';
  const subPillBorder = sub.hasActive
    ? sub.expiryWarning
      ? 'color-mix(in oklab, #ef4444 35%, transparent)'
      : 'color-mix(in oklab, var(--accent) 30%, transparent)'
    : 'color-mix(in oklab, #E89A1C 40%, transparent)';
  const subPillText = sub.hasActive
    ? sub.expiryWarning
      ? 'text-red-600 dark:text-red-400'
      : 'text-foreground'
    : 'text-[#E89A1C]';

  return (
    <div
      className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--card)]/95 backdrop-blur flex items-center gap-3 flex-wrap"
      style={{ padding: '12px 24px' }}
    >
      <div
        className={`w-11 h-11 rounded-[12px] grid place-items-center text-[22px] flex-shrink-0 ${TYPE_BG[activeBot.type] || 'bg-gray-100'}`}
        aria-hidden="true"
      >
        {TYPE_ICONS[activeBot.type] || '🤖'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-[.08em] text-[var(--mute)]">
            Now editing
          </span>
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[.05em] px-1.5 py-0.5 rounded-full ${
              isActive
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                : isPaused
                  ? 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400'
                  : 'bg-gray-500/15 text-gray-600 dark:text-gray-400'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isActive ? 'bg-emerald-500' : isPaused ? 'bg-yellow-500' : 'bg-gray-400'
              }`}
            />
            {activeBot.status}
          </span>
        </div>
        <div className="text-[16px] font-bold text-foreground leading-tight truncate">
          {activeBot.business_name || '(unnamed bot)'}
        </div>
        <div className="text-[12px] text-[var(--mute)] mt-0.5 truncate">
          {TYPE_LABEL[activeBot.type] || activeBot.type}
          {activeBot.whatsapp_number ? ` · ${activeBot.whatsapp_number}` : ''}
        </div>
      </div>

      {/* Sub mini-progress — clickable, jumps to /client/subscription */}
      <Link
        href="/client/subscription"
        className={`hidden sm:flex items-center gap-2 rounded-full border text-[11.5px] font-semibold transition-opacity hover:opacity-80 ${subPillText}`}
        style={{
          padding: '6px 12px',
          background: subPillBg,
          borderColor: subPillBorder,
        }}
        title={sub.hasActive ? 'View subscription' : 'Subscribe to a plan'}
      >
        {sub.hasActive ? (
          <>
            <span>💳</span>
            <span>{sub.planName}</span>
            <span className="text-[var(--mute)] font-normal">·</span>
            <span>
              {sub.daysRemaining} day{sub.daysRemaining === 1 ? '' : 's'} left
            </span>
          </>
        ) : (
          <>
            <span>⚠️</span>
            <span>No active plan</span>
          </>
        )}
      </Link>

      {/* Pause / Resume — only available when status is active or paused */}
      {togglable && (
        <button
          type="button"
          onClick={togglePause}
          disabled={busy || isPending}
          className={`rounded-full border text-[11.5px] font-semibold transition-all disabled:opacity-50 disabled:cursor-wait ${
            isActive
              ? 'border-yellow-500/40 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/10'
              : 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10'
          }`}
          style={{ padding: '6px 12px' }}
          title={isActive ? 'Pause this bot — customers will see "temporarily offline"' : 'Resume — bot will reply to customers again'}
        >
          {busy || isPending ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
              {isActive ? 'Pausing…' : 'Resuming…'}
            </span>
          ) : isActive ? (
            <>⏸ Pause bot</>
          ) : (
            <>▶ Resume bot</>
          )}
        </button>
      )}

      {multiBot && (
        <span className="hidden md:inline-block text-[11px] text-[var(--mute)] flex-shrink-0">
          Switch from sidebar ↖
        </span>
      )}

      {error && (
        <span className="basis-full text-[11.5px] text-red-500 font-semibold">
          {error}
        </span>
      )}
    </div>
  );
}
