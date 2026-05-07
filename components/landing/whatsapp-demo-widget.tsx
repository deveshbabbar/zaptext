'use client';

import { useState, useEffect } from 'react';

// ─── Floating "Try the live demo" widget ───
//
// Indian SMB visitors don't trust SaaS marketing copy — but they trust
// WhatsApp (their daily app). This widget gives them a one-click path
// to talk to a real ZapText bot before signing up.
//
// Click flow:
//   visitor → opens wa.me/<demo-number> in WhatsApp
//   → bot greets with vertical picker
//   → visitor picks (tiffin / salon / gym / etc.)
//   → live demo runs in their actual WhatsApp
//   → trust earned, signup converts 3-5x higher
//
// Number resolution (priority):
//   1. /api/public/demo-bot — server queries the DB for the active
//      demo bot (founder's gym bot today) and returns the number. Lets
//      operator change the demo bot without redeploys.
//   2. NEXT_PUBLIC_DEMO_BOT_NUMBER env — hardcoded fallback (staging,
//      DB down, etc.).
//   3. Hide widget — no broken link ever rendered.

const ENV_FALLBACK = (process.env.NEXT_PUBLIC_DEMO_BOT_NUMBER || '').replace(/\D/g, '');
const PREFILL_MESSAGE = encodeURIComponent(
  "Hi! I'm checking out ZapText. Show me a demo of what you can do."
);

export function WhatsAppDemoWidget() {
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState<string>(
    ENV_FALLBACK.length >= 10 ? ENV_FALLBACK : ''
  );

  // Fetch the live demo bot number on mount. The server route picks
  // the founder's currently-active gym bot by default, so the widget
  // automatically points at whichever bot is live without redeploys.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/public/demo-bot')
      .then((r) => r.json())
      .then((data: { number?: string | null }) => {
        if (cancelled) return;
        const n = (data?.number || '').replace(/\D/g, '');
        if (n.length >= 10) setNumber(n);
      })
      .catch(() => {
        // Stay on env fallback — no UI surface for the error.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Hide entirely when no demo number is available — better than a
  // broken wa.me link that destroys trust.
  if (!number || number.length < 10) return null;

  const waUrl = `https://wa.me/${number}?text=${PREFILL_MESSAGE}`;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2.5">
      {/* Expanded card */}
      {open && (
        <div
          className="bg-[var(--background)] border border-[var(--line)] rounded-[16px] shadow-2xl overflow-hidden"
          style={{ width: 320 }}
        >
          <div
            className="bg-[var(--ink)] text-[var(--background)] flex items-start justify-between"
            style={{ padding: '16px 18px' }}
          >
            <div>
              <div className="zt-mono text-[10.5px] uppercase tracking-[.1em] text-[var(--accent)] mb-0.5">
                Live demo
              </div>
              <div className="font-semibold text-[15px]">Try ZapText on WhatsApp</div>
              <div className="text-[12px] text-white/65 mt-0.5">No signup. Real bot. 30 seconds.</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/60 hover:text-white text-[18px] leading-none"
              aria-label="Close demo widget"
            >
              ×
            </button>
          </div>
          <div style={{ padding: 18 }}>
            <p className="text-[13px] text-[var(--ink-2)] m-0 mb-3.5 leading-[1.55]">
              Open WhatsApp, send a message in any language (Hindi/English/Hinglish), and watch
              our bot reply like a real assistant — handling bookings, menus, payments and more.
            </p>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-full rounded-[10px] bg-[#25D366] text-white font-semibold text-[14px] gap-2 hover:-translate-y-px transition"
              style={{ padding: '12px 18px' }}
            >
              <span aria-hidden="true">💬</span>
              Open WhatsApp →
            </a>
            <div className="text-[10.5px] text-[var(--mute)] text-center mt-2.5">
              Goes to wa.me/{number.slice(0, 2)}•••••{number.slice(-3)}
            </div>
          </div>
        </div>
      )}

      {/* FAB toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-full font-semibold text-[14px] shadow-2xl hover:-translate-y-px transition flex items-center gap-2.5"
        style={{
          background: open ? 'var(--ink)' : '#25D366',
          color: open ? 'var(--background)' : '#fff',
          padding: '14px 22px',
        }}
        aria-label={open ? 'Close demo widget' : 'Try live WhatsApp demo'}
      >
        {open ? (
          <>Hide demo</>
        ) : (
          <>
            <span aria-hidden="true" className="text-[16px]">💬</span>
            <span>Try the live demo</span>
          </>
        )}
      </button>
    </div>
  );
}
