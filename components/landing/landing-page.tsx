"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PLANS, DURATIONS, type DurationKey } from "@/lib/plans";
import { ROICalculator } from "@/components/landing/roi-calculator";
import { WhatsAppDemoWidget } from "@/components/landing/whatsapp-demo-widget";
import { ReferralCapture } from "@/components/landing/referral-capture";

// ─────────────────────────── DATA ───────────────────────────

type ChatMsg = { who: "in" | "out"; t: string; time?: string; typing?: boolean };
// Restaurant-only landing for now. Other verticals (salon / coaching /
// gym / realestate / tiffin / grocery / ecommerce) will be re-added
// once each vertical is shipped end-to-end. Keeping the type narrowed
// to a single key keeps every downstream component (PhoneChat) honest.
type BizKey = "restaurant";
type Biz = {
  emoji: string;
  label: string;
  name?: string;
  avatar?: string;
  tagline: string;
  longDesc: string;
  stats: { n: string; l: string }[];
  faqs: { q: string }[];
  chat: ChatMsg[];
};

const BIZ: Record<BizKey, Biz> = {
  restaurant: {
    emoji: "🍽️",
    label: "Restaurant",
    name: "Rohit's Biryani · Bot",
    avatar: "R",
    tagline: "Kitchens, cafes, cloud kitchens & bakeries",
    longDesc:
      "Takes orders, shares the live menu, handles delivery lookups, pushes daily specials, and pings you only when a human needs to step in.",
    stats: [
      { n: "4.2m", l: "avg order time" },
      { n: "87%", l: "cart completion" },
      { n: "₹312", l: "avg ticket" },
    ],
    faqs: [
      { q: "Menu dikhao" },
      { q: "Delivery available hai?" },
      { q: "Minimum order kitna hai?" },
      { q: "Payment kaise karein?" },
      { q: "Koi offer chal raha hai?" },
    ],
    chat: [
      { who: "in", t: "Bhaiya menu dikhao please", time: "7:42 PM" },
      {
        who: "out",
        t: "Namaste 👋 Aaj ke specials —<br/><b>• Hyderabadi Dum Biryani</b> ₹280<br/><b>• Chicken 65</b> ₹240<br/><b>• Veg Pulao</b> ₹180<br/><br/>Full menu bhejun?",
        time: "7:42 PM",
        typing: true,
      },
      { who: "in", t: "Haan bhejo, 2 biryani order karna hai", time: "7:43 PM" },
      {
        who: "out",
        t: "Done boss. 2× Dum Biryani = <b>₹560</b>. Delivery address last time ka use karun (Koramangala 5th Block)?",
        time: "7:43 PM",
        typing: true,
      },
      { who: "in", t: "Haan same address", time: "7:43 PM" },
      {
        who: "out",
        t: "Order placed ✓ ETA <b>32 min</b>. UPI link: pay.zpt.shop/a9x2<br/>Track: wa.me/track/8821",
        time: "7:44 PM",
        typing: true,
      },
    ],
  },
};

const MARQUEE_ITEMS = [
  "Menu dikhao",
  "Half / Full kya price hai?",
  "Delivery available hai?",
  "Minimum order kitna?",
  "Aaj ka special kya hai?",
  "Table book karna hai 4 logo ke liye",
  "Pure-veg hai ya nahi?",
  "Khaana ready kab tak?",
  "Cash on delivery chalega?",
  "QR scan karke order kaise?",
];

const FAQS = [
  {
    q: "Will the bot actually take orders, or just answer questions?",
    a: "It takes the order. Customer sends a message, voice note, or scans a table QR — bot shares the live menu, lets them pick items + sizes (Half / Full / Family), confirms delivery address or table number, sends a UPI payment link, and notifies your kitchen instantly. You see the full order with status flow (Placed → Preparing → Ready → Delivered/Served) in your dashboard.",
  },
  {
    q: "WhatsApp just launched a free in-app AI for businesses — why pay you?",
    a: "The free in-app AI answers FAQs from your profile + catalog. ZapText is built for restaurant revenue: order capture with size variants, table QR ordering, multi-outlet routing, UPI payment links inside chat, FSSAI-compliant menu display, surge pricing disclosure, allergen warnings, and a dashboard your kitchen staff can actually use. If you're a tiny one-counter shop just answering 'kya rate hai?', the free option is enough. If you want WhatsApp to drive actual food revenue, that's us.",
  },
  {
    q: "Will my WhatsApp number get flagged for using ZapText?",
    a: "No. ZapText runs on the official WhatsApp Cloud API. Your number stays verified, green-tick eligible, and never at risk of a ban. Bot is task-scoped to restaurant operations — won't hallucinate alcohol promotions or anything that triggers Meta's Commerce Policy.",
  },
  {
    q: "Do you handle dine-in QR ordering, or just delivery / takeaway?",
    a: "All three. Print one QR per table — customer scans, WhatsApp opens, they tap Send, menu link appears, they order without flagging down a waiter. Bot routes the order to your kitchen along with the table number. Multi-outlet chains: each table's QR encodes its outlet so a Saket scan never ends up in CP's KOT queue.",
  },
  {
    q: "What languages does the bot understand?",
    a: "English is the default. The bot auto-detects per message and switches to Hindi, Hinglish, Punjabi (Punglish), Tamil (Tanglish), Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam, or any of the major Indian scripts when the customer writes in one. Voice notes are transcribed via Groq Whisper — even a 'do biryani aur ek raita bhejdo' voice command lands on the menu page with items pre-selected.",
  },
  {
    q: "Can I edit the menu after going live?",
    a: "Yes — paste, OCR a photo, or add items manually. Bulk-import handles 'Half Rs.189 / Full Rs.329' price strings automatically. Allergen tags per item are part of the menu (FSSAI Reg 2.4.6 compliant). Changes go live instantly.",
  },
  {
    q: "Multiple outlets — how does that work?",
    a: "One WhatsApp number for the whole chain. The bot routes orders to the right outlet using the QR code, the customer's shared location, or a quick branch picker. Each outlet manager logs in with their own email (you invite them from Settings → Team Members) and sees only their outlet's orders and analytics. You see the chain-wide breakdown.",
  },
  {
    q: "How fast can I actually go live?",
    a: "Onboarding (filling your menu, hours, FSSAI, GSTIN) takes about 5 minutes. After that, WhatsApp Business API verification of your number typically takes 24-48 hours — Meta's side, not ours. Once verified, your bot goes live.",
  },
  {
    q: "Do I need to provide my own WhatsApp number?",
    a: "Either works. We can hand you a fresh verified business number in under an hour, or onboard your existing one through BSP migration. You own the number forever.",
  },
  {
    q: "Are there any per-conversation charges beyond the plan?",
    a: "WhatsApp's own conversation fees (Meta's per-message pricing in INR) are passed through at cost — no markup. Most reply messages inside the 24-hour customer service window are FREE per Meta's April 2025 rule. The Starter plan covers a comfortable monthly volume for single-outlet kitchens; Growth and above scale up with multi-outlet + analytics.",
  },
  {
    q: "Can I cancel or change plans anytime?",
    a: "Yes — cancel or downgrade from the dashboard. No contract lock-in. 7-day refund if your bot doesn't go live in the first week.",
  },
];

