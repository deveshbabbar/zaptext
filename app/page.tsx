import { getUserRole } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { BUSINESS_TYPES } from '@/lib/constants';
import { PLANS, type PlanKey } from '@/lib/plans';
import Link from 'next/link';
import Image from 'next/image';

export default async function Home() {
  const user = await getUserRole();
  if (user?.role === 'admin') redirect('/admin/dashboard');
  if (user?.role === 'client') redirect('/client/dashboard');

  return <LandingPage />;
}

// ─── Landing Page Component ───

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="ZapText" width={36} height={36} className="rounded-lg" />
            <span className="text-xl font-bold">ZapText</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#business-types" className="hover:text-foreground transition-colors">Business Types</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </div>
          <Link
            href="/sign-in"
            className="px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Powered by AI + WhatsApp Business API
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight max-w-4xl mx-auto">
            AI-Powered WhatsApp Bots{' '}
            <span className="text-primary">for Every Business</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Automate customer support, bookings, and sales on WhatsApp.
            Set up your AI chatbot in minutes -- no coding required.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/sign-in"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-lg hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              Get Started Free
            </Link>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl border border-border text-foreground font-semibold text-lg hover:bg-muted transition-colors"
            >
              See How It Works
            </a>
          </div>
          <div className="mt-16 flex items-center justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              No coding needed
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              5-minute setup
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              24/7 automated
            </div>
          </div>
        </div>
      </section>

      {/* Business Types Section */}
      <section id="business-types" className="py-24 bg-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold">
              Built for <span className="text-primary">Every Business</span>
            </h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
              Pre-configured AI bots tailored for your industry. Pick your type and go live instantly.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {BUSINESS_TYPES.map((bt) => (
              <div
                key={bt.type}
                className={`group p-6 rounded-xl border ${bt.borderColor} ${bt.bgColor} hover:scale-[1.03] transition-all duration-200 cursor-default`}
              >
                <div className="text-4xl mb-4">{bt.icon}</div>
                <h3 className={`text-lg font-bold ${bt.color}`}>{bt.label}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{bt.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold">
              Go Live in <span className="text-primary">3 Simple Steps</span>
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              From sign-up to live WhatsApp bot in under 5 minutes.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Sign Up',
                desc: 'Create your account and choose your business type. We handle the WhatsApp Business API setup.',
                icon: (
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                ),
              },
              {
                step: '02',
                title: 'Configure Your Bot',
                desc: 'Fill in your business details, menu, services, and FAQs. Our AI creates your perfect chatbot.',
                icon: (
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                ),
              },
              {
                step: '03',
                title: 'Go Live!',
                desc: 'Your AI bot starts handling customer messages instantly. Track conversations from your dashboard.',
                icon: (
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                ),
              },
            ].map((item) => (
              <div
                key={item.step}
                className="relative p-8 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors"
              >
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-6">
                  {item.icon}
                </div>
                <div className="absolute top-6 right-6 text-5xl font-black text-foreground/[0.04]">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold">
              Simple, Transparent <span className="text-primary">Pricing</span>
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Start free, upgrade when you need more power.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {(Object.entries(PLANS) as [PlanKey, (typeof PLANS)[PlanKey]][]).map(([key, plan]) => {
              const isHighlighted = 'highlighted' in plan && plan.highlighted === true;
              return (
                <div
                  key={key}
                  className={`relative p-6 rounded-xl flex flex-col ${
                    isHighlighted
                      ? 'bg-primary/5 border-2 border-primary'
                      : 'bg-card border border-border'
                  }`}
                >
                  {isHighlighted && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full uppercase tracking-wide whitespace-nowrap">
                      Most Popular
                    </div>
                  )}
                  <h3 className={`text-lg font-bold ${isHighlighted ? 'text-foreground' : 'text-foreground/80'}`}>
                    {plan.name}
                  </h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className={`text-4xl font-extrabold ${isHighlighted ? 'text-primary' : ''}`}>
                      &#8377;{plan.price.toLocaleString('en-IN')}
                    </span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <p className="mt-2 text-sm flex items-center gap-1.5 flex-wrap">
                    <span className="text-primary font-semibold">FREE Setup</span>
                    {'originalSetupFee' in plan && plan.originalSetupFee ? (
                      <span className="text-muted-foreground line-through text-xs">
                        &#8377;{plan.originalSetupFee.toLocaleString('en-IN')}
                      </span>
                    ) : null}
                    <span className="text-xs text-primary/70">· Launch Offer</span>
                  </p>
                  <ul className="mt-6 space-y-2.5 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-foreground/80">
                        <svg className="w-4 h-4 text-primary shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/sign-in"
                    className={`mt-6 block text-center py-3 rounded-xl font-semibold transition-colors ${
                      isHighlighted
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20'
                        : 'border border-primary/40 text-primary hover:bg-primary/10'
                    }`}
                  >
                    Get Started
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <Image src="/logo.png" alt="ZapText" width={32} height={32} className="rounded-lg" />
              <span className="text-lg font-bold">ZapText</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <Link href="/privacy" className="hover:text-foreground/80 transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-foreground/80 transition-colors">Terms</Link>
              <Link href="/refund" className="hover:text-foreground/80 transition-colors">Refund</Link>
              <Link href="/cancellation" className="hover:text-foreground/80 transition-colors">Cancellation</Link>
              <Link href="/contact" className="hover:text-foreground/80 transition-colors">Contact</Link>
              <Link href="/about" className="hover:text-foreground/80 transition-colors">About</Link>
            </div>
            <p className="text-sm text-muted-foreground/70">
              &copy; 2026 ZapText. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
