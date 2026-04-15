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
          <a href="mailto:support@zaptext.shop" className="text-primary hover:underline break-all">
            support@zaptext.shop
          </a>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-2">
          <h2 className="text-lg font-bold text-foreground">WhatsApp</h2>
          <p className="text-muted-foreground text-sm">Quick chat during business hours.</p>
          <p className="text-foreground font-mono">+91 xxxxx xxxxx</p>
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
          [Your registered address]<br />
          [City], [State] [PIN]<br />
          India
        </address>
        <div className="pt-2 border-t border-border">
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground font-semibold">GSTIN:</span> XXXXXXXXX
          </p>
        </div>
      </section>

      <section className="space-y-3 text-muted-foreground leading-relaxed">
        <h2 className="text-2xl font-bold text-foreground">Other Enquiries</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li><span className="text-foreground">Sales &amp; demos:</span> support@zaptext.shop with the subject &quot;Demo&quot;.</li>
          <li><span className="text-foreground">Partnerships:</span> support@zaptext.shop with the subject &quot;Partnership&quot;.</li>
          <li><span className="text-foreground">Privacy / data requests:</span> support@zaptext.shop with the subject &quot;Privacy&quot;.</li>
          <li><span className="text-foreground">Grievance officer:</span> support@zaptext.shop with the subject &quot;Grievance&quot;.</li>
        </ul>
      </section>
    </article>
  );
}