const PLAN_ORDER: Array<{ key: keyof typeof PLANS; tag: string }> = [
  { key: "trial", tag: "Try without paying" },
  { key: "starter", tag: "Solo shops, 1 number" },
  { key: "growth", tag: "Multi-location · most popular" },
  { key: "scale", tag: "Multi-bot · API access" },
  { key: "enterprise", tag: "Chains · white-label · SLA" },
];

// ─────────────────────────── COMPONENT ───────────────────────────

export default function LandingPage() {
  // Restaurant-only landing for now. The multi-vertical BizSection +
  // MiniPhone industry-switcher block is removed from the render
  // order (functions kept in this file commented out below would
  // bloat it — they're simply deleted in the same commit). Other
  // verticals get re-added section-by-section as each ships.
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <ReferralCapture />
      <Navbar />
      <Hero />
      <Marquee />
      <HowItWorks />
      <Features />
      <Pricing />
      <ROICalculator />
      <Testimonial />
      <FAQSection />
      <WhyNotFreeBot />
      <BigCTA />
      <Footer />
      <WhatsAppDemoWidget />
    </div>
  );
}

// ─── Navbar ───
function Navbar() {
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

function Mark() {
  return (
    <span className="w-[30px] h-[30px] rounded-[8px] bg-[var(--ink)] text-[var(--accent)] grid place-items-center zt-mono font-bold text-[17px] shadow-[2px_2px_0_0_var(--accent)]">
      Z
    </span>
  );
}

// ─── Hero ───
function Hero() {
  return (
    <section className="relative py-8 md:py-12 pb-14 md:pb-20 overflow-hidden">
      <div
        className="absolute pointer-events-none hidden sm:block"
        style={{
          width: 520,
          height: 520,
          right: -100,
          top: -60,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--accent) 70%, transparent) 0%, transparent 60%)",
          filter: "blur(40px)",
          opacity: 0.45,
          zIndex: 0,
        }}
      />
      <div className="max-w-[1280px] mx-auto px-4 sm:px-7 relative">
        <div className="grid lg:grid-cols-[1.15fr_1fr] gap-8 lg:gap-14 items-stretch">
          <div>
            <div className="inline-flex items-center gap-2 zt-mono text-[12px] uppercase tracking-wide text-[var(--ink-2)] px-3 py-[7px] border border-[var(--line)] rounded-full bg-white/40">
              <span
                className="w-[7px] h-[7px] rounded-full bg-[#1fae4f] zt-pulse-dot"
                style={{ boxShadow: "0 0 0 3px color-mix(in oklab, #1fae4f 30%, transparent)" }}
              />
              Live on WhatsApp Business API · India
            </div>
            <h1 className="font-sans font-extrabold mt-5 sm:mt-6 text-[clamp(36px,8vw,84px)] leading-[1.02] tracking-[-0.035em] text-balance pb-2">
              The WhatsApp bot
              <br />
              that <span className="zt-serif">runs your kitchen.</span>
              <br />
              <span className="zt-zap">Built for restaurants.</span>
            </h1>
            <p className="text-[clamp(15px,1.3vw,19px)] text-[var(--ink-2)] max-w-[540px] mt-6 sm:mt-10 leading-[1.55]">
              ZapText turns every{" "}
              <span className="zt-serif text-[1.05em] text-[var(--ink)]">&ldquo;menu dikhao bhaiya&rdquo;</span>{" "}
              into a paid order, every{" "}
              <span className="zt-serif text-[1.05em] text-[var(--ink)]">&ldquo;table book karni hai 4 logo ke liye&rdquo;</span>{" "}
              into a confirmed reservation. Dine-in QR ordering, multi-outlet routing, UPI payments inside chat &mdash; in Hindi, English, Hinglish, and every major Indian language. Made for kitchens, cafes, cloud kitchens, sweet shops, and bakeries.
            </p>
            <div className="flex flex-wrap gap-2.5 sm:gap-3 mt-6 sm:mt-8">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 px-5 sm:px-7 py-[14px] sm:py-[18px] rounded-[14px] bg-[var(--ink)] text-[var(--background)] font-semibold text-[14px] sm:text-[16px] hover:-translate-y-px transition"
              >
                Try free &mdash; first order in 5 minutes <span>→</span>
              </Link>
              <a
                href="#why-zaptext"
                className="inline-flex items-center gap-2 px-5 sm:px-7 py-[14px] sm:py-[18px] rounded-[14px] border border-[var(--ink)] bg-transparent font-semibold text-[14px] sm:text-[16px] hover:-translate-y-px transition"
              >
                Why not the free in-app bot?
              </a>
            </div>
            <div className="flex flex-wrap gap-5 mt-7 text-[13px] text-[var(--mute)]">
              <span className="inline-flex items-center gap-1.5">
                <Check /> Takes orders, sends UPI link &mdash; not just FAQ
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check /> Multi-outlet, table QRs, one number
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check /> Cancel anytime
              </span>
            </div>
          </div>
          <PhoneChat />
        </div>
      </div>
    </section>
  );
}

function Check() {
  return (
    <span className="w-[14px] h-[14px] rounded-full bg-[var(--ink)] text-[var(--accent)] inline-grid place-items-center text-[9px]">
      ✓
    </span>
  );
}

