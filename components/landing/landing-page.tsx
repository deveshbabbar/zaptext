"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PLANS } from "@/lib/plans";

// ─────────────────────────── DATA ───────────────────────────

type ChatMsg = { who: "in" | "out"; t: string; time?: string; typing?: boolean };
type BizKey = "restaurant" | "salon" | "coaching" | "realestate" | "d2c" | "gym";
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
  salon: {
    emoji: "💇",
    label: "Salon",
    name: "Bliss Salon · Bot",
    avatar: "B",
    tagline: "Salons, spas, barbers & wellness",
    longDesc:
      "Shares rate lists with photos, books stylists by name, upsells packages, confirms bridal slots, and messages a reminder the morning of.",
    stats: [
      { n: "+41%", l: "package upsells" },
      { n: "2.1×", l: "repeat bookings" },
      { n: "0", l: "no-shows last month" },
    ],
    faqs: [
      { q: "Rate list dikhao" },
      { q: "Appointment book karni hai" },
      { q: "Home service available hai?" },
      { q: "Bridal package kya hai?" },
      { q: "Kaunse brands use karte ho?" },
    ],
    chat: [
      { who: "in", t: "Hair spa ka rate kya hai?", time: "3:20 PM" },
      {
        who: "out",
        t: "Hi love 💫 Hair Spa options —<br/><b>• Wella deep cond.</b> ₹1,200<br/><b>• Moroccan oil spa</b> ₹1,800<br/><b>• Olaplex bond repair</b> ₹2,500<br/><br/>Length waist ke niche hai? Top-up ₹400.",
        time: "3:20 PM",
        typing: true,
      },
      { who: "in", t: "Moroccan walla karwana hai, kal evening?", time: "3:21 PM" },
      {
        who: "out",
        t: "<b>Sat 6:30 PM</b> with Priya available hai. Confirm?",
        time: "3:21 PM",
        typing: true,
      },
      { who: "in", t: "Yes please", time: "3:21 PM" },
      {
        who: "out",
        t: "Booked ✓ Priya blocked 90 min for you. Bridal trial bhi aane wali hai next month — remind karun?",
        time: "3:22 PM",
        typing: true,
      },
    ],
  },
  coaching: {
    emoji: "📚",
    label: "Coaching",
    name: "Sharma Classes · Bot",
    avatar: "S",
    tagline: "Institutes, tutors & test-prep centers",
    longDesc:
      "Handles admission queries, shares fees and toppers, books demo classes, and hands warm parents to counselors with full chat context.",
    stats: [
      { n: "6.2×", l: "demo bookings" },
      { n: "₹2.1L", l: "fees collected/wk" },
      { n: "11 PM", l: "peak query time" },
    ],
    faqs: [
      { q: "Admission kaise hota hai?" },
      { q: "Fees kitni hai?" },
      { q: "Demo class milegi?" },
      { q: "Results kaise hain?" },
      { q: "Online classes available hain?" },
    ],
    chat: [
      { who: "in", t: "Beta 11th PCM ke liye coaching chahiye", time: "9:12 PM" },
      {
        who: "out",
        t: "Namaste! 11th PCM — 2 batches —<br/><b>• Morning 7–10 AM</b> (₹48k/yr)<br/><b>• Evening 4–7 PM</b> (₹52k/yr)<br/><br/>Demo class free hai. Board CBSE ya ICSE?",
        time: "9:12 PM",
        typing: true,
      },
      { who: "in", t: "CBSE. Demo kab milegi?", time: "9:13 PM" },
      {
        who: "out",
        t: "Kal Saturday 5 PM demo chalega? Physics by Mr. Verma — last year 6 students 95+.",
        time: "9:13 PM",
        typing: true,
      },
      { who: "in", t: "Ok book karo", time: "9:13 PM" },
      {
        who: "out",
        t: "Booked ✓ Parent counselor Meena aapko call karengi subah. Fee structure PDF bhej rahi hoon 📎",
        time: "9:14 PM",
        typing: true,
      },
    ],
  },
  realestate: {
    emoji: "🏠",
    label: "Real estate",
    tagline: "Builders, agents & property consultants",
    longDesc:
      "Qualifies buyer/renter intent, shares listings with photos and RERA, books site visits, and routes serious buyers to your best closer.",
    stats: [
      { n: "4.8×", l: "site visits" },
      { n: "₹14L", l: "avg deal size" },
      { n: "72%", l: "verified leads" },
    ],
    faqs: [
      { q: "Kya available hai is area mein?" },
      { q: "Site visit kaise book karein?" },
      { q: "Home loan help milegi?" },
      { q: "RERA number kya hai?" },
      { q: "Price negotiable hai?" },
    ],
    chat: [],
  },
  d2c: {
    emoji: "🛍️",
    label: "D2C brand",
    tagline: "Online brands — skincare, fashion, food",
    longDesc:
      "Tracks orders without a ticket queue, handles returns, upsells the next SKU, and recovers abandoned carts over WhatsApp.",
    stats: [
      { n: "+23%", l: "cart recovery" },
      { n: "-61%", l: "support tickets" },
      { n: "3.4×", l: "LTV" },
    ],
    faqs: [
      { q: "Order track karna hai" },
      { q: "Return kaise karein?" },
      { q: "COD available hai?" },
      { q: "Koi offer hai?" },
      { q: "Delivery kitne din mein hogi?" },
    ],
    chat: [],
  },
  gym: {
    emoji: "💪",
    label: "Gym",
    tagline: "Gyms, yoga, CrossFit & fitness",
    longDesc:
      "Shares membership tiers, books free trials, sends renewal reminders before churn, and pushes class schedules every morning.",
    stats: [
      { n: "-34%", l: "churn" },
      { n: "1,200+", l: "trials booked" },
      { n: "6 AM", l: "reminder sent" },
    ],
    faqs: [
      { q: "Membership kitne ki hai?" },
      { q: "Trial available hai?" },
      { q: "Personal trainer milega?" },
      { q: "Timings kya hain?" },
      { q: "Kaunsi classes hain?" },
    ],
    chat: [],
  },
};

