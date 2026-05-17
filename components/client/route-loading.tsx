// Shared route-loading UI for every loading.tsx under /client/*.
//
// Why this lives as a component (not just inline in each loading.tsx):
//
// Next.js 16 only renders a loading.tsx if the navigation's entry point
// is at or above that file. From the instant-navigation guide:
//
//   "On a client navigation from /shop/shoes to /shop/hats, the shared
//    /shop layout is the entry point. The root <Suspense> boundary is
//    above that layout, so it is invisible to this navigation."
//   — node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md
//
// app/client/loading.tsx catches navigations entering /client/*, but NOT
// sibling navigations under /client/restaurant/*, /client/gym/*, etc.
// — each of those segments has its own layout, which becomes the entry
// point for inner navigations, and the parent loading.tsx is invisible
// to them. So every vertical (restaurant, gym, coaching, salon,
// realestate, tiffin, ecommerce) needs its own loading.tsx next to its
// layout.tsx — they all re-export this component to keep one source of
// truth for the visual.
//
// The UI itself is the same as before:
//   1. A thin animated progress bar pinned to the top edge (NProgress
//      pattern — same as Vercel / Stripe / Linear).
//   2. A centred sage spinner in the main content area, fading in after
//      80ms so a sub-100ms transition doesn't flash it.

export function RouteLoading() {
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

      {/* Top-edge progress bar — visible the whole time this Suspense
          fallback is mounted. zIndex 9999 sits above the sidebar (z-50)
          and the bot-switcher overlay (z-9998) so chained navigations
          never hide it. */}
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

      {/* Centred spinner in the main column. Animates in slightly so a
          sub-100ms transition doesn't flash it — visible only when the
          page actually takes time to fetch. */}
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
