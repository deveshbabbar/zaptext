"use client";

// Pricing client island. The duration toggle (1M / 6M / 12M) recomputes
// the per-month rate on the client without a round-trip. Everything
// else on this page is server-rendered now; this is one of three
// remaining client islands.

import { useState } from "react";
import Link from "next/link";
import { PLANS, DURATIONS, type DurationKey } from "@/lib/plans";
import { SectionHead } from "./_shared";

const PLAN_ORDER: Array<{ key: keyof typeof PLANS; tag: string }> = [
  { key: "trial", tag: "Try without paying" },
  { key: "starter", tag: "Solo shops, 1 number" },
  { key: "growth", tag: "Multi-location · most popular" },
  { key: "scale", tag: "Multi-bot · API access" },
  { key: "enterprise", tag: "Chains · white-label · SLA" },
];

export function PricingSection() {
  const [duration, setDuration] = useState<DurationKey>(1);
  return (
    <section id="pricing" className="py-14 md:py-[110px] bg-[var(--bg-2)] border-y border-[var(--line)]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-7">
        <SectionHead
          num="04"
          label="Pricing"
          title={
            <>
              Pay for <span className="zt-serif">bots.</span>
              <br />
              Not for promises.
            </>
          }
          lead="Launch offer — setup fees waived on every plan. Includes WhatsApp Business API, hosting, model inference, and dashboard. Cancel anytime."
        />
        <div className="flex items-center justify-between gap-4 flex-wrap mb-7">
          <div className="inline-flex p-1 rounded-full bg-[var(--card)] border border-[var(--line)] text-[13px]">
            {(Object.keys(DURATIONS) as unknown as DurationKey[]).map((m) => {
              const months = Number(m) as DurationKey;
              const active = duration === months;
              const label = months === 1 ? "Monthly" : months === 6 ? "6 months" : "Annual";
              return (
                <button
                  key={m}
                  onClick={() => setDuration(months)}
                  className={`rounded-full font-medium inline-flex items-center gap-1.5 ${active ? "bg-[var(--ink)] text-[var(--background)]" : "text-[var(--ink-2)]"}`}
                  style={{ padding: "9px 18px" }}
                >
                  {label}
                  {DURATIONS[months].savingLabel && (
                    <span
                      className={`ml-1 px-2 py-[2px] rounded-full zt-mono text-[10px] font-bold ${active ? "bg-[var(--accent)] text-[var(--accent-2)]" : "bg-[var(--accent)]/20 text-[var(--ink)]"}`}
                    >
                      {DURATIONS[months].savingLabel}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="zt-mono text-[12px] text-[var(--mute)]">
            All prices in ₹INR · GST extra · billed on razorpay
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {PLAN_ORDER.map(({ key, tag }) => {
            const p = PLANS[key];
            const popular = key === "growth";
            const isFree = key === "trial";
            const price = Math.round((p.price * DURATIONS[duration].multiplier) / duration);
            return (
              <div
                key={key}
                className={`rounded-[22px] border flex flex-col relative transition hover:-translate-y-0.5 ${
                  popular ? "bg-[var(--ink)] text-[var(--background)] border-[var(--ink)]" : "bg-[var(--card)] border-[var(--line)]"
                }`}
                style={{ padding: "24px 22px" }}
              >
                {popular && (
                  <div className="absolute -top-2.5 right-5 bg-[var(--accent)] text-[var(--accent-2)] zt-mono text-[11px] font-bold px-2.5 py-[5px] rounded-full tracking-wide">
                    Most popular
                  </div>
                )}
                <div className={`text-[14px] font-semibold uppercase tracking-[.06em] ${popular ? "text-[var(--accent)]" : "text-[var(--ink-2)]"}`}>
                  {p.name}
                </div>
                <div className="text-[12.5px] mt-0.5" style={{ color: popular ? "#ffffff99" : "var(--mute)" }}>
                  {tag}
                </div>
                <div className="mt-3.5 flex items-baseline gap-1.5">
                  {isFree ? (
                    <>
                      <span className="text-[54px] font-bold tracking-[-0.045em] leading-none">Free</span>
                      <span className="text-[13px]" style={{ color: popular ? "#ffffff88" : "var(--mute)" }}>
                        / forever
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-[54px] font-bold tracking-[-0.045em] leading-none">
                        <span className="zt-serif text-[0.7em] mr-0.5">₹</span>
                        {price.toLocaleString("en-IN")}
                      </span>
                      <span className="text-[13px]" style={{ color: popular ? "#ffffff88" : "var(--mute)" }}>
                        / mo{duration === 12 ? " · billed yearly" : duration === 6 ? " · billed 6-monthly" : ""}
                      </span>
                    </>
                  )}
                </div>
                <div className="text-[12.5px] mb-5" style={{ color: popular ? "#ffffffcc" : "var(--ink-2)" }}>
                  {isFree ? (
                    <span style={{ color: "var(--mute)" }}>No card required · upgrade anytime</span>
                  ) : (
                    <>
                      Setup:{" "}
                      <b className={`${popular ? "text-[var(--accent-2)]" : "text-[var(--ink)]"} bg-[var(--accent)] px-1.5 rounded-[4px] font-bold`}>
                        FREE
                      </b>{" "}
                      <s className="opacity-50">₹{p.originalSetupFee.toLocaleString("en-IN")}</s> · launch offer
                    </>
                  )}
                </div>
                <ul className="flex flex-col gap-2.5 flex-1 mb-5">
                  {p.featureList.map((f, i) => (
                    <li key={i} className={`flex gap-2 text-[14px] leading-[1.4] ${popular ? "text-white/80" : "text-[var(--ink-2)]"}`}>
                      <span className={`zt-mono flex-shrink-0 ${popular ? "text-[var(--accent)]" : "text-[var(--ink)]"}`}>→</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/sign-up"
                  className={`block text-center py-3.5 rounded-[12px] font-semibold text-[14px] border ${
                    popular
                      ? "bg-[var(--accent)] text-[var(--accent-2)] border-[var(--accent)] hover:bg-white"
                      : "border-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--background)]"
                  } transition`}
                >
                  {isFree ? "Start free →" : `Start ${p.name} →`}
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
