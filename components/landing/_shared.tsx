// Pure-presentational helpers used by both the server-rendered landing
// shell and the client islands (Navbar, Pricing, PhoneChat). No hooks,
// no browser-only APIs — these components render identically on server
// and client, so the file carries no "use client" directive and can be
// safely imported from either tree.

import type React from "react";
import Link from "next/link";
import Image from "next/image";

// Brand mark — renders the full Zaptext.shop wordmark logo from
// /public/logo.png. The source PNG has heavy transparent padding
// around the bolt + wordmark — roughly 30% of the canvas is empty
// space — so the rendered box must be very large for the artwork
// itself to read at a prominent on-screen size. Callers should NOT
// render a "ZapText" text label next to <Mark/>; the image already
// contains the wordmark.
//
// `compact` prop renders a smaller variant for tighter spots like
// the footer column header.
export function Mark({ compact = false }: { compact?: boolean } = {}) {
  const h = compact ? 96 : 140;
  const w = compact ? 360 : 540;
  return (
    <Image
      src="/logo.png"
      alt="Zaptext.shop"
      width={w}
      height={h}
      priority
      sizes={compact ? '(max-width: 640px) 260px, 360px' : '(max-width: 640px) 380px, 540px'}
      style={{ width: 'auto', height: h, maxHeight: h + 4, objectFit: 'contain' }}
    />
  );
}

export function Check() {
  return (
    <span className="w-[14px] h-[14px] rounded-full bg-[var(--ink)] text-[var(--accent)] inline-grid place-items-center text-[9px]">
      ✓
    </span>
  );
}

type StickerProps = {
  className?: string;
  label: string;
  main: React.ReactNode;
  dot?: boolean;
  badge?: string;
  flag?: string;
};

export function Sticker({ className = "", label, main, dot, badge, flag }: StickerProps) {
  return (
    <div
      className={`absolute bg-[var(--card)] border border-[var(--line)] rounded-[14px] px-3.5 py-3 text-[13px] flex items-center gap-2.5 z-[3] ${className}`}
      style={{ boxShadow: "0 14px 30px -18px rgba(0,0,0,.25)" }}
    >
      {dot && <span className="w-2 h-2 rounded-full bg-[#1fae4f]" />}
      {badge && (
        <span className="w-[26px] h-[26px] rounded-full bg-[var(--accent)] grid place-items-center font-extrabold zt-mono text-[var(--accent-2)]">
          {badge}
        </span>
      )}
      {flag && <span className="text-[18px]">{flag}</span>}
      <div>
        <div className="text-[11px] text-[var(--mute)] zt-mono uppercase tracking-wide">{label}</div>
        <div>{main}</div>
      </div>
    </div>
  );
}

export function SectionHead({
  num,
  label,
  title,
  lead,
}: {
  num: string;
  label: string;
  title: React.ReactNode;
  lead: React.ReactNode;
}) {
  return (
    <div className="grid md:grid-cols-[1fr_1.8fr] gap-5 md:gap-14 items-end mb-10 md:mb-14">
      <div>
        <div className="zt-mono text-[12px] uppercase tracking-[.08em] text-[var(--mute)]">
          {`// ${num} — ${label}`}
        </div>
        <h2 className="text-[clamp(36px,4.4vw,62px)] font-bold tracking-[-0.035em] leading-[0.98] mt-3 text-balance">
          {title}
        </h2>
      </div>
      <p className="text-[18px] text-[var(--ink-2)] leading-[1.5] max-w-[540px]">{lead}</p>
    </div>
  );
}

export function FeatCard({
  span,
  variant = "default",
  label,
  title,
  children,
}: {
  span: number;
  variant?: "default" | "accent" | "ink";
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  const base = "border rounded-[22px] p-6 relative overflow-hidden flex flex-col min-h-[240px]";
  const variantCls =
    variant === "accent"
      ? "bg-[var(--accent)] text-[var(--accent-2)] border-black/10"
      : variant === "ink"
      ? "bg-[var(--ink)] text-[var(--background)] border-[var(--ink)]"
      : "bg-[var(--card)] border-[var(--line)]";
  const lblCls =
    variant === "accent"
      ? "text-[var(--accent-2)] opacity-65"
      : variant === "ink"
      ? "text-white/40"
      : "text-[var(--mute)]";
  return (
    <div
      className={`${base} ${variantCls} zt-feat-card`}
      style={{ ["--feat-span" as never]: String(span) }}
    >
      <div className={`zt-mono text-[11px] uppercase tracking-[.08em] ${lblCls}`}>{label}</div>
      <h4 className="text-[20px] sm:text-[22px] font-bold tracking-[-0.022em] mt-2 mb-1.5">{title}</h4>
      {children}
    </div>
  );
}

export function QStat({
  n,
  suffix,
  l,
  dark,
  accent,
}: {
  n: string;
  suffix: string;
  l: string;
  dark?: boolean;
  accent?: boolean;
}) {
  const bg = dark
    ? "bg-[var(--ink)] text-[var(--background)]"
    : accent
    ? "bg-[var(--accent)] text-[var(--accent-2)]"
    : "bg-[var(--background)]";
  return (
    <div className={`py-7 px-5 ${bg}`}>
      <div className="text-[52px] font-bold tracking-[-0.04em] leading-none" style={dark ? { color: "var(--accent)" } : {}}>
        {n}
        <span className="zt-serif">{suffix}</span>
      </div>
      <div className="text-[13px] mt-2.5" style={{ color: dark ? "#ffffffaa" : accent ? "#0f1405aa" : "var(--mute)" }}>
        {l}
      </div>
    </div>
  );
}

export function FootCol({ title, links }: { title: string; links: { h: string; l: string }[] }) {
  return (
    <div>
      <h5 className="zt-mono text-[11px] uppercase tracking-[.08em] text-[var(--mute)] font-medium mb-3.5">{title}</h5>
      <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
        {links.map((link) => (
          <li key={link.l}>
            <Link href={link.h} className="text-[var(--ink-2)] hover:text-[var(--ink)]">
              {link.l}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
