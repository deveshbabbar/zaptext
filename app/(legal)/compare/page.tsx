import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'ZapText vs free WhatsApp AI — full comparison',
  description:
    'Honest comparison: free in-app WhatsApp AI vs ZapText. Bookings, payments, multi-bot, vertical compliance, voice notes, Hindi/regional languages — every feature side-by-side for Indian SMBs.',
  alternates: { canonical: '/compare' },
  openGraph: {
    title: 'ZapText vs free WhatsApp AI — full comparison',
    description:
      'Free WhatsApp AI replies. ZapText earns. Side-by-side for Indian SMBs.',
  },
};

interface Row {
  feature: string;
  freeBot: string | { text: string; ok: boolean };
  zapText: string | { text: string; ok: boolean };
  note?: string;
}

const SECTIONS: { name: string; rows: Row[] }[] = [
  {
    name: 'Conversation handling',
    rows: [
      {
        feature: 'Reply 24/7 to FAQs',
        freeBot: { text: 'Yes', ok: true },
        zapText: { text: 'Yes', ok: true },
      },
      {
        feature: 'Hindi · English · Hinglish · regional Indian languages',
        freeBot: { text: 'Indian languages — generic', ok: true },
        zapText: { text: 'Auto-detects + matches the customer\'s exact register (formal vs casual)', ok: true },
      },
      {
        feature: 'Voice-note from customer (sabziwala-style audio messages)',
        freeBot: { text: 'No — text only', ok: false },
        zapText: { text: 'Transcribes + replies in their language', ok: true },
      },
      {
        feature: 'Owner can take over the chat anytime',
        freeBot: { text: 'Yes (in-app)', ok: true },
        zapText: { text: 'Yes (web dashboard, any device)', ok: true },
      },
      {
        feature: 'Refuse alcohol / tobacco / supplements / gambling automatically',
        freeBot: { text: 'Owner has to configure manually', ok: false },
        zapText: { text: 'Hard-blocked — saves your WABA from a policy strike', ok: true },
      },
    ],
  },
  {
    name: 'Sales + bookings (where revenue actually moves)',
    rows: [
      {
        feature: 'Book an appointment / table / class slot',
        freeBot: { text: 'Forwards to a manual flow', ok: false },
        zapText: { text: 'Books in your calendar with the right staff member, sends reminder', ok: true },
      },
      {
        feature: 'Send Razorpay / UPI payment link inside chat',
        freeBot: { text: 'UPI within chat (rolling out, India only)', ok: true },
        zapText: { text: 'Razorpay + UPI link with order amount auto-filled, payment status tracked', ok: true },
      },
      {
        feature: 'Recurring orders (monthly tiffin, weekly groceries, daily milk)',
        freeBot: { text: 'No', ok: false },
        zapText: { text: 'Built-in — pause, skip, prorate, auto-renew', ok: true },
      },
      {
        feature: 'Abandoned cart / appointment-no-show recovery',
        freeBot: { text: 'No', ok: false },
        zapText: { text: 'Automated 1h / 24h / 7d follow-ups with discount nudge', ok: true },
      },
      {
        feature: 'Inventory + live stock check before confirming order',
        freeBot: { text: 'Reads catalog only', ok: false },
        zapText: { text: 'Refuses to confirm out-of-stock items, suggests alternates', ok: true },
      },
    ],
  },
  {
    name: 'Scale (when one number isn\'t enough)',
    rows: [
      {
        feature: 'Multiple WhatsApp numbers (chains, branches, brand-fronts)',
        freeBot: { text: '1 number per phone (in-app limit)', ok: false },
        zapText: { text: 'Unlimited bots / numbers — one per outlet, one per brand', ok: true },
      },
      {
        feature: 'Multi-staff inbox (5 employees can handle chats)',
        freeBot: { text: 'Single user (in-app)', ok: false },
        zapText: { text: 'Web dashboard, role-based access, chat assignment', ok: true },
      },
      {
        feature: 'Per-branch analytics (which outlet converts best?)',
        freeBot: { text: 'No', ok: false },
        zapText: { text: 'Yes — branch leaderboard, top questions, missed leads', ok: true },
      },
      {
        feature: 'Cloud-kitchen multi-brand routing (Rebel / Charcoal Eats)',
        freeBot: { text: 'No', ok: false },
        zapText: { text: 'One number, multiple brand-fronts — bot picks the right brand', ok: true },
      },
    ],
  },
  {
    name: 'Industry depth (the details a generic bot doesn\'t see)',
    rows: [
      {
        feature: 'Tiffin: roti count, oil type, ghee type, egg policy',
        freeBot: { text: 'Generic catalog read', ok: false },
        zapText: { text: 'Per-plan structured fields — bot quotes precisely', ok: true },
      },
      {
        feature: 'Salon: bridal multi-day pricing + mehendi per-pair',
        freeBot: { text: 'Generic packages', ok: false },
        zapText: { text: 'Haldi / mehendi / sangeet / wedding / reception per-event prices', ok: true },
      },
      {
        feature: 'Gym: EMS pacemaker / pregnancy hard-block',
        freeBot: { text: 'May say yes — liability on you', ok: false },
        zapText: { text: 'Refuses booking, redirects to consult — saves you a lawsuit', ok: true },
      },
      {
        feature: 'Coaching: Rajasthan Coaching Bill rank-claim block',
        freeBot: { text: 'May fabricate "100% selection" claims', ok: false },
        zapText: { text: 'Refuses guaranteed-rank language; quotes only your uploaded proofs', ok: true },
      },
      {
        feature: 'Real estate: RERA QR auto-injection in every reply',
        freeBot: { text: 'No', ok: false },
        zapText: { text: 'Mandatory RERA + project number injected on every property mention', ok: true },
      },
      {
        feature: 'Restaurant: FSSAI license, jain certification, allergen disclosure',
        freeBot: { text: 'Read from profile if owner adds', ok: false },
        zapText: { text: 'Structured per-item fields, FSSAI-style allergen tags, dietary flags', ok: true },
      },
      {
        feature: 'Grocery: daily-mandi paste-and-go list parser',
        freeBot: { text: 'Static catalog only', ok: false },
        zapText: { text: 'Owner pastes "tamatar 40, pyaaz 35, lemon 5/piece" — bot parses + quotes', ok: true },
      },
    ],
  },
  {
    name: 'Owner control + customisation',
    rows: [
      {
        feature: 'Custom AI personality (your brand voice, not a generic tone)',
        freeBot: { text: 'Limited — trained on profile / catalog', ok: false },
        zapText: { text: 'Own system prompt, sub-type-aware tone (dhaba vs fine-dine vs kids salon)', ok: true },
      },
      {
        feature: 'Per-vertical sub-type (eggless bakery vs custom-cake vs ice-cream parlour)',
        freeBot: { text: 'No', ok: false },
        zapText: { text: '20+ restaurant sub-types · 17 salon · 23 coaching · 18 gym · 16 grocery', ok: true },
      },
      {
        feature: 'Per-bot welcome menu (interactive list with first-message options)',
        freeBot: { text: 'Generic auto-greeting', ok: false },
        zapText: { text: 'Vertical-aware menu (Browse menu / Book / Track / Talk to staff)', ok: true },
      },
      {
        feature: 'Restaurant: QR-table dine-in ordering (scan QR → WhatsApp → menu link → order to kitchen)',
        freeBot: { text: 'No — diners ask the waiter', ok: false },
        zapText: { text: 'Per-table QRs, rotating shift tokens, live tables dashboard, bilingual EN+Hinglish flow (Growth+)', ok: true },
      },
      {
        feature: 'Public API access — wire ZapText into your CRM / ERP / accounting',
        freeBot: { text: 'No', ok: false },
        zapText: { text: 'REST API on Scale + Enterprise tiers', ok: true },
      },
      {
        feature: 'White-label (hide ZapText branding, run as your own brand)',
        freeBot: { text: 'No (it\'s the default platform)', ok: false },
        zapText: { text: 'Available on Scale + Enterprise', ok: true },
      },
    ],
  },
  {
    name: 'Compliance + business safety',
    rows: [
      {
        feature: 'WhatsApp Business Policy automatic content filter',
        freeBot: { text: 'Generic content moderation', ok: true },
        zapText: { text: 'Layered: alcohol, tobacco, supplements, gambling, weapons, live-animals — all hard-blocked', ok: true },
      },
      {
        feature: 'DPDPA Section 9 — verifiable parental consent flow for under-18',
        freeBot: { text: 'No specific support', ok: false },
        zapText: { text: 'Coaching / kids\' flows ask for parent\'s WhatsApp before storing minor\'s data', ok: true },
      },
      {
        feature: 'GST-inclusive price display + GST invoice auto-emailed',
        freeBot: { text: 'Owner has to handle separately', ok: false },
        zapText: { text: 'Built-in', ok: true },
      },
      {
        feature: 'Razorpay / Cashfree / PhonePe / Paytm payment partner choice',
        freeBot: { text: 'UPI inside chat (single rail)', ok: true },
        zapText: { text: 'Multiple PG support — pick whichever you already use', ok: true },
      },
    ],
  },
  {
    name: 'Pricing reality',
    rows: [
      {
        feature: 'Cost (post-launch period)',
        freeBot: { text: 'Currently free for eligible businesses; paid tiers expected later', ok: true },
        zapText: { text: 'Free trial (100 replies). Then ₹599/mo Starter, ₹1,499 Growth, ₹3,999 Scale', ok: true },
        note: 'Free is a launch-period strategy. Historical pattern: WABA itself was free in 2018, started charging per-conversation later.',
      },
      {
        feature: 'Hidden costs',
        freeBot: { text: 'WhatsApp conversation fees (₹0.20–₹0.80 per session)', ok: false },
        zapText: { text: 'Same WhatsApp fees pass-through (Meta\'s pricing, no markup)', ok: true },
      },
    ],
  },
];