const MARQUEE_ITEMS = [
  "Menu dikhao",
  "Book karwa do appointment",
  "Dosa ka price kya hai?",
  "Kya insurance accept hota hai?",
  "Home service available hai?",
  "Trial class milegi?",
  "Order track karna hai",
  "RERA number kya hai?",
  "Kitne ki membership hai?",
];

const FAQS = [
  {
    q: "Is ZapText official WhatsApp Business API or just automation?",
    a: "100% official WhatsApp Business Platform (Cloud API via Meta). Your number is verified, green-tick eligible, and messages are never at risk of a ban. No browser hacks, no unofficial libraries.",
  },
  {
    q: "Do I need to provide my own WhatsApp number?",
    a: "Either works. We can hand you a fresh verified business number in under an hour, or onboard your existing one through BSP migration. You own the number forever.",
  },
  {
    q: "What languages does the bot actually understand?",
    a: "Hindi, English, Hinglish (Romanized Hindi), Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia, and Assamese. It auto-detects per-message and replies in the same language the customer used.",
  },
  {
    q: "Can I edit the bot's answers?",
    a: "Yes — every reply is editable from your dashboard, and you can upload menus, PDFs, pricelists, CSVs. Changes go live instantly. For the Pro plan and above, you also get a monthly review call where we tune the bot against real conversations.",
  },
  {
    q: "What happens if the bot doesn't know something?",
    a: "Two modes. Safe mode: it says so, logs the question, and pings you. Auto-learn: it drafts a reply using your broader business context and flags it for your approval. You pick.",
  },
  {
    q: "How fast can I actually go live?",
    a: "Onboarding (filling your details and configuring the bot) takes about 5 minutes. After that, WhatsApp Business API verification of your number typically takes 24-48 hours — that's Meta's side, not ours. Once verified, your bot goes live. Pro and Enterprise include a 1-hour onboarding call to tune voice and integrations.",
  },
  {
    q: "Are there any per-conversation charges beyond the plan?",
    a: "WhatsApp's own conversation fees (Meta's pricing, paise per conversation) are passed through at cost. The Starter plan includes 500 conversations/month; Growth and above are unlimited at your plan rate. No surprise markup.",
  },
  {
    q: "Can I cancel or change plans anytime?",
    a: "Yes — cancel or downgrade from the dashboard. No contract lock-in. We also offer a 7-day refund if your bot doesn't go live within the first week.",
  },
];

