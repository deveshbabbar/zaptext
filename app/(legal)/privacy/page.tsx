import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | ZapText',
  description: 'How ZapText collects, uses, and protects your personal data.',
};

export default function PrivacyPage() {
  return (
    <article className="space-y-6">
      <header className="space-y-2 border-b border-border pb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: April 2026</p>
      </header>

      <section className="space-y-4 text-muted-foreground leading-relaxed">
        <p>
          This Privacy Policy describes how ZapText (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collects, uses,
          stores, and discloses information about you when you use our WhatsApp AI chatbot platform
          at <span className="text-foreground">zaptext.shop</span> and related services (the &quot;Service&quot;).
          We comply with the Digital Personal Data Protection Act, 2023 (DPDP Act) of India.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">1. Who We Are</h2>
        <p>
          ZapText is a Software-as-a-Service platform based in India that provides AI-powered
          WhatsApp chatbots to small and medium businesses. For any privacy questions, contact us
          at <span className="text-foreground">support@zaptext.shop</span>.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">2. Information We Collect</h2>
        <h3 className="text-xl font-semibold text-foreground">Account information</h3>
        <p>
          When you register, we collect your name, email address, phone number, business name,
          business type, and WhatsApp Business number.
        </p>
        <h3 className="text-xl font-semibold text-foreground">Bot configuration data</h3>
        <p>
          Menu items, services, FAQs, pricing, business hours, location, and any other content you
          enter to configure your chatbot.
        </p>
        <h3 className="text-xl font-semibold text-foreground">Payment information</h3>
        <p>
          All payments are processed by Razorpay. We do not store card numbers, UPI IDs, or banking
          credentials. We retain only transaction IDs, amounts, invoice dates, and subscription status.
        </p>
        <h3 className="text-xl font-semibold text-foreground">Conversation data</h3>
        <p>
          We store WhatsApp messages exchanged between your bot and your end customers so that your
          bot can maintain context and you can view conversation history in your dashboard.
        </p>
        <h3 className="text-xl font-semibold text-foreground">Usage and technical data</h3>
        <p>
          IP address, browser type, device information, pages visited, and timestamps. This is used
          to secure the Service and improve performance.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">3. How We Use Your Information</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>To provide, operate, and maintain the Service.</li>
          <li>To process subscriptions and generate invoices.</li>
          <li>To respond to support requests and communicate service-related updates.</li>
          <li>To train and operate the AI logic that powers your bot&apos;s replies.</li>
          <li>To monitor fraud, abuse, and security incidents.</li>
          <li>To produce aggregated, anonymised analytics about Service usage.</li>
        </ul>

        <h2 className="text-2xl font-bold text-foreground pt-4">4. Third-Party Services</h2>
        <p>
          We share limited data with trusted processors strictly to run the Service:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><span className="text-foreground">Google Gemini</span> — to generate AI bot responses.</li>
          <li><span className="text-foreground">Google Sheets / Google Cloud</span> — to store and sync configuration.</li>
          <li><span className="text-foreground">Meta / WhatsApp Business API</span> — to send and receive messages.</li>
          <li><span className="text-foreground">Razorpay</span> — to process subscription payments.</li>
          <li><span className="text-foreground">Brevo</span> — to send transactional and notification emails.</li>
          <li><span className="text-foreground">Clerk</span> — for authentication and session management.</li>
        </ul>
        <p>
          Each processor has its own privacy policy. We do not sell your personal data to any third
          party.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">5. Cookies</h2>
        <p>
          We use essential cookies for authentication and session management, and optional analytics
          cookies to understand Service usage. You can control cookies through your browser settings;
          disabling essential cookies may break sign-in.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">6. Data Storage and Location</h2>
        <p>
          Data is primarily stored in India and on Google Cloud infrastructure, which may replicate
          data across secure facilities. We apply encryption in transit (TLS) and at rest where
          supported by the underlying provider.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">7. Data Retention</h2>
        <p>
          We retain account and configuration data for as long as your subscription is active. After
          cancellation, data is retained for 90 days to allow reactivation, then permanently deleted.
          Invoice records are retained for up to 8 years as required by Indian tax law.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">8. Your Rights</h2>
        <p>Under the DPDP Act, 2023 you have the right to:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Access the personal data we hold about you.</li>
          <li>Request correction of inaccurate data.</li>
          <li>Request deletion of your account and personal data.</li>
          <li>Withdraw consent for optional processing at any time.</li>
          <li>Nominate another person to exercise these rights in the event of your death or incapacity.</li>
          <li>File a grievance with us and, if unresolved, with the Data Protection Board of India.</li>
        </ul>
        <p>
          To exercise any of these rights, email <span className="text-foreground">support@zaptext.shop</span>
          from your registered email address.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">9. Children</h2>
        <p>
          The Service is not directed to children under 18. We do not knowingly collect personal
          data from minors. If you believe a minor has created an account, contact us and we will
          delete it.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">10. Changes to This Policy</h2>
        <p>
          We may update this Policy from time to time. Material changes will be notified by email or
          via a dashboard banner at least 15 days before taking effect. The &quot;Last updated&quot; date at
          the top reflects the latest revision.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">11. Contact Us</h2>
        <p>
          For privacy concerns, data subject requests, or grievances:<br />
          Email: <span className="text-foreground">support@zaptext.shop</span><br />
          Website: <span className="text-foreground">zaptext.shop</span>
        </p>
      </section>
    </article>
  );
}
