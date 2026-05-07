// ─── Vertical-specific landing page ───
//
// Routes: /tiffin, /salon, /gym, /restaurant, /coaching, /realestate, /d2c
//
// Why: long-tail SEO + ad-funnel. A prospect who Googles "tiffin
// service WhatsApp bot" lands on /tiffin where every word — hero,
// pain points, demo conversation — speaks to their exact business.
// Conversion to signup is 3-4x higher than landing on the generic /.
//
// Pre-renders all 7 verticals at build time via generateStaticParams.
// Unknown slugs (/foobar) hit notFound() instead of breaking the route.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { BUSINESS_TYPES } from '@/lib/constants';
import type { BusinessType } from '@/lib/types';
import { getVerticalContent, VERTICAL_CONTENT } from '@/lib/vertical-content';
import { PLANS } from '@/lib/plans';

const VALID_VERTICALS = Object.keys(VERTICAL_CONTENT) as BusinessType[];

function isValidVertical(s: string): s is BusinessType {
  return (VALID_VERTICALS as string[]).includes(s);
}

export function generateStaticParams() {
  return VALID_VERTICALS.map((vertical) => ({ vertical }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ vertical: string }> }
): Promise<Metadata> {
  const { vertical } = await params;
  if (!isValidVertical(vertical)) {
    return { title: 'ZapText' };
  }
  const copy = getVerticalContent(vertical);
  return {
    title: copy.pageTitle,
    description: copy.metaDescription,
    openGraph: {
      title: copy.pageTitle,
      description: copy.metaDescription,
    },
  };
}