// ─── Why not the free in-app bot ───
//
// Honest, calm comparison block aimed at restaurant owners considering
// the free in-app AI option. We don't bash competitors — we show the
// gaps that matter to a real Indian kitchen trying to grow on WhatsApp:
//   - "Takes the order + UPI link" vs "answers questions"
//   - Multi-outlet routing + table QR
//   - FSSAI / allergen / surge / DPDPA compliance
//   - Voice notes in Hindi / Punjabi / Tamil / Bengali
//   - Manager email swap without losing outlet data
function WhyNotFreeBot() {
  const rows: Array<{ scenario: string; freeBot: string; zapText: string }> = [
    {
      scenario: 'Customer asks "menu bhejdo" at 11 PM',
      freeBot: 'Pastes a long text menu blob. No way to actually order.',
      zapText: 'Sends a mobile menu link. Customer taps items, picks Half / Full, chooses delivery / takeaway / dine-in, sends UPI payment. Order lands in your kitchen.',
    },
    {
      scenario: 'Customer voice-notes "do paneer butter masala aur ek naan"',
      freeBot: '&ldquo;Sorry, I can only handle text.&rdquo;',
      zapText: 'Transcribes via Groq Whisper, parses the items, opens the menu page with paneer butter masala + naan already in the cart. Customer just confirms.',
    },
    {
      scenario: 'You run 3 outlets — Saket, CP, Gurgaon — and customer is in Hauz Khas',
      freeBot: 'No idea which outlet to route to. Owner manually re-assigns.',
      zapText: 'Customer shares location, bot computes nearest outlet inside delivery zone, sends the menu link pre-routed. Order auto-lands in Saket\'s queue.',
    },
    {
      scenario: 'Customer asks "minimum order kitna hai?" with ₹89 in cart',
      freeBot: 'Doesn\'t know. Owner ends up arguing on chat.',
      zapText: 'Min-order is configured per outlet (Rs.200). Submit endpoint rejects the ₹89 delivery order with "add ₹111 more or switch to takeaway".',
    },
    {
      scenario: 'Customer asks "FSSAI number kya hai?" — auditor is looking',
      freeBot: 'Doesn\'t have it. You scramble.',
      zapText: 'FSSAI lic + expiry + jain certs render on every order confirmation + on the public menu page. Reg 2.4.6 compliant out of the box.',
    },
    {
      scenario: 'Customer with peanut allergy asks about kheer',
      freeBot: 'Generic reply. Liability is yours.',
      zapText: 'Per-item allergen tags (8 FSSAI allergens) tagged at menu setup. Bot reads them out. Customer can also flag allergies — bot hard-warns at checkout.',
    },
    {
      scenario: 'Rain hits, you want +15% surge on delivery',
      freeBot: 'Not supported. You change menu prices manually.',
      zapText: 'Surge bands configured once. Page banner shows "Rain +15% may apply" BEFORE add-to-cart (CCPA Dark Patterns compliant). Surcharge auto-applies, breakdown shown at checkout.',
    },
    {
      scenario: 'Saket\'s manager Rohit quits, Suresh joins',
      freeBot: 'Owner re-enters everything. Past orders lost or visible to wrong manager.',
      zapText: 'Settings → Team Members → swap email. Rohit\'s access revoked, Suresh invited. All Saket orders / table data / customer history stays bound to the outlet, not the email.',
    },
  ];

  const pillars: Array<{ title: string; body: string }> = [
    {
      title: 'Restaurant compliance, built-in',
      body: 'FSSAI Reg 2.4.6 (lic + allergen + veg/non-veg), GSTIN on invoices, Jain badges, CCPA pre-cart surge disclosure, DPDPA marketing opt-in &mdash; all baked into the bot + menu page. <b class="text-white">Your kitchen + WhatsApp number stay clean.</b>',
    },
    {
      title: 'One number. Many outlets.',
      body: 'Add an outlet, generate its table QRs, invite a manager &mdash; all from one dashboard. Bot routes orders by QR scan, customer location, or branch picker. Cloud-kitchen multi-brand supported. <b class="text-white">One WhatsApp number, never re-printed.</b>',
    },
    {
      title: 'Built for Indian customers',
      body: 'Voice notes in Hinglish / Punjabi / Tamil / Bengali. Half / Full pricing parsed. Mithai by weight, kebab by piece, cake by inch. Surge for rain / peak / festival itemised. <b class="text-white">Details a generic bot will never see.</b>',
    },
  ];

  return (
    <section
      id="why-zaptext"
      className="relative overflow-hidden bg-[var(--ink)] text-[var(--background)] py-16 sm:py-24 md:py-[120px]"
    >
      {/* Accent corner glow */}
      <div
        className="absolute pointer-events-none"
        aria-hidden
        style={{
          width: 720,
          height: 720,
          right: -240,
          top: -200,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, color-mix(in oklab, var(--accent) 75%, transparent) 0%, transparent 60%)',
          filter: 'blur(50px)',
          opacity: 0.22,
        }}
      />
      <div
        className="absolute pointer-events-none hidden md:block"
        aria-hidden
        style={{
          width: 520,
          height: 520,
          left: -200,
          bottom: -220,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, color-mix(in oklab, var(--accent) 60%, transparent) 0%, transparent 60%)',
          filter: 'blur(60px)',
          opacity: 0.12,
        }}
      />
      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          backgroundImage:
            'radial-gradient(circle, color-mix(in oklab, var(--accent) 55%, transparent) 1px, transparent 1.5px)',
          backgroundSize: '36px 36px',
          opacity: 0.05,
        }}
      />

      <div className="relative max-w-[1180px] mx-auto px-4 sm:px-7">
        <div className="zt-mono text-[11px] sm:text-[12px] uppercase tracking-[.14em] text-[var(--accent)] mb-3 sm:mb-4 inline-flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"
            style={{ boxShadow: '0 0 10px var(--accent)' }}
          />
          07 &middot; Why ZapText
        </div>
        <h2 className="font-bold tracking-[-0.035em] leading-[1.02] text-[clamp(32px,5.5vw,62px)] max-w-[860px] text-balance mb-4 sm:mb-5">
          Free WhatsApp AI <span className="text-white/40">replies.</span>
          <br className="hidden sm:block" />{' '}
          <span className="zt-zap">ZapText earns.</span>
        </h2>
        <p className="text-[15px] sm:text-[17px] md:text-[19px] text-white/65 max-w-[720px] leading-[1.6] mb-10 sm:mb-14">
          A free in-app AI is great for FAQs. But Indian kitchens don&apos;t grow from FAQs &mdash; they grow from <i className="zt-serif text-white/85">booked tables, paid orders, and customers that don&apos;t slip away while you&apos;re asleep.</i> Here&apos;s what changes when the bot has actually been built for the way you run service.
        </p>

        <div className="flex flex-col gap-3.5 sm:gap-4">
          {rows.map((r, i) => (
            <article
              key={i}
              className="group rounded-[18px] sm:rounded-[22px] border border-white/10 bg-white/[0.025] hover:bg-white/[0.045] transition-colors overflow-hidden"
            >
              <div className="px-5 sm:px-8 py-4 sm:py-5 border-b border-white/10 flex items-start gap-3 sm:gap-4">
                <span className="zt-mono text-[11px] sm:text-[12px] font-bold tracking-wider text-[var(--accent)] mt-1 flex-shrink-0">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="text-[15.5px] sm:text-[18px] md:text-[20px] font-semibold tracking-[-0.015em] leading-[1.35] text-white">
                  {r.scenario}
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2">
                <div className="px-5 sm:px-8 py-4 sm:py-6 border-b md:border-b-0 md:border-r border-white/10">
                  <div className="flex items-center gap-2 mb-2 sm:mb-2.5">
                    <span className="w-5 h-5 rounded-full bg-white/8 grid place-items-center text-[11px] text-white/55">
                      ✕
                    </span>
                    <span className="zt-mono text-[10px] sm:text-[10.5px] uppercase tracking-[.12em] text-white/45">
                      Free in-app AI
                    </span>
                  </div>
                  <p
                    className="text-[13.5px] sm:text-[14.5px] text-white/55 leading-[1.55] m-0"
                    dangerouslySetInnerHTML={{ __html: r.freeBot }}
                  />
                </div>
                <div
                  className="px-5 sm:px-8 py-4 sm:py-6"
                  style={{
                    background:
                      'linear-gradient(135deg, color-mix(in oklab, var(--accent) 12%, transparent) 0%, color-mix(in oklab, var(--accent) 4%, transparent) 100%)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-2 sm:mb-2.5">
                    <span className="w-5 h-5 rounded-full bg-[var(--accent)] text-[var(--accent-2)] grid place-items-center text-[11px] font-bold">
                      ✓
                    </span>
                    <span className="zt-mono text-[10px] sm:text-[10.5px] uppercase tracking-[.12em] text-[var(--accent)] font-semibold">
                      ZapText
                    </span>
                  </div>
                  <p
                    className="text-[13.5px] sm:text-[14.5px] text-white leading-[1.55] m-0"
                    dangerouslySetInnerHTML={{ __html: r.zapText }}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 sm:mt-14 grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          {pillars.map((p) => (
            <div
              key={p.title}
              className="rounded-[16px] border border-white/10 bg-white/[0.025] px-5 sm:px-6 py-5 sm:py-6"
            >
              <div className="zt-mono text-[10.5px] uppercase tracking-[.1em] text-[var(--accent)] mb-2 font-semibold">
                {p.title}
              </div>
              <div
                className="text-[13.5px] sm:text-[14.5px] text-white/70 leading-[1.6]"
                dangerouslySetInnerHTML={{ __html: p.body }}
              />
            </div>
          ))}
        </div>

        <div className="mt-10 sm:mt-14 flex flex-wrap items-center gap-3">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 px-6 sm:px-7 py-[13px] sm:py-[15px] rounded-[12px] bg-[var(--accent)] text-[var(--accent-2)] font-semibold text-[14px] sm:text-[15px] hover:-translate-y-px transition"
          >
            Try free for 100 replies <span>→</span>
          </Link>
          <Link
            href="/compare"
            className="inline-flex items-center gap-2 px-6 sm:px-7 py-[13px] sm:py-[15px] rounded-[12px] border border-white/20 text-white font-semibold text-[14px] sm:text-[15px] hover:bg-white/5 hover:-translate-y-px transition"
          >
            See full comparison
          </Link>
          <span className="text-[12px] text-white/40 zt-mono w-full sm:w-auto mt-1 sm:mt-0">
            // your first paid order is the proof
          </span>
        </div>
      </div>
    </section>
  );
}

// ─── Phone chat (animated) ───
function PhoneChat() {
  const [bizKey] = useState<BizKey>("restaurant");
  const biz = BIZ[bizKey];
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [rendered, setRendered] = useState<Array<ChatMsg & { id: number; isTyping?: boolean }>>([]);

  useEffect(() => {
    if (!biz.chat.length) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let idCounter = 0;
    const playOnce = (startDelay = 300) => {
      let delay = startDelay;
      setRendered([]);
      biz.chat.forEach((m) => {
        if (m.who === "out" && m.typing) {
          const typingId = ++idCounter;
          timers.push(
            setTimeout(() => {
              setRendered((prev) => [...prev, { ...m, id: typingId, isTyping: true }]);
              requestAnimationFrame(() => {
                if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
              });
            }, delay)
          );
          delay += 700;
        }
        const msgId = ++idCounter;
        timers.push(
          setTimeout(() => {
            setRendered((prev) => [...prev.filter((x) => !x.isTyping), { ...m, id: msgId }]);
            requestAnimationFrame(() => {
              if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
            });
          }, delay)
        );
        delay += m.who === "out" ? 1100 : 800;
      });
      timers.push(setTimeout(() => playOnce(0), delay + 3000));
    };
    playOnce();
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [biz]);

  return (
    <div className="relative flex justify-center items-start">
      <Sticker
        className="hidden lg:flex absolute top-[60px] -left-[30px] -rotate-[4deg]"
        label="Response time"
        main={
          <>
            <b>1.2 seconds</b> · avg
          </>
        }
        dot
      />
      <Sticker
        className="hidden lg:flex absolute bottom-[120px] -right-[40px] rotate-[3deg]"
        label="More bookings"
        main={
          <>
            <b>3.4×</b> vs. missed calls
          </>
        }
        badge="3×"
      />
      <Sticker
        className="hidden lg:flex absolute top-[300px] -left-[60px] rotate-[2deg] zt-bob"
        label="Understands"
        main={
          <>
            <b>Hindi · English · Hinglish</b>
          </>
        }
        flag="🇮🇳"
      />

      <div
        className="w-[280px] sm:w-[320px] md:w-[340px] h-[540px] sm:h-[600px] md:h-[640px] max-w-full bg-[#111] rounded-[44px] p-3 relative z-[2]"
        style={{
          boxShadow:
            "0 40px 80px -30px rgba(20,20,15,.35), inset 0 0 0 1px rgba(0,0,0,.3), inset 0 2px 0 rgba(255,255,255,.05)",
        }}
      >
        <div
          className="absolute top-[18px] left-1/2 -translate-x-1/2 w-[110px] h-[26px] bg-black rounded-[16px] z-[5]"
          aria-hidden
        />
        <div className="w-full h-full rounded-[34px] overflow-hidden bg-[#ECE5DD] flex flex-col relative">
          <div className="bg-[#1f3d2d] text-white pt-[44px] pb-3 px-3.5 flex items-center gap-2.5 text-[14px]">
            <div className="w-9 h-9 rounded-full bg-[var(--accent)] text-[var(--accent-2)] grid place-items-center font-bold text-[14px] zt-mono flex-shrink-0">
              {biz.avatar || biz.label[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[14px] tracking-tight">{biz.name || `${biz.label} · Bot`}</div>
              <div className="text-[11px] opacity-70 flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-[#8fffb0]"
                  style={{ boxShadow: "0 0 6px #8fffb0" }}
                />
                online · replies instantly
              </div>
            </div>
          </div>
          <div
            ref={bodyRef}
            className="zt-chat-body flex-1 overflow-y-auto p-[14px_12px] flex flex-col gap-2"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, rgba(31,61,45,0.04) 1px, transparent 1.5px), radial-gradient(circle at 80% 60%, rgba(31,61,45,0.04) 1px, transparent 1.5px)",
              backgroundSize: "120px 120px",
            }}
          >
            {rendered.map((m) =>
              m.isTyping ? (
                <div
                  key={m.id}
                  className="zt-msg max-w-[78%] py-2 px-2.5 rounded-[10px] text-[13.5px] leading-[1.4] bg-white self-start rounded-tl-[2px]"
                  style={{ boxShadow: "0 1px 0.5px rgba(0,0,0,0.13)" }}
                >
                  <div className="inline-flex gap-[3px] py-1 zt-typing">
                    <i className="inline-block w-[5px] h-[5px] rounded-full bg-black/60" />
                    <i className="inline-block w-[5px] h-[5px] rounded-full bg-black/60" />
                    <i className="inline-block w-[5px] h-[5px] rounded-full bg-black/60" />
                  </div>
                </div>
              ) : (
                <div
                  key={m.id}
                  className={`zt-msg max-w-[78%] py-2 px-2.5 rounded-[10px] text-[13.5px] leading-[1.4] ${
                    m.who === "in"
                      ? "bg-white self-start rounded-tl-[2px]"
                      : "bg-[#D9FDD3] self-end rounded-tr-[2px]"
                  }`}
                  style={{ boxShadow: "0 1px 0.5px rgba(0,0,0,0.13)" }}
                >
                  <span dangerouslySetInnerHTML={{ __html: m.t }} />
                  <div className="text-[10px] text-black/40 text-right mt-0.5 font-medium">
                    {m.time || ""} {m.who === "out" && <span style={{ color: "#53bdeb" }}>✓✓</span>}
                  </div>
                </div>
              )
            )}
          </div>
          <div className="p-[8px_10px_12px] flex items-center gap-2">
            <div className="flex-1 bg-white rounded-[24px] px-3.5 py-2.5 text-[13px] text-black/50 flex items-center justify-between">
              <span>Type a message…</span>
              <span className="flex gap-2.5 opacity-50">📎 📷</span>
            </div>
            <div className="w-[38px] h-[38px] rounded-full bg-[#1f3d2d] text-white grid place-items-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
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
function Sticker({ className = "", label, main, dot, badge, flag }: StickerProps) {
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

// ─── Marquee ───
function Marquee() {
  const items = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <div className="border-y border-[var(--line)] py-[18px] overflow-hidden whitespace-nowrap bg-[var(--bg-2)]">
      <div className="inline-flex gap-12 zt-marquee">
        {items.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-12">
            <span className="zt-serif text-[22px] text-[var(--ink-2)] tracking-tight">{s}</span>
            <span className="zt-mono text-[16px] text-[var(--mute)]">→</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Section head ───
function SectionHead({
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

// ─── How it works ───
function HowItWorks() {
  const steps = [
    {
      n: "01",
      tag: "Step 01 · ~1 min",
      h: "Tell us about your kitchen",
      p: "Dhaba, cafe, cloud kitchen, sweet shop, bakery, fine-dine — pick your sub-type, your cuisine, your service modes (dine-in / takeaway / delivery). Pre-trained restaurant FAQ + tone load automatically.",
      mini: (
        <>
          sub_type: <b>cloud-kitchen + multi-brand</b>
          <br />
          tone: <b>friendly_hinglish</b>
          <br />
          preset_faqs: <b>loaded ✓</b>
        </>
      ),
      hot: false,
    },
    {
      n: "02",
      tag: "Step 02 · ~3 min",
      h: "Drop in your menu",
      p: "Paste it, snap a photo of your printed menu, or bulk-import an Excel. Half / Full pricing parsed automatically. FSSAI lic + GSTIN + allergens go on the menu page for compliance.",
      mini: (
        <>
          menu.jpg <b>✓ 47 items</b> · fssai <b>✓</b>
          <br />
          <span style={{ opacity: 0.6 }}>parsing Half/Full prices…</span>
          <br />
          ready for WhatsApp verify <b>✓</b>
        </>
      ),
      hot: true,
    },
    {
      n: "03",
      tag: "Step 03 · ~1 min",
      h: "Share your number",
      p: "We hand you a verified WhatsApp Business number (or connect yours). Customers message — bot replies. You watch the dashboard.",
      mini: (
        <>
          number: <b>+91 98XXX XXX12</b>
          <br />
          status: <b style={{ color: "#1fae4f" }}>● verifying</b>
          <br />
          typically live: <b>24-48h</b>
        </>
      ),
      hot: false,
    },
  ];
  return (
    <section id="how" className="py-14 md:py-[110px] bg-[var(--bg-2)] border-y border-[var(--line)]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-7">
        <SectionHead
          num="02"
          label="How it works"
          title={
            <>
              Setup in <span className="zt-serif">five minutes.</span>
              <br />
              Live in a day or two.
            </>
          }
          lead="No code. No agency. No WhatsApp API headaches. Tell us about your business — we handle training and WhatsApp Business API onboarding. Meta's verification typically takes 24-48 hours after that."
        />
        <div className="grid md:grid-cols-3" style={{ gap: 18 }}>
          {steps.map((s) => (
            <div
              key={s.n}
              className={`border rounded-[22px] p-7 relative overflow-hidden min-h-[260px] flex flex-col ${
                s.hot
                  ? "bg-[var(--ink)] text-[var(--background)] border-[var(--ink)]"
                  : "bg-[var(--card)] border-[var(--line)]"
              }`}
            >
              <div
                className="absolute top-3.5 right-5 zt-serif text-[88px] leading-none"
                style={{
                  color: s.hot ? "var(--accent)" : "var(--ink)",
                  opacity: s.hot ? 0.4 : 0.1,
                }}
              >
                {s.n}
              </div>
              <div
                className="zt-mono text-[11px] uppercase tracking-[.08em]"
                style={{ color: s.hot ? "#ffffff88" : "var(--mute)" }}
              >
                {s.tag}
              </div>
              <h4 className="text-[26px] font-bold tracking-[-0.025em] mt-2.5 mb-2">{s.h}</h4>
              <p className="leading-[1.55] mb-4" style={{ color: s.hot ? "#ffffffbb" : "var(--ink-2)" }}>
                {s.p}
              </p>
              <div
                className="mt-auto zt-mono text-[12px] rounded-[12px] px-3.5 py-3 border border-dashed"
                style={{
                  background: s.hot ? "#ffffff0e" : "var(--bg-2)",
                  borderColor: s.hot ? "#ffffff22" : "var(--line)",
                  color: s.hot ? "#ffffffdd" : "var(--ink-2)",
                }}
              >
                {s.mini}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Features ───
function Features() {
  return (
    <section id="features" className="py-14 md:py-[110px]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-7">
        <SectionHead
          num="03"
          label="What's in the box"
          title={
            <>
              A full <span className="zt-serif">operations layer</span>
              <br />
              inside WhatsApp.
            </>
          }
          lead="Not just auto-reply. ZapText handles bookings, lead capture, escalations, reminders, analytics — the boring stuff that eats your day."
        />
        <div className="grid grid-cols-1 md:grid-cols-12" style={{ gap: 18 }}>
          <FeatCard span={5} variant="accent" label="01 · Hinglish AI" title="Speaks the way your customers type.">
            <p className="text-[14.5px] m-0" style={{ color: "#0f1405bb" }}>
              Our model is tuned on Indian messaging patterns — Romanized Hindi, code-switching, typos, voice notes. It gets{" "}
              <em className="zt-serif">&ldquo;bhaiya kal subah 10 baje aa jayein?&rdquo;</em> on the first try.
            </p>
            <div className="mt-auto pt-4.5">
              <div className="flex flex-wrap gap-1.5">
                {["Hindi", "English", "Hinglish", "Bengali", "Tamil", "Marathi", "Gujarati", "+7"].map((l) => (
                  <span key={l} className="px-3 py-1.5 rounded-full zt-mono text-[12px] border border-current opacity-85">
                    {l}
                  </span>
                ))}
              </div>
            </div>
          </FeatCard>
          <FeatCard span={4} label="02 · Booking" title="Calendar on autopilot.">
            <p className="text-[14.5px] text-[var(--ink-2)] m-0">
              Customer picks a slot, bot confirms, reminders go out the night before. Reschedules, cancellations — all inside the chat.
            </p>
            <div className="mt-auto pt-4.5 flex gap-1.5 flex-wrap">
              {[
                { t: "Mon 9:00", active: false },
                { t: "Mon 11:30 ✓", active: true },
                { t: "Mon 14:00", active: false },
                { t: "Tue 10:00", active: false },
              ].map((s) => (
                <span
                  key={s.t}
                  className={`zt-mono text-[11px] rounded-[6px] px-2.5 py-[5px] ${
                    s.active ? "bg-[var(--ink)] text-[var(--accent)]" : "bg-[var(--bg-2)]"
                  }`}
                >
                  {s.t}
                </span>
              ))}
            </div>
          </FeatCard>
          <FeatCard span={3} label="03 · Escalation" title="Knows when to call a human.">
            <p className="text-[14.5px] text-[var(--ink-2)] m-0">
              Angry customer? Complex query? Bot pings you on WhatsApp with full context.
            </p>
            <div className="mt-auto pt-4.5">
              <div className="bg-[var(--bg-2)] rounded-[10px] px-3 py-2.5 text-[12.5px]">
                <div className="text-[var(--mute)] text-[10.5px] uppercase tracking-[.08em] zt-mono mb-0.5">
                  Escalated to you
                </div>
                Priya (VIP) — refund, 3rd message
              </div>
            </div>
          </FeatCard>
          <FeatCard span={3} label="04 · Lead scoring" title="Warm leads, up top.">
            <p className="text-[14.5px] text-[var(--ink-2)] m-0">Ranks every conversation by intent. Stop scrolling; start closing.</p>
            <div className="mt-auto pt-4.5 flex flex-col gap-1.5">
              <div className="flex justify-between text-[12px]">
                <span>🔥 Ankit J.</span>
                <span className="zt-mono">94</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span>🔥 Meera S.</span>
                <span className="zt-mono">88</span>
              </div>
              <div className="flex justify-between text-[12px] text-[var(--mute)]">
                <span>Rahul T.</span>
                <span className="zt-mono">42</span>
              </div>
            </div>
          </FeatCard>
          <FeatCard span={4} variant="ink" label="05 · Analytics" title="Daily summaries in your inbox.">
            <p className="text-[14.5px] m-0" style={{ color: "#ffffffbb" }}>
              How many messages handled, peak hours, top FAQs, leads captured. No dashboard dive needed.
            </p>
            <div className="mt-auto pt-4.5">
              <div className="h-[70px] flex items-end gap-1">
                {[22, 40, 65, 48, 72, 90, 78, 55, 62, 85, 100, 70].map((h, i) => (
                  <i key={i} className="flex-1 rounded-t-[3px] bg-[var(--accent)] opacity-85" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </FeatCard>
          <FeatCard span={5} label="06 · Personality" title="Your tone. Your policies. Your voice.">
            <p className="text-[14.5px] text-[var(--ink-2)] m-0">
              Every bot is trained on <em>your</em> data — menu, prices, timings, refund rules, brand voice. No generic &ldquo;I&apos;m an AI assistant.&rdquo; Answers sound like you wrote them at 2am.
            </p>
            <div className="mt-auto pt-4.5 grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-[10px] bg-[var(--bg-2)] text-[12.5px] leading-[1.35]">
                <div className="text-[var(--mute)] text-[10px] zt-mono mb-1">GENERIC BOT</div>
                &ldquo;I apologize, but I cannot process that request at this time.&rdquo;
              </div>
              <div className="p-2.5 rounded-[10px] bg-[var(--accent)] text-[var(--accent-2)] text-[12.5px] leading-[1.35]">
                <div className="text-[10px] zt-mono mb-1" style={{ opacity: 0.6 }}>
                  YOUR ZAPTEXT BOT
                </div>
                &ldquo;Aaj shaam tak confirm ho jayega boss, don&apos;t worry — ek bar manager se check karwa deta hoon.&rdquo;
              </div>
            </div>
          </FeatCard>
          <FeatCard span={12} variant="ink" label="07 · Restaurant: dine-in QR ordering" title="Table par baith ke order. Bina waiter dhundhe.">
            <p className="text-[14.5px] m-0" style={{ color: "#ffffffbb" }}>
              Restaurant ke har table par alag QR. Customer scan kare → WhatsApp khule → Send dabaye → menu link mile → order place kare. Sab kuch WhatsApp ke andar. Multiple sizes (Half / Full / Family Pack), bilingual EN+Hinglish, manager dashboard pe live tables — order status updates jaate hain customer ko bhi.
            </p>
            <div className="mt-auto pt-4.5 grid grid-cols-1 md:grid-cols-4 gap-2 text-[12.5px]">
              {[
                { tag: 'PRINT', body: 'One PDF, one QR per table. Cmd+P, cut, paste, done.' },
                { tag: 'ANTI-FRAUD', body: 'Rotating shift tokens + 2hr session auto-close.' },
                { tag: 'NO CLASH', body: 'Dine-in vs home delivery routed automatically.' },
                { tag: 'AVAILABLE ON', body: 'Growth · Scale · Enterprise plans.' },
              ].map((c) => (
                <div key={c.tag} className="rounded-[10px] p-2.5" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <div className="zt-mono text-[10px] tracking-[.08em] mb-1" style={{ color: 'var(--accent)' }}>{c.tag}</div>
                  <div style={{ color: '#ffffffcc' }}>{c.body}</div>
                </div>
              ))}
            </div>
          </FeatCard>
        </div>
      </div>
    </section>
  );
}

function FeatCard({
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
      style={{ ['--feat-span' as never]: String(span) }}
    >
      <div className={`zt-mono text-[11px] uppercase tracking-[.08em] ${lblCls}`}>{label}</div>
      <h4 className="text-[20px] sm:text-[22px] font-bold tracking-[-0.022em] mt-2 mb-1.5">{title}</h4>
      {children}
    </div>
  );
}

// ─── Pricing ───
function Pricing() {
  // Three-way duration toggle (1M / 6M / 12M) matches the subscription
  // page so prospects see exactly the same options before signup as
  // they do once logged in. Earlier the landing only had Monthly/Annual
  // which left a gap.
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
              const label = months === 1 ? 'Monthly' : months === 6 ? '6 months' : 'Annual';
              return (
                <button
                  key={m}
                  onClick={() => setDuration(months)}
                  className={`rounded-full font-medium inline-flex items-center gap-1.5 ${active ? "bg-[var(--ink)] text-[var(--background)]" : "text-[var(--ink-2)]"}`}
                  style={{ padding: "9px 18px" }}
                >
                  {label}
                  {DURATIONS[months].savingLabel && (
                    <span className={`ml-1 px-2 py-[2px] rounded-full zt-mono text-[10px] font-bold ${active ? 'bg-[var(--accent)] text-[var(--accent-2)]' : 'bg-[var(--accent)]/20 text-[var(--ink)]'}`}>
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
            // Per-month effective rate at the selected duration. The
            // multiplier in DURATIONS encodes the discount (e.g. 6mo=5.5x
            // = ~8% off, 12mo=10x = ~17% off). Card always shows /mo so
            // prospects can compare straight across durations.
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
                      <span className="text-[54px] font-bold tracking-[-0.045em] leading-none">
                        Free
                      </span>
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

// ─── Testimonial ───
function Testimonial() {
  return (
    <section className="py-14 md:py-[110px]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-7">
        <div className="grid md:grid-cols-[1.3fr_1fr] gap-8 md:gap-12 items-center">
          <div>
            <div className="zt-mono text-[12px] uppercase tracking-[.08em] text-[var(--mute)]">
              {"// 05 — From the field"}
            </div>
            <p className="zt-serif text-[clamp(30px,3.6vw,50px)] leading-[1.08] tracking-[-0.02em] text-balance mt-4">
              &ldquo;Saturday night ko{" "}
              <span
                className="bg-[var(--accent)] rounded-[6px]"
                style={{
                  padding: "0 .12em",
                  fontStyle: "normal",
                  fontFamily: "var(--font-sans)",
                  fontWeight: 500,
                  fontSize: "0.88em",
                }}
              >
                63 orders WhatsApp se
              </span>{" "}
              aaye.
              <br />
              Phone uthana band kar diya —<br />
              kitchen mein focus kar paaye.&rdquo;
            </p>
            <div className="flex items-center gap-3 mt-7 text-[14px]">
              <div className="w-[42px] h-[42px] rounded-full bg-[#D9FDD3] grid place-items-center font-bold">RM</div>
              <div>
                <div className="font-semibold">Rohit Menon</div>
                <div className="text-[var(--mute)]">Tandoor &amp; Tadka, Bengaluru · on ZapText Growth</div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-[2px] border border-[var(--line)] bg-[var(--line)] rounded-[18px] overflow-hidden">
            <QStat n="94" suffix="%" l="queries resolved without human touch — across 1,200+ live bots" />
            <QStat n="2.8" suffix="s" l="median response time, 24/7, including public holidays" />
            <QStat n="< 5" suffix="m" l="median time from sign-up to first live customer reply" dark />
            <QStat n="3.4" suffix="×" l="more bookings converted vs. missed calls + voicemail" accent />
          </div>
        </div>
      </div>
    </section>
  );
}

function QStat({
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

// ─── FAQ ───
function FAQSection() {
  return (
    <section id="faq" className="pt-4 pb-14 md:pb-[110px]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-7">
        <SectionHead
          num="06"
          label="Common questions"
          title={
            <>
              Things people <span className="zt-serif">always ask.</span>
            </>
          }
          lead={
            <>
              Short answers. If you want to go deeper,{" "}
              <Link href="/contact" className="border-b border-[var(--ink)]">
                send us a quick message
              </Link>{" "}
              and we&apos;ll get back the same day.
            </>
          }
        />
        <div className="border-t border-[var(--line)]">
          {FAQS.map((f, i) => (
            <details key={i} className="zt-faq border-b border-[var(--line)] cursor-pointer" style={{ padding: "22px 0" }}>
              <summary className="flex justify-between items-center gap-5 list-none cursor-pointer">
                <span className="text-[clamp(18px,1.8vw,22px)] font-medium tracking-[-0.015em]">{f.q}</span>
                <div className="zt-faq-icon w-8 h-8 rounded-full border border-[var(--line)] grid place-items-center text-[14px] flex-shrink-0 transition">
                  +
                </div>
              </summary>
              <div
                className="zt-faq-answer text-[var(--ink-2)] text-[15.5px] leading-[1.55] max-w-[720px] overflow-hidden transition-all"
                style={{ maxHeight: 0 }}
              >
                {f.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Big CTA ───
function BigCTA() {
  return (
    <section className="max-w-[1280px] mx-auto px-4 sm:px-7 mt-10 sm:mt-[60px] mb-10 sm:mb-[60px]">
      <div className="relative overflow-hidden rounded-[24px] sm:rounded-[36px] bg-[var(--ink)] text-[var(--background)] px-6 py-12 sm:px-14 sm:py-[80px]">
        <div
          className="absolute pointer-events-none"
          style={{
            width: 480,
            height: 480,
            right: -120,
            bottom: -220,
            borderRadius: "50%",
            background: "radial-gradient(circle, color-mix(in oklab, var(--accent) 80%, transparent) 0%, transparent 60%)",
            opacity: 0.25,
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(var(--accent) 1px, transparent 1px), linear-gradient(90deg, var(--accent) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            opacity: 0.05,
          }}
        />
        <div className="relative">
          <h3 className="text-[clamp(48px,5.6vw,88px)] font-bold tracking-[-0.04em] leading-[0.95] max-w-[800px] text-balance m-0">
            Your next customer is <span className="zt-serif">already</span>
            <br />
            typing.{" "}
            <span className="bg-[var(--accent)] text-[var(--accent-2)] rounded-[10px]" style={{ padding: "0 .15em" }}>
              Be ready.
            </span>
          </h3>
          <p className="text-[18px] mt-6 mb-8 max-w-[500px]" style={{ color: "#ffffffaa" }}>
            Configure your WhatsApp bot in about five minutes. ₹0 setup fee on launch. WhatsApp verification (~24-48h) handled for you.
          </p>
          <div className="flex gap-2.5 flex-wrap">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-5 sm:px-7 py-[14px] sm:py-[18px] rounded-[14px] bg-[var(--accent)] text-[var(--accent-2)] font-semibold text-[14px] sm:text-[16px] hover:-translate-y-px transition"
            >
              Get started — ₹0 setup fee <span>→</span>
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-5 sm:px-7 py-[14px] sm:py-[18px] rounded-[14px] border border-white/20 text-[var(--background)] font-semibold text-[14px] sm:text-[16px] hover:-translate-y-px transition"
            >
              Talk to us first
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───
function Footer() {
  return (
    <footer className="border-t border-[var(--line)] py-10 sm:py-12 text-[14px]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-7">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr] gap-10 mb-14">
          <div>
            <Link href="/" className="flex items-center gap-2.5 font-bold text-[18px] mb-3.5">
              <Mark />
              <span>ZapText</span>
            </Link>
            <p className="text-[var(--ink-2)] max-w-[340px] text-[14px] leading-[1.55]">
              The WhatsApp bot built for Indian restaurants. Dine-in QR ordering, multi-outlet routing, UPI payments — in every Indian language.
            </p>
          </div>
          <FootCol
            title="Product"
            links={[
              { h: "#why-zaptext", l: "Why ZapText" },
              { h: "#features", l: "Features" },
              { h: "#pricing", l: "Pricing" },
              { h: "#how", l: "How it works" },
            ]}
          />
          <FootCol
            title="Company"
            links={[
              { h: "/about", l: "About" },
              { h: "/contact", l: "Contact" },
              { h: "#", l: "Careers" },
              { h: "#", l: "Press" },
            ]}
          />
          <FootCol
            title="Legal"
            links={[
              { h: "/privacy", l: "Privacy" },
              { h: "/terms", l: "Terms" },
              { h: "/refund", l: "Refund policy" },
              { h: "/cancellation", l: "Cancellation" },
            ]}
          />
        </div>

        <div
          className="font-sans text-[clamp(72px,13vw,180px)] font-extrabold tracking-[-0.055em] leading-[0.9] text-[var(--ink)] border-t border-[var(--line)] pt-6 flex items-end justify-between"
          style={{ opacity: 0.92 }}
        >
          <span>
            Zap<span className="zt-serif">Text</span>.
          </span>
          <small className="zt-mono text-[12px] font-medium text-[var(--mute)] tracking-normal">
            v2.0 · 2026 · Made in IN 🇮🇳
          </small>
        </div>
        <div className="pt-4 flex justify-between gap-4 flex-wrap text-[var(--mute)] text-[12px]">
          <span>© 2026 ZapText Labs Pvt Ltd — GSTIN 29XXXXX1234X1Z5</span>
          <span>zaptext.shop</span>
        </div>
      </div>
    </footer>
  );
}

function FootCol({ title, links }: { title: string; links: { h: string; l: string }[] }) {
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
