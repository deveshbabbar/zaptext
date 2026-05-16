// Route-level loading state for every page under /client/*.
//
// Next.js App Router renders this automatically while a route segment
// is fetching its server data, then swaps in the real page when ready.
// The sidebar layout persists across the transition (layout.tsx is
// preserved); only the children slot swaps to this component.
//
// Two visual cues so the user always knows their click registered:
//   1. A thin animated progress bar pinned to the top edge of the
//      viewport (above the sidebar AND the main column) — same NProgress
//      pattern Vercel / Stripe / Linear use.
//   2. A centred sage spinner + label in the main content area so the
//      blank space doesn't read as "broken".

export default function ClientLoading() {
  return (
    <>
      <style>{`
        @keyframes zt-progress {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(-15%); }
          100% { transform: translateX(110%); }
        }
        @keyframes zt-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes zt-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      {/* Top-edge progress bar — always visible during transition.
          zIndex: 9999 sits above the sidebar (z-50) and the bot-switcher
          overlay (z-50) so it's never hidden by other UI. */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          zIndex: 9999,
          height: 3,
          background: 'rgba(0,0,0,.06)',
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            height: '100%',
            width: '40%',
            background: 'var(--accent, #5C7A4F)',
            borderRadius: 99,
            animation: 'zt-progress 1.15s cubic-bezier(.4,0,.2,1) infinite',
          }}
        />
      </div>

      {/* Centred spinner in the main column. Animates in slightly so
          a sub-100ms transition doesn't flash this — only stays visible
          when the page actually takes time to fetch. */}
      <div
        role="status"
        aria-live="polite"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: 14,
          animation: 'zt-fade-in 180ms ease-out 80ms both',
        }}
      >
        <div
          aria-hidden
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            border: '2.5px solid color-mix(in oklab, var(--accent, #5C7A4F) 22%, transparent)',
            borderTopColor: 'var(--accent, #5C7A4F)',
            animation: 'zt-spin 720ms linear infinite',
          }}
        />
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--mute, #6B7068)',
            letterSpacing: '.02em',
          }}
        >
          Loading…
        </div>
      </div>
    </>
  );
}
