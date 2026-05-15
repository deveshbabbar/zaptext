'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

interface Props {
  aside: ReactNode;
  children: ReactNode;
  brandSub?: string;
}

// Mobile-first dashboard shell. On md+ the sidebar is a static column,
// on smaller screens it becomes an off-canvas drawer toggled by a top
// hamburger. The dark sidebar styling is preserved as-is — we just
// wrap it in a fixed/translate container and add a topbar.
export function AppShell({ aside, children, brandSub = 'Workspace' }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Auto-close drawer when route changes (after a nav link tap).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while drawer is open on mobile.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    if (open) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="flex h-[100dvh] relative overflow-hidden">
      {/* Mobile topbar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center justify-between px-2 bg-[var(--sidebar)] text-[var(--sidebar-foreground)] border-b border-white/10">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          className="w-10 h-10 inline-flex items-center justify-center rounded-md hover:bg-white/10 active:bg-white/15"
        >
          {open ? (
            <span className="text-[22px] leading-none">×</span>
          ) : (
            <span className="flex flex-col gap-[5px]">
              <span className="block w-5 h-[2px] bg-current rounded-sm" />
              <span className="block w-5 h-[2px] bg-current rounded-sm" />
              <span className="block w-5 h-[2px] bg-current rounded-sm" />
            </span>
          )}
        </button>
        <span className="flex items-center gap-2 font-bold text-[15px] tracking-[-0.01em]">
          <span className="w-7 h-7 rounded-[6px] bg-[var(--accent)] text-[var(--accent-2)] grid place-items-center zt-mono font-extrabold text-[14px]">
            Z
          </span>
          <span>
            ZapText
            <span className="text-white/55 zt-mono uppercase tracking-[.08em] ml-1.5 text-[10px]">
              {brandSub}
            </span>
          </span>
        </span>
        <span className="w-10" aria-hidden />
      </header>

      {/* Backdrop */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar — fixed/drawer on mobile, static column on md+ */}
      <div
        className={[
          'fixed md:static z-50 inset-y-0 left-0',
          'w-[268px] max-w-[85vw] flex',
          'transform transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        {aside}
      </div>

      <main className="flex-1 overflow-auto bg-background min-w-0 pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
