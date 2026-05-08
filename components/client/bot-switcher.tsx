'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClientRow, BusinessType } from '@/lib/types';

// Minimum overlay display time (ms). Even a fast switch stays visible
// for at least this long so the user sees "we registered your click"
// instead of a 200ms flash that's worse than no feedback at all.
const MIN_OVERLAY_MS = 700;

const TYPE_ICONS: Record<BusinessType, string> = {
  restaurant: '🍽️',
  coaching: '📚',
  realestate: '🏠',
  salon: '💇',
  d2c: '🛍️',
  gym: '💪',
  tiffin: '🍱',
  grocery: '🥬',
};

const TYPE_BG: Record<BusinessType, string> = {
  restaurant: 'bg-amber-100',
  coaching: 'bg-purple-100',
  realestate: 'bg-green-100',
  salon: 'bg-pink-100',
  d2c: 'bg-teal-100',
  gym: 'bg-red-100',
  tiffin: 'bg-orange-100',
  grocery: 'bg-lime-100',
};

const TYPE_LABEL: Record<BusinessType, string> = {
  restaurant: 'Restaurant',
  coaching: 'Coaching',
  realestate: 'Real Estate',
  salon: 'Salon',
  d2c: 'D2C',
  gym: 'Gym',
  tiffin: 'Tiffin',
  grocery: 'Grocery',
};

interface Props {
  bots: ClientRow[];
  activeBotId: string | null;
}

