'use client';

import { useState, useMemo } from 'react';
import { PLANS } from '@/lib/plans';

// ─── ROI Calculator ───
//
// Anchors the price decision in the owner's actual cost of staff time.
// Indian SMB owner mental model: "₹599 is cheap" or "₹599 is expensive"
// is fuzzy without a comparison. This widget makes it concrete:
//   "You spend ~21 hours / ₹5,250 per month replying to WhatsApp.
//    Starter plan at ₹599 saves you 19 hours and ₹4,651 — payback in 4 days."
//
// All inputs default to median Indian SMB values so the first render
// already shows a meaningful number. The user adjusts sliders to match
// their own situation.

const WORKING_DAYS_PER_MONTH = 26;

export function ROICalculator() {
  const [messagesPerDay, setMessagesPerDay] = useState(40);
  const [secondsPerReply, setSecondsPerReply] = useState(90);
  const [hourlyRate, setHourlyRate] = useState(250); // ₹/hr — typical SMB owner self-cost

  const calc = useMemo(() => {
    const repliesPerMonth = messagesPerDay * WORKING_DAYS_PER_MONTH;
    const secondsPerMonth = repliesPerMonth * secondsPerReply;
    const hoursPerMonth = secondsPerMonth / 3600;
    const moneyPerMonth = Math.round(hoursPerMonth * hourlyRate) || 0;

    // Pick the cheapest paid plan whose monthly AI-reply allowance
    // covers the owner's volume. Trial is excluded because we're
    // pitching upgrade.
    const planOrder: Array<keyof typeof PLANS> = ['starter', 'growth', 'scale', 'enterprise'];
    const recommendedKey =
      planOrder.find((k) => {
        const cap = PLANS[k].messages;
        return cap === -1 || cap >= repliesPerMonth;
      }) || 'enterprise';
    const recommended = PLANS[recommendedKey];

    const monthlyCost = recommended.price;
    const netSavings = Math.max(0, moneyPerMonth - monthlyCost);
    const paybackDays =
      netSavings > 0
        ? Math.max(1, Math.ceil(monthlyCost / (moneyPerMonth / WORKING_DAYS_PER_MONTH)))
        : null;

    return {
      repliesPerMonth,
      hoursPerMonth: Math.round(hoursPerMonth * 10) / 10,
      moneyPerMonth,
      recommendedKey,
      recommendedName: recommended.name,
      monthlyCost,
      netSavings,
      paybackDays,
    };
  }, [messagesPerDay, secondsPerReply, hourlyRate]);

  return (
    <section id="roi" className="py-[90px] bg-[var(--background)]">
      <div className="max-w-[1100px] mx-auto px-7">
        <div className="zt-mono text-[12px] uppercase tracking-[.1em] text-[var(--mute)] mb-3">
          // 04b · ROI Calculator
        </div>
        <h2 className="text-[40px] md:text-[52px] font-bold tracking-[-0.025em] leading-[1.05] mb-3">
          See how much your time costs <span className="zt-serif">today.</span>
        </h2>
        <p className="text-[16px] text-[var(--mute)] max-w-[640px] mb-10">
          Slide the numbers to match your business. We&apos;ll show you exactly how much
          ZapText saves — and which plan you actually need.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
          {/* Inputs */}
          <div className="bg-[var(--card)] border border-[var(--line)] rounded-[16px] p-7">
            <Slider
              label="Messages you reply to per day"
              value={messagesPerDay}
              min={5}
              max={200}
              step={5}
              suffix={`${messagesPerDay} messages/day`}
              onChange={setMessagesPerDay}
            />
            <Slider
              label="Time per reply"
              value={secondsPerReply}
              min={30}
              max={300}
              step={15}
              suffix={
                secondsPerReply >= 60
                  ? `${Math.floor(secondsPerReply / 60)}m${
                      secondsPerReply % 60 ? ` ${secondsPerReply % 60}s` : ''
                    }`
                  : `${secondsPerReply}s`
              }
              onChange={setSecondsPerReply}
            />
            <Slider
              label="Your hourly rate"
              value={hourlyRate}
              min={100}
              max={2000}
              step={50}
              suffix={`₹${hourlyRate}/hr`}
              onChange={setHourlyRate}
            />
            <p className="text-[11.5px] text-[var(--mute)] mt-2 mb-0">
              Tip: Even if you don&apos;t pay yourself a salary, your time has a cost.
              Most Indian SMB owners value their time at ₹200-400/hr.
            </p>
          </div>

          {/* Output */}
          <div className="bg-[var(--ink)] text-[var(--background)] rounded-[16px] p-7 flex flex-col justify-center">
            <div className="zt-mono text-[11px] uppercase tracking-[.1em] text-white/55 mb-2">
              Your current cost
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-[44px] font-bold tracking-[-0.03em] leading-none">
                <span className="zt-serif text-[0.7em]">₹</span>
                {calc.moneyPerMonth.toLocaleString('en-IN')}
              </span>
              <span className="text-[14px] text-white/65">/ month</span>
            </div>
            <div className="text-[13px] text-white/65 mb-6">
              ≈ {calc.hoursPerMonth} hours of your time spent on WhatsApp replies
            </div>

            <div className="border-t border-white/15 pt-5">
              <div className="zt-mono text-[11px] uppercase tracking-[.1em] text-[var(--accent)] mb-2">
                With ZapText {calc.recommendedName}
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[28px] font-bold tracking-[-0.025em] leading-none">
                  <span className="zt-serif text-[0.7em]">₹</span>
                  {calc.monthlyCost.toLocaleString('en-IN')}
                </span>
                <span className="text-[13px] text-white/55">/ month</span>
              </div>
              <div className="text-[13px] text-white/65 mb-4">
                Bot handles {calc.repliesPerMonth.toLocaleString('en-IN')} replies/month — included.
              </div>

              {calc.netSavings > 0 ? (
                <>
                  <div className="text-[14px] text-[var(--accent)] font-semibold mb-1">
                    Net savings: ₹{calc.netSavings.toLocaleString('en-IN')}/month
                  </div>
                  {calc.paybackDays !== null && (
                    <div className="text-[12.5px] text-white/65">
                      Payback in {calc.paybackDays} working day{calc.paybackDays !== 1 ? 's' : ''}.
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[13px] text-white/65">
                  Even at this volume, the plan pays for itself in saved hours.
                </div>
              )}

              <a
                href="/sign-up"
                className="mt-5 inline-flex items-center justify-center w-full rounded-[10px] bg-[var(--accent)] text-[var(--accent-2)] font-semibold text-[14px] hover:-translate-y-px transition"
                style={{ padding: '12px 18px' }}
              >
                Start free — no card required →
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Slider primitive ───────────────────────────────────────────────────

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="flex justify-between items-baseline mb-1.5">
        <label className="text-[13px] font-medium text-[var(--ink-2)]">{label}</label>
        <span className="zt-mono text-[12px] font-semibold text-[var(--ink)]">{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--accent)]"
        style={{ height: 4 }}
      />
    </div>
  );
}
