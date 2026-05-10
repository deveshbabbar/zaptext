import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Us | ZapText',
  description: 'Reach the ZapText support team.',
};

export default function ContactPage() {
  return (
    <article className="space-y-6">
      <header className="space-y-2 border-b border-border pb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Contact Us</h1>
        <p className="text-muted-foreground">
          We&apos;re a small team based in Delhi and we love hearing from our customers.
          Pick whichever channel works best for you.
        </p>
      </header>

      <section className="grid sm:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-6 space-y-2">
          <h2 className="text-lg font-bold text-foreground">Email</h2>
          <p className="text-muted-foreground text-sm">Best for detailed questions, billing, and refunds.</p>
          <a href="mailto:zaptextofficial@gmail.com" className="text-primary hover:underline break-all">
            zaptextofficial@gmail.com
          </a>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-2">
          <h2 className="text-lg font-bold text-foreground">WhatsApp</h2>
          <p className="text-muted-foreground text-sm">
            Try our own bot live &mdash; the chat widget at the bottom-right of every page is powered by ZapText itself.
            For human follow-up, drop a line to the email and we&apos;ll WhatsApp you back the same day.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-2">
          <h2 className="text-lg font-bold text-foreground">Business Hours</h2>
          <p className="text-muted-foreground text-sm">Monday - Saturday</p>
          <p className="text-foreground">10:00 AM - 7:00 PM IST</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-2">
          <h2 className="text-lg font-bold text-foreground">Response Time</h2>
          <p className="text-muted-foreground text-sm">We reply to every message.</p>
          <p className="text-foreground">Within 24 hours on working days</p>
        </div>
      </section>

      <section className="bg-card border border-border rounded-xl p-6 space-y-3">
        <h2 className="text-lg font-bold text-foreground">Registered Business Address</h2>
        <address className="not-italic text-muted-foreground leading-relaxed">
          ZapText<br />
          Delhi NCR, India
        </address>
        <p className="text-sm text-muted-foreground">
          Full registered address and GSTIN are printed on every paid invoice.
          Need them in advance? Email{' '}
          <a href="mailto:zaptextofficial@gmail.com" className="text-primary hover:underline">
            zaptextofficial@gmail.com
          </a>{' '}
          with the subject &quot;Business details&quot; and we&apos;ll respond the same business day.
        </p>
      </section>

      <section className="space-y-3 text-muted-foreground leading-relaxed">
        <h2 className="text-2xl font-bold text-foreground">Other Enquiries</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li><span className="text-foreground">Sales &amp; demos:</span> zaptextofficial@gmail.com with the subject &quot;Demo&quot;.</li>
          <li><span className="text-foreground">Partnerships:</span> zaptextofficial@gmail.com with the subject &quot;Partnership&quot;.</li>
          <li><span className="text-foreground">Privacy / data requests:</span> zaptextofficial@gmail.com with the subject &quot;Privacy&quot;.</li>
          <li><span className="text-foreground">Grievance officer:</span> zaptextofficial@gmail.com with the subject &quot;Grievance&quot;.</li>
        </ul>
      </section>
    </article>
  );
}
