"use client";

// Mobile menu toggle is the only interactive bit on the landing nav.
// Keeping just this component as a client island lets the rest of the
// landing page render server-side.

import { useState } from "react";
import Link from "next/link";
import { Mark } from "./_shared";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const links = [
    { h: "#why-zaptext", l: "Why ZapText" },
    { h: "#how", l: "How it works" },
    { h: "#features", l: "Features" },
    { h: "#pricing", l: "Pricing" },
    { h: "#faq", l: "FAQs" },
  ];
  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--line)] bg-[color-mix(in_oklab,var(--background)_80%,transparent)] backdrop-blur-md">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-7 h-[60px] sm:h-[68px] flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2.5 font-bold text-[17px] sm:text-[18px] tracking-tight">
          <Mark />
          <span>
            ZapText
            <sup className="text-[var(--mute)] font-medium text-[10px] ml-1">.shop</sup>
          </span>
        </Link>
        <div className="hidden md:flex gap-8 text-[14px] text-[var(--ink-2)]">
          {links.map((it) => (
            <a key={it.h} href={it.h} className="opacity-75 hover:opacity-100 transition">{it.l}</a>
          ))}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link href="/sign-in" className="hidden sm:inline-flex px-3 sm:px-4 py-2 sm:py-2.5 text-[13px] sm:text-[14px] font-semibold text-[var(--ink-2)] hover:text-[var(--ink)] transition">
            Sign in
          </Link>
          <Link href="/sign-up" className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full bg-[var(--ink)] text-[var(--background)] font-semibold text-[13px] sm:text-[14px] hover:-translate-y-px transition">
            <span className="hidden sm:inline">Get started</span>
            <span className="sm:hidden">Sign up</span>
            <span aria-hidden>→</span>
          </Link>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="md:hidden w-10 h-10 inline-flex items-center justify-center rounded-md hover:bg-[var(--bg-2)]"
          >
            {open ? (
              <span className="text-[22px] leading-none">×</span>
            ) : (
              <span className="flex flex-col gap-[5px]">
                <span className="block w-5 h-[2px] bg-[var(--ink)] rounded-sm" />
                <span className="block w-5 h-[2px] bg-[var(--ink)] rounded-sm" />
                <span className="block w-5 h-[2px] bg-[var(--ink)] rounded-sm" />
              </span>
            )}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t border-[var(--line)] bg-[var(--background)]">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-7 py-3 flex flex-col">
            {links.map((it) => (
              <a
                key={it.h}
                href={it.h}
                onClick={() => setOpen(false)}
                className="py-2.5 text-[15px] text-[var(--ink-2)] hover:text-[var(--ink)] border-b border-[var(--line)] last:border-b-0"
              >
                {it.l}
              </a>
            ))}
            <Link
              href="/sign-in"
              onClick={() => setOpen(false)}
              className="py-2.5 mt-1 text-[15px] font-semibold text-[var(--ink)]"
            >
              Sign in
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