export default async function VerticalLandingPage(
  { params }: { params: Promise<{ vertical: string }> }
) {
  const { vertical } = await params;
  if (!isValidVertical(vertical)) notFound();

  const copy = getVerticalContent(vertical);
  const meta = BUSINESS_TYPES.find((b) => b.type === vertical)!;
  const starter = PLANS.starter;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--ink)]">
      {/* ─── Top bar ─── */}
      <header className="border-b border-[var(--line)]" style={{ padding: '18px 24px' }}>
        <div className="max-w-[1280px] mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 no-underline text-[var(--ink)]">
            <span className="w-8 h-8 rounded-[8px] bg-[var(--accent)] text-[var(--accent-2)] grid place-items-center zt-mono font-extrabold text-[18px]">
              Z
            </span>
            <span className="font-bold tracking-[-0.01em]">ZapText</span>
          </Link>
          <Link
            href="/sign-up"
            className="rounded-[10px] bg-[var(--ink)] text-[var(--background)] font-semibold text-[13px] no-underline hover:-translate-y-px transition"
            style={{ padding: '10px 18px' }}
          >
            Start free →
          </Link>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="py-[80px] md:py-[120px]" style={{ padding: '80px 24px' }}>
        <div className="max-w-[1100px] mx-auto">
          <div className="zt-mono text-[12px] uppercase tracking-[.1em] text-[var(--mute)] mb-3 flex items-center gap-2">
            <span aria-hidden="true">{meta.icon}</span>
            <span>For {meta.label}</span>
          </div>
          <h1 className="text-[44px] md:text-[68px] font-bold tracking-[-0.03em] leading-[1.02] mb-5">
            {copy.hero}
          </h1>
          <p className="text-[17px] md:text-[19px] text-[var(--ink-2)] max-w-[720px] leading-[1.5] mb-8">
            {copy.subHero}
          </p>
          <div className="flex flex-wrap gap-3 items-center">
            <Link
              href="/sign-up"
              className="rounded-[12px] bg-[var(--accent)] text-[var(--accent-2)] font-semibold text-[15px] no-underline hover:-translate-y-px transition"
              style={{ padding: '14px 28px' }}
            >
              {copy.ctaText} →
            </Link>
            <Link
              href="/#pricing"
              className="rounded-[12px] border border-[var(--line)] text-[var(--ink)] font-semibold text-[15px] no-underline hover:border-[var(--ink)] transition"
              style={{ padding: '14px 28px' }}
            >
              See pricing
            </Link>
          </div>
          <div className="zt-mono text-[12px] text-[var(--mute)] mt-5">
            ✓ Free forever plan · ✓ No credit card · ✓ 5-min setup
          </div>
        </div>
      </section>

      {/* ─── Pain points ─── */}
      <section
        className="border-t border-[var(--line)]"
        style={{ padding: '80px 24px', background: 'var(--bg-2)' }}
      >
        <div className="max-w-[1100px] mx-auto">
          <div className="zt-mono text-[12px] uppercase tracking-[.1em] text-[var(--mute)] mb-3">
            // Built for your day
          </div>
          <h2 className="text-[34px] md:text-[44px] font-bold tracking-[-0.025em] leading-[1.1] mb-10">
            What ZapText handles for {meta.label.toLowerCase()}.
          </h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 list-none p-0">
            {copy.painPoints.map((p, i) => (
              <li
                key={i}
                className="bg-[var(--card)] border border-[var(--line)] rounded-[14px] flex gap-3"
                style={{ padding: '18px 20px' }}
              >
                <span
                  className="zt-mono text-[12px] font-bold text-[var(--accent-2)] bg-[var(--accent)] rounded-[6px] flex items-center justify-center shrink-0"
                  style={{ width: 28, height: 28 }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-[15px] text-[var(--ink-2)] leading-[1.55]">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ─── Example conversation ─── */}
      <section style={{ padding: '80px 24px' }}>
        <div className="max-w-[760px] mx-auto">
          <div className="zt-mono text-[12px] uppercase tracking-[.1em] text-[var(--mute)] mb-3 text-center">
            // Real conversation flow
          </div>
          <h2 className="text-[30px] md:text-[40px] font-bold tracking-[-0.025em] leading-[1.1] mb-8 text-center">
            What it looks like on WhatsApp.
          </h2>
          <div
            className="border border-[var(--line)] rounded-[20px] flex flex-col gap-2.5 bg-[var(--bg-2)]"
            style={{ padding: '20px' }}
          >
            {copy.exampleConversation.map((msg, i) => (
              <div
                key={i}
                className={`max-w-[78%] rounded-[14px] text-[14px] leading-[1.5] ${
                  msg.from === 'customer'
                    ? 'self-end bg-[var(--ink)] text-[var(--background)]'
                    : 'self-start bg-[#dcf8c6] text-[#111]'
                }`}
                style={{ padding: '10px 14px' }}
              >
                {msg.text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing teaser ─── */}
      <section
        className="border-t border-[var(--line)]"
        style={{ padding: '80px 24px', background: 'var(--bg-2)' }}
      >
        <div className="max-w-[760px] mx-auto text-center">
          <div className="zt-mono text-[12px] uppercase tracking-[.1em] text-[var(--mute)] mb-3">
            // Pricing
          </div>
          <h2 className="text-[34px] md:text-[44px] font-bold tracking-[-0.025em] leading-[1.1] mb-3">
            Start free. Upgrade when you outgrow it.
          </h2>
          <p className="text-[16px] text-[var(--ink-2)] mb-8">
            Free forever for 50 lifetime AI replies (basic FAQ, English only). When you&apos;re ready
            for bookings, payments, and Hindi/regional bot replies — it&apos;s ₹{starter.price}/mo. No setup
            fees. No card required to start.
          </p>
          <div className="flex flex-wrap gap-3 justify-center items-center">
            <Link
              href="/sign-up"
              className="rounded-[12px] bg-[var(--accent)] text-[var(--accent-2)] font-semibold text-[15px] no-underline hover:-translate-y-px transition"
              style={{ padding: '14px 28px' }}
            >
              {copy.ctaText} →
            </Link>
            <Link
              href="/#pricing"
              className="rounded-[12px] border border-[var(--line)] bg-[var(--background)] font-semibold text-[15px] no-underline hover:border-[var(--ink)] transition"
              style={{ padding: '14px 28px' }}
            >
              Compare all plans
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer
        className="border-t border-[var(--line)] text-[12px] text-[var(--mute)]"
        style={{ padding: '32px 24px' }}
      >
        <div className="max-w-[1100px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>© ZapText. WhatsApp Business Solution Provider.</div>
          <div className="flex gap-4">
            <Link href="/privacy" className="text-[var(--mute)] hover:text-[var(--ink)] no-underline">
              Privacy
            </Link>
            <Link href="/terms" className="text-[var(--mute)] hover:text-[var(--ink)] no-underline">
              Terms
            </Link>
            <Link href="/contact" className="text-[var(--mute)] hover:text-[var(--ink)] no-underline">
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
