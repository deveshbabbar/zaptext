import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About Us | ZapText',
  description: 'The team and mission behind ZapText.',
};

export default function AboutPage() {
  return (
    <article className="space-y-8">
      <header className="space-y-3 border-b border-border pb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">About ZapText</h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          Making AI WhatsApp bots accessible for every Indian business.
        </p>
      </header>

      <section className="space-y-4 text-muted-foreground leading-relaxed">
        <h2 className="text-2xl font-bold text-foreground">Our Mission</h2>
        <p>
          Every small business in India deserves a 24/7 assistant that speaks their customers&apos;
          language. Most chatbot platforms are built for Silicon Valley enterprises with enterprise
          budgets. We built ZapText for the kirana owner, the salon manager, the clinic receptionist,
          and the tuition centre in a Tier-2 city — starting at a price that works.
        </p>
      </section>

      <section className="space-y-4 text-muted-foreground leading-relaxed">
        <h2 className="text-2xl font-bold text-foreground">Our Story</h2>
        <p>
          ZapText was founded in 2026 by a small team who watched their parents&apos; businesses
          struggle to reply to WhatsApp enquiries after hours. Existing tools required developers,
          expensive integrations, and English-only training data. We decided to build something
          different — a plug-and-play platform that goes live in minutes, understands Hindi and
          Hinglish natively, and costs less than hiring a part-time employee.
        </p>
      </section>

      <section className="space-y-4 text-muted-foreground leading-relaxed">
        <h2 className="text-2xl font-bold text-foreground">What We Stand For</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-foreground font-bold mb-2">Affordability</h3>
            <p className="text-sm">Plans priced for Indian SMBs, not enterprise IT budgets.</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-foreground font-bold mb-2">Simplicity</h3>
            <p className="text-sm">Fill a form, pick a plan, go live. No code, no consultants.</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-foreground font-bold mb-2">Indian-first</h3>
            <p className="text-sm">Hindi and Hinglish support out of the box, INR pricing, IST support hours.</p>
          </div>
        </div>
      </section>

      <section className="space-y-4 text-muted-foreground leading-relaxed">
        <h2 className="text-2xl font-bold text-foreground">Who We Serve</h2>
        <p>ZapText supports seven business categories with pre-built AI templates:</p>
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
          <li className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground">Restaurants</li>
          <li className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground">Salons &amp; Spas</li>
          <li className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground">Clinics &amp; Doctors</li>
          <li className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground">Retail Stores</li>
          <li className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground">Real Estate</li>
          <li className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground">Education &amp; Tuitions</li>
          <li className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground">Service Providers</li>
        </ul>
      </section>

      <section className="space-y-4 text-muted-foreground leading-relaxed">
        <h2 className="text-2xl font-bold text-foreground">Our Team</h2>
        <p>
          A small but mighty team based in Delhi, working on product, AI, customer success, and
          support. If you email us, a human reads it — and usually the same human replies.
        </p>
      </section>

      <section className="bg-card border border-border rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-foreground">Ready to launch your WhatsApp bot?</h3>
          <p className="text-sm text-muted-foreground">Go live in under 5 minutes.</p>
        </div>
        <Link
          href="/sign-up"
          className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors whitespace-nowrap"
        >
          Get Started
        </Link>
      </section>
    </article>
  );
}
