import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | ZapText',
  description: 'The terms that govern your use of the ZapText platform.',
};

export default function TermsPage() {
  return (
    <article className="space-y-6">
      <header className="space-y-2 border-b border-border pb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Terms of Service</h1>
        <p className="text-sm text-muted-foreground">Last updated: April 2026</p>
      </header>

      <section className="space-y-4 text-muted-foreground leading-relaxed">
        <h2 className="text-2xl font-bold text-foreground pt-2">1. Acceptance of Terms</h2>
        <p>
          By creating an account or using ZapText (&quot;Service&quot;), you agree to these Terms of
          Service. If you do not agree, do not use the Service. These Terms form a binding contract
          between you (&quot;User&quot;) and ZapText (&quot;we&quot;, &quot;us&quot;).
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">2. Service Description</h2>
        <p>
          ZapText provides AI-powered chatbots that run over the WhatsApp Business API. The
          Service lets you configure automated replies, menus, bookings, and customer-support flows
          without writing code.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">3. Account Registration</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>You must be at least 18 years old and legally able to enter into contracts in India.</li>
          <li>You must provide accurate, current, and complete information during registration.</li>
          <li>You are responsible for safeguarding your login credentials and for all activity under your account.</li>
          <li>One account per business; multiple accounts used to evade usage limits are prohibited.</li>
        </ul>

        <h2 className="text-2xl font-bold text-foreground pt-4">4. Subscription Plans and Billing</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Plans are billed monthly on an auto-renewing basis via Razorpay.</li>
          <li>Prices range from ₹2,999 to ₹19,999 per month depending on the plan chosen.</li>
          <li>All fees are inclusive or exclusive of GST as indicated at checkout.</li>
          <li>Failed payments may result in suspension of the Service until the balance is cleared.</li>
          <li>Price changes will be communicated at least 30 days in advance and apply on the next billing cycle.</li>
        </ul>

        <h2 className="text-2xl font-bold text-foreground pt-4">5. Acceptable Use</h2>
        <p>You agree not to use the Service to:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Send spam, bulk unsolicited messages, or any content that violates WhatsApp&apos;s policies.</li>
          <li>Promote gambling, adult content, drugs, weapons, tobacco, or any product prohibited under Indian law.</li>
          <li>Defraud, harass, defame, or impersonate any person or entity.</li>
          <li>Transmit malware, phishing links, or infringe any intellectual property rights.</li>
          <li>Reverse-engineer, resell, or white-label the Service without written permission.</li>
        </ul>

        <h2 className="text-2xl font-bold text-foreground pt-4">6. WhatsApp and Meta Compliance</h2>
        <p>
          You are solely responsible for complying with Meta&apos;s WhatsApp Business Policy, Commerce
          Policy, and Messaging Policy. Violations may cause Meta to suspend your WhatsApp Business
          number. ZapText is not liable for such suspensions.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">7. Intellectual Property</h2>
        <p>
          The Service, including software, design, trademarks, and documentation, is the exclusive
          property of ZapText. You retain ownership of content and data you upload. You grant us a
          limited, non-exclusive licence to process your content solely to operate the Service.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">8. Service Availability</h2>
        <p>
          We make reasonable efforts to keep the Service available but do not guarantee uninterrupted
          or error-free operation. Scheduled maintenance, third-party outages (WhatsApp, Google,
          Razorpay), and force-majeure events may cause downtime.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">9. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, ZapText&apos;s total aggregate liability to you for
          any claim arising out of the Service is limited to the amount you paid us in the three
          months preceding the claim. We are not liable for indirect, incidental, consequential, or
          loss-of-profit damages.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">10. Indemnification</h2>
        <p>
          You agree to indemnify and hold ZapText, its officers, and employees harmless from any
          claim, loss, or demand arising from your breach of these Terms, your content, or your use
          of the Service in violation of law.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">11. Termination</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>You may cancel your subscription at any time from your dashboard.</li>
          <li>We may suspend or terminate your account immediately for breach of these Terms, illegal activity, or non-payment.</li>
          <li>On termination, your right to use the Service ends; data is retained per our Privacy Policy.</li>
        </ul>

        <h2 className="text-2xl font-bold text-foreground pt-4">12. Governing Law and Jurisdiction</h2>
        <p>
          These Terms are governed by the laws of India. The courts of Delhi shall have exclusive
          jurisdiction over any dispute arising from or relating to the Service.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">13. Changes to Terms</h2>
        <p>
          We may revise these Terms from time to time. Material changes will be notified by email
          and via dashboard banner at least 15 days before taking effect. Continued use of the
          Service after the effective date constitutes acceptance.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">14. Contact</h2>
        <p>
          Questions about these Terms? Email <span className="text-foreground">support@zaptext.shop</span>.
        </p>
      </section>
    </article>
  );
}