const PLAN_ORDER: Array<{ key: keyof typeof PLANS; tag: string }> = [
  { key: "starter", tag: "Solo shops, 1 number" },
  { key: "growth", tag: "Multi-location · most popular" },
  { key: "pro", tag: "Teams that close on chat" },
  { key: "enterprise", tag: "Chains · white-label" },
];

// ─────────────────────────── COMPONENT ───────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Navbar />
      <Hero />
      <Marquee />
      <BizSection />
      <HowItWorks />
      <Features />
      <Pricing />
      <Testimonial />
      <FAQSection />
      <BigCTA />
      <Footer />
    </div>
  );
}

// ─── Navbar ───
function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--line)] bg-[color-mix(in_oklab,var(--background)_80%,transparent)] backdrop-blur-md">
      <div className="max-w-[1280px] mx-auto px-7 h-[68px] flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 font-bold text-[18px] tracking-tight">
          <Mark />
          <span>
            ZapText
            <sup className="text-[var(--mute)] font-medium text-[10px] ml-1">.shop</sup>
          </span>
        </Link>
        <div className="hidden md:flex gap-8 text-[14px] text-[var(--ink-2)]">
          <a href="#biz" className="opacity-75 hover:opacity-100 transition">For your business</a>
          <a href="#how" className="opacity-75 hover:opacity-100 transition">How it works</a>
          <a href="#features" className="opacity-75 hover:opacity-100 transition">Features</a>
          <a href="#pricing" className="opacity-75 hover:opacity-100 transition">Pricing</a>
          <a href="#faq" className="opacity-75 hover:opacity-100 transition">FAQs</a>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/sign-in" className="px-4 py-2.5 text-[14px] font-semibold text-[var(--ink-2)] hover:text-[var(--ink)] transition">
            Sign in
          </Link>
          <Link href="/sign-up" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[var(--ink)] text-[var(--background)] font-semibold text-[14px] hover:-translate-y-px transition">
            Get started <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
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
    <section className="relative py-10 md:py-12 pb-20 overflow-hidden">
      <div
        className="absolute pointer-events-none"
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
      <div className="max-w-[1280px] mx-auto px-7 relative">
        <div className="grid lg:grid-cols-[1.15fr_1fr] gap-14 items-stretch">
          <div>
            <div className="inline-flex items-center gap-2 zt-mono text-[12px] uppercase tracking-wide text-[var(--ink-2)] px-3 py-[7px] border border-[var(--line)] rounded-full bg-white/40">
              <span
                className="w-[7px] h-[7px] rounded-full bg-[#1fae4f] zt-pulse-dot"
                style={{ boxShadow: "0 0 0 3px color-mix(in oklab, #1fae4f 30%, transparent)" }}
              />
              Live on WhatsApp Business API · India
            </div>
            <h1 className="font-sans font-extrabold mt-6 text-[clamp(44px,6vw,84px)] leading-[1.02] tracking-[-0.035em] text-balance pb-2">
              Your business,
              <br />
              replying on <span className="zt-zap">WhatsApp</span>
              <br />
              <span className="zt-serif">while you sleep.</span>
            </h1>
            <p className="text-[clamp(16px,1.3vw,19px)] text-[var(--ink-2)] max-w-[520px] mt-10 leading-[1.55]">
              ZapText builds AI bots that understand{" "}
              <span className="zt-serif text-[1.12em] text-[var(--ink)]">
                &ldquo;order kaha hai, bhaiya?&rdquo;
              </span>{" "}
              and reply like your best employee — in Hindi, English, or Hinglish. Restaurants, coaching, salons, real estate, D2C and gyms. Quick setup. No code.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 px-7 py-[18px] rounded-[14px] bg-[var(--ink)] text-[var(--background)] font-semibold text-[16px] hover:-translate-y-px transition"
              >
                Set up my bot <span>→</span>
              </Link>
              <a
                href="#how"
                className="inline-flex items-center gap-2 px-7 py-[18px] rounded-[14px] border border-[var(--ink)] bg-transparent font-semibold text-[16px] hover:-translate-y-px transition"
              >
                Watch 60-sec demo
              </a>
            </div>
            <div className="flex flex-wrap gap-5 mt-7 text-[13px] text-[var(--mute)]">
              <span className="inline-flex items-center gap-1.5">
                <Check /> ₹0 setup fee (₹4,999 waived)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check /> Live after WhatsApp verify (~48h)
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
        className="absolute top-[60px] -left-[30px] -rotate-[4deg]"
        label="Response time"
        main={
          <>
            <b>1.2 seconds</b> · avg
          </>
        }
        dot
      />
      <Sticker
        className="absolute bottom-[120px] -right-[40px] rotate-[3deg]"
        label="More bookings"
        main={
          <>
            <b>3.4×</b> vs. missed calls
          </>
        }
        badge="3×"
      />
      <Sticker
        className="absolute top-[300px] -left-[60px] rotate-[2deg] zt-bob"
        label="Understands"
        main={
          <>
            <b>Hindi · English · Hinglish</b>
          </>
        }
        flag="🇮🇳"
      />

      <div
        className="w-[340px] h-[640px] bg-[#111] rounded-[44px] p-3 relative z-[2]"
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
    <div className="grid md:grid-cols-[1fr_1.8fr] gap-8 md:gap-14 items-end mb-14">
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