// Active bot lives prominently at top of the sidebar; the full bot list
// is hidden inside a dropdown that opens on click. Replaces the previous
// always-expanded inline list which got noisy with 3+ bots and made it
// hard to tell which bot the user was actually editing.
//
// Switch flow:
//   1. user clicks a bot in the dropdown
//   2. overlay appears immediately with destination bot name (so the UI
//      isn't visibly "frozen" during the network round-trip)
//   3. POST /api/client/switch-bot sets the active bot server-side
//   4. router.refresh() inside startTransition re-renders the layout
//   5. overlay stays visible until the transition resolves
export function BotSwitcher({ bots, activeBotId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<ClientRow | null>(null);
  const [switchStartedAt, setSwitchStartedAt] = useState<number>(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const active = bots.find((b) => b.client_id === activeBotId) || bots[0] || null;
  const showOverlay = !!switchingTo;

  // Click-outside to close. Listener is bound only while the dropdown is
  // open so we don't leak handlers on every page render.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  // Watch the activeBotId PROP — the overlay drops only when the layout
  // has actually re-rendered with the new bot. This is more reliable than
  // useTransition's isPending, which Next.js flips back to false BEFORE
  // the server roundtrip completes (causing the previous bug where the
  // overlay vanished, the page sat there briefly with stale data, then
  // suddenly switched). Plus a MIN_OVERLAY_MS floor so brief switches
  // still register visually.
  useEffect(() => {
    if (!switchingTo) return;
    if (switchingTo.client_id !== activeBotId) return; // not yet
    const elapsed = Date.now() - switchStartedAt;
    const remaining = Math.max(0, MIN_OVERLAY_MS - elapsed);
    const t = setTimeout(() => {
      setSwitchingTo(null);
      setOpen(false);
    }, remaining);
    return () => clearTimeout(t);
  }, [activeBotId, switchingTo, switchStartedAt]);

  const switchTo = async (bot: ClientRow) => {
    if (bot.client_id === activeBotId) {
      setOpen(false);
      return;
    }
    setSwitchingTo(bot); // overlay on immediately
    setSwitchStartedAt(Date.now());
    try {
      await fetch('/api/client/switch-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId: bot.client_id }),
      });
    } catch {
      // Network error — drop overlay so user can retry.
      setSwitchingTo(null);
      return;
    }
    // Trigger the layout re-fetch. The overlay-dismiss useEffect above
    // waits for activeBotId to actually flip, so the spinner stays put
    // until the new server data lands — no more "loading flash, gap,
    // then late switch" UX.
    router.refresh();
  };

  return (
    <>
      <div ref={wrapperRef} className="px-2 relative">
        {/* Active bot trigger — big, can't miss */}
        {active ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="w-full flex items-center gap-3 rounded-[12px] border transition-colors text-left"
            style={{
              padding: '10px 12px',
              background: 'color-mix(in oklab, var(--accent) 14%, transparent)',
              borderColor: 'color-mix(in oklab, var(--accent) 35%, transparent)',
            }}
            aria-haspopup="listbox"
            aria-expanded={open}
            title="Switch bot"
          >
            <div
              className={`w-10 h-10 rounded-[10px] grid place-items-center text-[20px] flex-shrink-0 ${TYPE_BG[active.type]}`}
            >
              {TYPE_ICONS[active.type]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[.08em] text-white/55">
                Editing
              </div>
              <div className="text-[14px] font-bold text-sidebar-foreground truncate leading-tight">
                {active.business_name || '(unnamed bot)'}
              </div>
              <div className="text-[10.5px] text-white/55 flex items-center gap-1.5 mt-0.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${active.status === 'active' ? 'bg-[var(--accent)] shadow-[0_0_6px_var(--accent)]' : 'bg-yellow-400'}`}
                />
                {TYPE_LABEL[active.type]} · {active.whatsapp_number || 'no number'}
              </div>
            </div>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`text-white/55 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        ) : (
          <a
            href="/client/create-bot"
            className="block w-full text-center rounded-[12px] border border-dashed border-white/20 text-white/65 text-[13px] font-semibold py-3 hover:text-white hover:border-white/40 transition-colors"
          >
            + Create your first bot
          </a>
        )}

        {/* Dropdown panel */}
        {open && active && (
          <div
            role="listbox"
            className="absolute left-2 right-2 top-full mt-1.5 z-30 rounded-[12px] border border-sidebar-border bg-[var(--sidebar)] shadow-xl overflow-hidden"
            style={{
              maxHeight: '60vh',
              overflowY: 'auto',
              boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
            }}
          >
            <div className="px-3 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-[.08em] text-white/45 flex items-center justify-between">
              <span>All bots</span>
              <span className="bg-white/10 px-1.5 py-0.5 rounded-md text-white/70">
                {bots.length}
              </span>
            </div>
            <div className="px-1.5 pb-1.5 flex flex-col gap-0.5">
              {bots.map((bot) => {
                const isActive = bot.client_id === activeBotId;
                return (
                  <button
                    key={bot.client_id}
                    type="button"
                    onClick={() => switchTo(bot)}
                    disabled={showOverlay}
                    className={`w-full flex items-center gap-2.5 rounded-[10px] text-left transition-colors ${
                      isActive ? 'bg-white/10' : 'hover:bg-white/5'
                    } disabled:opacity-50 disabled:cursor-wait`}
                    style={{ padding: '8px 10px' }}
                    role="option"
                    aria-selected={isActive}
                  >
                    <div
                      className={`w-8 h-8 rounded-[8px] grid place-items-center text-base flex-shrink-0 ${TYPE_BG[bot.type]}`}
                    >
                      {TYPE_ICONS[bot.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-sidebar-foreground truncate">
                        {bot.business_name || '(unnamed)'}
                      </div>
                      <div className="text-[10.5px] text-white/45 flex items-center gap-1.5 truncate">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${bot.status === 'active' ? 'bg-[var(--accent)]' : 'bg-yellow-400'}`}
                        />
                        {bot.whatsapp_number || 'no number'}
                      </div>
                    </div>
                    {isActive && (
                      <span className="text-[var(--accent)] text-[15px] flex-shrink-0" aria-label="active">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <a
              href="/client/create-bot"
              className="block border-t border-white/10 text-center text-[12.5px] font-semibold text-white/70 hover:text-white hover:bg-white/5 transition-colors py-2.5"
            >
              + Create new bot
            </a>
          </div>
        )}
      </div>

      {/* Switch overlay — full-screen blur with destination bot info */}
      {showOverlay && switchingTo && (
        <div
          className="fixed inset-0 z-50 grid place-items-center"
          style={{
            background: 'rgba(20, 19, 15, 0.55)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
          aria-live="polite"
          aria-busy="true"
        >
          <div
            className="rounded-[18px] border bg-[var(--card)] flex flex-col items-center text-center"
            style={{
              padding: '32px 36px',
              minWidth: 280,
              borderColor: 'color-mix(in oklab, var(--accent) 30%, transparent)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            }}
          >
            <div
              className={`w-16 h-16 rounded-[16px] grid place-items-center text-[34px] mb-4 ${TYPE_BG[switchingTo.type]}`}
            >
              {TYPE_ICONS[switchingTo.type]}
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-[.08em] text-[var(--mute)] mb-1">
              Switching to
            </div>
            <div className="text-[18px] font-bold text-foreground mb-1">
              {switchingTo.business_name || '(unnamed bot)'}
            </div>
            <div className="text-[12px] text-[var(--mute)] mb-4">
              {TYPE_LABEL[switchingTo.type]}
              {switchingTo.whatsapp_number ? ` · ${switchingTo.whatsapp_number}` : ''}
            </div>
            <div className="flex items-center gap-2 text-[12px] text-[var(--mute)]">
              <span className="inline-block w-3 h-3 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
              Loading bot data…
            </div>
          </div>
        </div>
      )}
    </>
  );
}