function Cell({ value }: { value: Row['freeBot'] }) {
  if (typeof value === 'string') {
    return <span className="text-sm text-muted-foreground leading-snug">{value}</span>;
  }
  return (
    <div className="flex items-start gap-2">
      <span
        aria-hidden
        className={`inline-flex shrink-0 mt-[3px] h-4 w-4 rounded-full text-[10px] items-center justify-center font-bold ${
          value.ok ? 'bg-emerald-500/15 text-emerald-700' : 'bg-red-500/10 text-red-600'
        }`}
      >
        {value.ok ? '✓' : '×'}
      </span>
      <span className={`text-sm leading-snug ${value.ok ? 'text-foreground' : 'text-muted-foreground'}`}>{value.text}</span>
    </div>
  );
}

export default function ComparePage() {
  return (
    <article className="space-y-10">
      <header className="space-y-4 border-b border-border pb-8">
        <div className="text-xs uppercase tracking-[.1em] text-muted-foreground font-mono">
          // Side-by-side comparison
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold text-foreground tracking-tight leading-[1.05]">
          Free in-app AI vs ZapText.<br />
          <span className="text-muted-foreground">Honest. Item by item.</span>
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl">
          A free AI helper for businesses inside the WhatsApp Business app is great &mdash; for FAQs. But Indian businesses don&apos;t grow from FAQs. They grow from booked slots, paid orders, repeat customers, and a bot that <i>doesn&apos;t embarrass them in front of a regulator</i>. Here&apos;s a clean, honest read on where each tool fits.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-foreground text-background font-semibold text-sm hover:opacity-90 transition"
          >
            Try ZapText free →
          </Link>
          <Link
            href="/#pricing"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-border font-semibold text-sm hover:border-foreground transition"
          >
            See pricing
          </Link>
        </div>
      </header>

      {SECTIONS.map((section) => (
        <section key={section.name} className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            {section.name}
          </h2>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="hidden sm:grid grid-cols-[1.4fr_1fr_1.2fr] text-xs uppercase tracking-[.06em] font-mono text-muted-foreground border-b border-border">
              <div className="px-4 py-3">Feature</div>
              <div className="px-4 py-3 border-l border-border">Free in-app AI</div>
              <div className="px-4 py-3 border-l border-border bg-emerald-500/5 text-foreground font-semibold">
                ZapText
              </div>
            </div>
            {section.rows.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1.2fr] border-b border-border last:border-b-0"
              >
                <div className="px-4 py-4 text-sm text-foreground font-medium leading-snug">
                  {row.feature}
                </div>
                <div className="px-4 py-4 sm:border-l border-border">
                  <Cell value={row.freeBot} />
                </div>
                <div className="px-4 py-4 sm:border-l border-border bg-emerald-500/[0.04]">
                  <Cell value={row.zapText} />
                </div>
                {row.note && (
                  <div className="sm:col-span-3 px-4 pb-3 text-xs text-muted-foreground italic border-t border-dashed border-border">
                    {row.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-4">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">
          When the free in-app bot is the right call
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
          We&apos;ll be straight with you. If you&apos;re a solo seller with one WhatsApp number, no team to manage, no bookings to schedule, no payment links to send, no compliance regulator looking over your shoulder, and you just want a basic auto-responder to handle &ldquo;kya rate hai?&rdquo; while you&apos;re busy &mdash; <b>the free in-app AI is genuinely good for that</b>. Use it. We mean it.
        </p>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
          ZapText is for the moment your business outgrows that. When you open a second outlet. When you start running broadcast campaigns and need opt-in management. When a regulator asks for your RERA / FSSAI / Coaching Act registration on your bot replies. When a customer&apos;s voice note arrives in Marathi and the bot needs to actually understand it. When a wedding party books your whole bridal team for 4 days and the price needs to compose across haldi, mehendi, sangeet, wedding, and reception.
        </p>
        <p className="text-sm sm:text-base text-foreground font-medium leading-relaxed">
          That&apos;s the line. On one side: a free FAQ assistant. On the other: a bot that&apos;s actually doing your sales job for you.
        </p>
        <div className="flex flex-wrap gap-3 pt-3">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-foreground text-background font-semibold text-sm hover:opacity-90 transition"
          >
            Try free — first 100 replies on us →
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-border font-semibold text-sm hover:border-foreground transition"
          >
            Talk to us first
          </Link>
        </div>
      </section>

      <section className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <h2 className="text-base font-semibold text-foreground">Common questions</h2>
        <details className="bg-card border border-border rounded-xl px-4 py-3 cursor-pointer">
          <summary className="font-medium text-foreground">
            Will the free in-app AI stay free forever?
          </summary>
          <p className="mt-3">
            Probably not. WhatsApp Business API itself was free in 2018 and started charging per-conversation in 2022. Free is usually how a platform seeds adoption before introducing tiered pricing. We&apos;re sharing this so you plan accordingly &mdash; not to scare you off the free tier today.
          </p>
        </details>
        <details className="bg-card border border-border rounded-xl px-4 py-3 cursor-pointer">
          <summary className="font-medium text-foreground">
            Can I use both? Free in-app for FAQs and ZapText for bookings?
          </summary>
          <p className="mt-3">
            Technically yes, but a single WhatsApp number can have only one webhook destination at a time. Pick the bot that owns the customer experience. For most growing businesses, that&apos;s the one that books and collects, not the one that just answers.
          </p>
        </details>
        <details className="bg-card border border-border rounded-xl px-4 py-3 cursor-pointer">
          <summary className="font-medium text-foreground">
            Will ZapText also break my WhatsApp account?
          </summary>
          <p className="mt-3">
            No &mdash; ZapText runs on the official WhatsApp Cloud API as a Business Solution Provider. Your number is registered under WhatsApp Business Platform, the same legal lane the in-app AI uses. We add layered content filtering on top so prompt-injection attacks can&apos;t make your bot recommend alcohol or supplements.
          </p>
        </details>
        <details className="bg-card border border-border rounded-xl px-4 py-3 cursor-pointer">
          <summary className="font-medium text-foreground">
            What if I&apos;m a single-employee biz that just wants &ldquo;works while I&apos;m busy&rdquo;?
          </summary>
          <p className="mt-3">
            Honestly &mdash; try the free in-app option first. You don&apos;t need ZapText yet. We&apos;ll be here when you open the second outlet, or when a regulator asks about your RERA number, or when your bridal calendar fills up four months ahead and you need slot logic the in-app bot doesn&apos;t have.
          </p>
        </details>
      </section>
    </article>
  );
}