// ─── Business types section ───
function BizSection() {
  const [active, setActive] = useState<BizKey>("restaurant");
  const b = BIZ[active];
  return (
    <section id="biz" className="py-[110px]">
      <div className="max-w-[1280px] mx-auto px-7">
        <SectionHead
          num="01"
          label="Your industry"
          title={
            <>
              Not one bot for all.
              <br />
              <span className="zt-serif">
                A bot for <em>{b.label.toLowerCase()}</em> industry.
              </span>
            </>
          }
          lead="Every business speaks its own language. A salon bot sells packages, a gym bot manages trials, a restaurant bot takes orders. Pick your industry — we'll show you what your bot will actually do."
        />
        <div className="flex flex-wrap gap-2 mb-8">
          {(Object.entries(BIZ) as [BizKey, Biz][]).map(([k, v]) => (
            <button
              key={k}
              onClick={() => setActive(k)}
              className={`px-4 py-2.5 rounded-full border text-[14px] font-medium inline-flex items-center gap-2 transition ${
                active === k
                  ? "bg-[var(--ink)] text-[var(--background)] border-[var(--ink)]"
                  : "bg-[var(--card)] border-[var(--line)] hover:border-[var(--ink)]"
              }`}
            >
              <span className="text-[15px] leading-none">{v.emoji}</span> {v.label}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-[1.3fr_1fr] gap-10 border border-[var(--line)] rounded-[28px] bg-[var(--card)] p-9">
          <div>
            <div className="zt-mono text-[11px] uppercase tracking-[.08em] text-[var(--mute)]">
              {b.emoji} {b.label.toUpperCase()}
            </div>
            <h3 className="text-[36px] font-bold tracking-[-0.03em] mt-1.5 mb-2">
              Made for <span className="zt-serif">{b.label.toLowerCase()}.</span>
            </h3>
            <p className="text-[16px] text-[var(--ink-2)] mb-4">{b.longDesc}</p>
            <div className="grid grid-cols-3 gap-[4px] border border-[var(--line)] rounded-[14px] overflow-hidden bg-[var(--bg-2)] my-5">
              {b.stats.map((s, i) => (
                <div key={i} className="py-3.5 px-4 bg-[var(--card)]">
                  <div className="text-[28px] font-bold tracking-[-0.025em]">{s.n}</div>
                  <div className="text-[11px] text-[var(--mute)] uppercase tracking-[.06em] zt-mono">{s.l}</div>
                </div>
              ))}
            </div>
            <div className="zt-mono text-[11px] uppercase tracking-[.08em] text-[var(--mute)] mt-4 mb-1.5">
              {"// pre-trained FAQs"}
            </div>
            <div className="mt-2.5">
              {b.faqs.map((f, i) => (
                <div
                  key={i}
                  className={`flex gap-2.5 py-2.5 text-[14.5px] ${
                    i > 0 ? "border-t border-dashed border-[var(--line)]" : ""
                  }`}
                >
                  <span className="zt-mono text-[11px] text-[var(--mute)] w-[26px] flex-shrink-0 pt-[3px]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <em className="zt-serif text-[var(--ink-2)]">&ldquo;</em>
                    {f.q}
                    <em className="zt-serif text-[var(--ink-2)]">&rdquo;</em>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <MiniPhone biz={b} />
        </div>
      </div>
    </section>
  );
}

function MiniPhone({ biz }: { biz: Biz }) {
  const msgs: Array<{ who: "in" | "out"; t: string; time?: string }> =
    biz.chat.length > 0
      ? biz.chat.slice(0, 4)
      : [
          { who: "in", t: biz.faqs[0]?.q || "Hi", time: "now" },
          {
            who: "out",
            t: "Bot sees this coming. Pick this industry in the switcher above to see a live demo.",
            time: "now",
          },
        ];
  return (
    <div
      className="rounded-[22px] overflow-hidden bg-[#ECE5DD] flex flex-col h-[460px]"
      style={{ boxShadow: "0 20px 40px -22px rgba(0,0,0,.3), 0 0 0 1px var(--line)" }}
    >
      <div className="bg-[#1f3d2d] text-white p-3.5 flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-full bg-[var(--accent)] text-[var(--accent-2)] grid place-items-center font-bold text-[14px] zt-mono flex-shrink-0">
          {biz.avatar || biz.label[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[14px]">{biz.name || `${biz.label} · Bot`}</div>
          <div className="text-[11px] opacity-70 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8fffb0]" style={{ boxShadow: "0 0 6px #8fffb0" }} />
            online
          </div>
        </div>
      </div>
      <div
        className="zt-chat-body flex-1 overflow-y-auto p-[14px_12px] flex flex-col gap-2"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(31,61,45,0.04) 1px, transparent 1.5px), radial-gradient(circle at 80% 60%, rgba(31,61,45,0.04) 1px, transparent 1.5px)",
          backgroundSize: "120px 120px",
        }}
      >
        {msgs.map((m, i) => (
          <div
            key={i}
            className={`max-w-[78%] py-2 px-2.5 rounded-[10px] text-[13.5px] leading-[1.4] ${
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
        ))}
      </div>
    </div>
  );
}

// ─── How it works ───
function HowItWorks() {
  const steps = [
    {
      n: "01",
      tag: "Step 01 · ~1 min",
      h: "Pick your business type",
      p: "Restaurant, coaching, salon, real estate, D2C or gym. Each comes pre-trained with the questions your customers actually ask.",
      mini: (
        <>
          business_type: <b>restaurant</b>
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
      h: "Drop in your details",
      p: "Menu, hours, prices, service list, team names — whatever matters. Our AI absorbs it and writes the replies for you. Edit any answer later.",
      mini: (
        <>
          menu.pdf <b>✓</b> · hours.csv <b>✓</b>
          <br />
          <span style={{ opacity: 0.6 }}>generating 47 replies…</span>
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
    <section id="how" className="py-[110px] bg-[var(--bg-2)] border-y border-[var(--line)]">
      <div className="max-w-[1280px] mx-auto px-7">
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
    <section id="features" className="py-[110px]">
      <div className="max-w-[1280px] mx-auto px-7">
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
    <div className={`${base} ${variantCls}`} style={{ gridColumn: `span ${span} / span ${span}` }}>
      <div className={`zt-mono text-[11px] uppercase tracking-[.08em] ${lblCls}`}>{label}</div>
      <h4 className="text-[22px] font-bold tracking-[-0.022em] mt-2 mb-1.5">{title}</h4>
      {children}
    </div>
  );
}

// ─── Pricing ───
function Pricing() {
  const [annual, setAnnual] = useState(false);
  return (
    <section id="pricing" className="py-[110px] bg-[var(--bg-2)] border-y border-[var(--line)]">
      <div className="max-w-[1280px] mx-auto px-7">
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
            <button
              onClick={() => setAnnual(false)}
              className={`rounded-full font-medium ${!annual ? "bg-[var(--ink)] text-[var(--background)]" : "text-[var(--ink-2)]"}`}
              style={{ padding: "9px 18px" }}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`rounded-full font-medium inline-flex items-center gap-1.5 ${annual ? "bg-[var(--ink)] text-[var(--background)]" : "text-[var(--ink-2)]"}`}
              style={{ padding: "9px 18px" }}
            >
              Annual
              <span className="ml-1.5 px-2 py-[2px] rounded-full bg-[var(--accent)] text-[var(--accent-2)] zt-mono text-[10px] font-bold">
                -15%
              </span>
            </button>
          </div>
          <div className="zt-mono text-[12px] text-[var(--mute)]">
            All prices in ₹INR · GST extra · billed on razorpay
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {PLAN_ORDER.map(({ key, tag }) => {
            const p = PLANS[key];
            const popular = key === "growth";
            const price = annual ? Math.round(p.price * 0.85) : p.price;
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
                  <span className="text-[54px] font-bold tracking-[-0.045em] leading-none">
                    <span className="zt-serif text-[0.7em] mr-0.5">₹</span>
                    {price.toLocaleString("en-IN")}
                  </span>
                  <span className="text-[13px]" style={{ color: popular ? "#ffffff88" : "var(--mute)" }}>
                    / mo{annual ? " · billed yearly" : ""}
                  </span>
                </div>
                <div className="text-[12.5px] mb-5" style={{ color: popular ? "#ffffffcc" : "var(--ink-2)" }}>
                  Setup:{" "}
                  <b className={`${popular ? "text-[var(--accent-2)]" : "text-[var(--ink)]"} bg-[var(--accent)] px-1.5 rounded-[4px] font-bold`}>
                    FREE
                  </b>{" "}
                  <s className="opacity-50">₹{p.originalSetupFee.toLocaleString("en-IN")}</s> · launch offer
                </div>
                <ul className="flex flex-col gap-2.5 flex-1 mb-5">
                  {p.features.map((f, i) => (
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
                  Start {p.name} →
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
    <section className="py-[110px]">
      <div className="max-w-[1280px] mx-auto px-7">
        <div className="grid md:grid-cols-[1.3fr_1fr] gap-12 items-center">
          <div>
            <div className="zt-mono text-[12px] uppercase tracking-[.08em] text-[var(--mute)]">
              {"// 05 — From the field"}
            </div>
            <p className="zt-serif text-[clamp(30px,3.6vw,50px)] leading-[1.08] tracking-[-0.02em] text-balance mt-4">
              &ldquo;Pehle din{" "}
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
                27 missed calls
              </span>{" "}
              WhatsApp pe convert ho gayi.
              <br />
              Saara staff free ho gaya —<br />
              sab bot sambhal raha hai.&rdquo;
            </p>
            <div className="flex items-center gap-3 mt-7 text-[14px]">
              <div className="w-[42px] h-[42px] rounded-full bg-[#D9FDD3] grid place-items-center font-bold">RM</div>
              <div>
                <div className="font-semibold">Rohit Menon</div>
                <div className="text-[var(--mute)]">Menon Fitness, Bengaluru · on ZapText Growth</div>
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
    <section id="faq" className="pb-[110px]">
      <div className="max-w-[1280px] mx-auto px-7">
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
              <a href="#" className="border-b border-[var(--ink)]">
                drop us a message on WhatsApp
              </a>{" "}
              — our own bot will help (meta, we know).
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
    <section className="max-w-[1280px] mx-auto px-7 mt-[60px] mb-[60px]">
      <div className="relative overflow-hidden rounded-[36px] bg-[var(--ink)] text-[var(--background)]" style={{ padding: "80px 56px" }}>
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
              className="inline-flex items-center gap-2 px-7 py-[18px] rounded-[14px] bg-[var(--accent)] text-[var(--accent-2)] font-semibold text-[16px] hover:-translate-y-px transition"
            >
              Get started — ₹0 setup fee <span>→</span>
            </Link>
            <a
              href="#how"
              className="inline-flex items-center gap-2 px-7 py-[18px] rounded-[14px] border border-white/20 text-[var(--background)] font-semibold text-[16px] hover:-translate-y-px transition"
            >
              Book a 15-min walkthrough
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───
function Footer() {
  return (
    <footer className="border-t border-[var(--line)] py-12 text-[14px]">
      <div className="max-w-[1280px] mx-auto px-7">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr] gap-10 mb-14">
          <div>
            <Link href="/" className="flex items-center gap-2.5 font-bold text-[18px] mb-3.5">
              <Mark />
              <span>ZapText</span>
            </Link>
            <p className="text-[var(--ink-2)] max-w-[340px] text-[14px] leading-[1.55]">
              AI WhatsApp bots for Indian small businesses. Built in Bengaluru, deployed across 120+ cities.
            </p>
          </div>
          <FootCol
            title="Product"
            links={[
              { h: "#biz", l: "Business types" },
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
