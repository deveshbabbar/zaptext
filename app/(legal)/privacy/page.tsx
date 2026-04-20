import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | ZapText',
  description: 'How ZapText collects, uses, stores, and protects personal data, including WhatsApp conversations and customer data.',
};

export default function PrivacyPage() {
  return (
    <article className="space-y-6">
      <header className="space-y-2 border-b border-border pb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: April 2026</p>
      </header>

      <section className="space-y-4 text-muted-foreground leading-relaxed">
        <h2 className="text-2xl font-bold text-foreground pt-2">1. Overview</h2>
        <p>
          This Privacy Policy explains how ZapText (&quot;we&quot;, &quot;us&quot;) collects,
          uses, shares, retains, and protects personal data when you use our AI WhatsApp bot
          platform at <span className="text-foreground">zaptext.shop</span> and related services
          (the &quot;Service&quot;). ZapText is based in India; our Service complies with India&apos;s
          Digital Personal Data Protection Act, 2023 (DPDP), and we apply comparable protections
          for users outside India.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">2. Two Roles: Controller and Processor</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <b>For our customer accounts</b> (the business owners who sign up at zaptext.shop), we
            act as the <b>Data Controller</b>. We decide what data we collect from you and why.
          </li>
          <li>
            <b>For end-customer data</b> that flows through your bot (your customers&apos; phone
            numbers, messages, booking details), <b>you are the Data Controller and we are the Data
            Processor</b>. We process this data only on your documented instructions to operate
            your bot. You are responsible for lawful basis and responding to end-customer data
            requests.
          </li>
        </ul>

        <h2 className="text-2xl font-bold text-foreground pt-4">3. What We Collect</h2>
        <h3 className="text-lg font-semibold text-foreground pt-2">From you (the account holder)</h3>
        <ul className="list-disc pl-6 space-y-2">
          <li>Name, email, password (via Clerk)</li>
          <li>Business name, address, city, WhatsApp bot number, personal contact number</li>
          <li>Payment details (processed by Razorpay — we store only the payment ID, not card data)</li>
          <li>Product configuration you upload (menu, services, pricing, FAQs)</li>
          <li>Opt-in attestation timestamp for WhatsApp compliance</li>
          <li>Usage logs (IP, user-agent, actions) for security and debugging</li>
        </ul>
        <h3 className="text-lg font-semibold text-foreground pt-2">From your customers (processed on your behalf)</h3>
        <ul className="list-disc pl-6 space-y-2">
          <li>WhatsApp phone number</li>
          <li>Inbound and outbound message text and media</li>
          <li>Booking / order details provided in conversation</li>
          <li>Payment screenshots (for UPI verification), processed and then discarded</li>
        </ul>

        <h2 className="text-2xl font-bold text-foreground pt-4">4. How We Use It</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>To provide the Service: route WhatsApp messages, generate AI replies, manage bookings and orders.</li>
          <li>To bill you via Razorpay and keep your subscription active.</li>
          <li>To send you service notifications, security alerts, and product emails via ZeptoMail (Zoho).</li>
          <li>To debug and improve the platform with aggregated, non-identifying usage data.</li>
          <li>To comply with law and enforce our Terms.</li>
          <li>We do <b>not</b> sell personal data. We do not use your customer conversations to train AI models.</li>
        </ul>

        <h2 className="text-2xl font-bold text-foreground pt-4">5. Sub-processors and Third Parties</h2>
        <p>We share data only with the sub-processors required to operate the Service:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li><b>Clerk</b> (authentication)</li>
          <li><b>Google (Workspace + Sheets + Gemini API)</b> — stores customer/bot data and generates AI replies</li>
          <li><b>Meta / WhatsApp Business Platform</b> — delivers messages to end customers</li>
          <li><b>Razorpay</b> — processes subscription payments</li>
          <li><b>ZeptoMail (Zoho)</b> — sends transactional email</li>
          <li><b>Vercel</b> — hosts the web application</li>
        </ul>
        <p>
          Each sub-processor has its own privacy policy. We select providers that offer comparable
          data-protection commitments.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">6. International Transfer</h2>
        <p>
          Some sub-processors (Vercel, Google, Clerk) may store or process data outside India,
          including in the United States. Where data leaves India, we rely on standard data
          transfer mechanisms and the providers&apos; equivalent safeguards. By using the Service
          you consent to this transfer.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">7. Retention</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li><b>Account + bot configuration:</b> retained while your subscription is active.</li>
          <li><b>Conversation history:</b> retained for 12 months from the message date, then archived.</li>
          <li><b>After subscription termination:</b> data is retained for up to 90 days to allow recovery, then permanently deleted from live systems. Backup copies may persist up to 180 days before being overwritten.</li>
          <li><b>Billing records:</b> retained for 7 years as required under Indian law.</li>
        </ul>

        <h2 className="text-2xl font-bold text-foreground pt-4">8. Your Rights</h2>
        <p>You have the right to:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Access a copy of the personal data we hold about you.</li>
          <li>Correct inaccurate or incomplete data.</li>
          <li>Delete your data (subject to legal retention requirements).</li>
          <li>Restrict or object to specific processing.</li>
          <li>Port your data in a portable format.</li>
          <li>Withdraw consent where consent is the lawful basis — this won&apos;t affect earlier processing.</li>
          <li>Lodge a complaint with the Data Protection Board of India.</li>
        </ul>
        <p>
          To exercise any right, email <a href="mailto:support@zaptext.shop" className="text-foreground underline">support@zaptext.shop</a>. We respond within 30 days.
        </p>
        <p>
          For requests from <b>end customers</b> (i.e., people who messaged a bot on our platform),
          you should contact the <b>business that owns the bot</b> first — they are the Data
          Controller for that data. We will assist them to fulfil your request.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">9. Security</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>TLS encryption in transit for all connections.</li>
          <li>Authentication via Clerk with industry-standard password storage.</li>
          <li>HMAC-SHA256 verification on all inbound WhatsApp webhooks (when configured).</li>
          <li>Timing-safe signature comparison on Razorpay callbacks.</li>
          <li>Rate limiting on sensitive endpoints.</li>
          <li>Admin access is limited and audited.</li>
        </ul>
        <p>
          No security is perfect. If we learn of a material breach affecting your data, we will
          notify you without undue delay as required by law.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">10. Children</h2>
        <p>
          ZapText is for businesses and is not directed at anyone under 18. We do not knowingly
          collect personal data from children. If you believe a minor has signed up, email us and
          we will delete the account.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">11. WhatsApp-specific Notes</h2>
        <p>
          WhatsApp messages between a bot and its end customer are delivered by Meta&apos;s
          WhatsApp Business Platform. Messages routed via the Business API are <b>not</b>
          end-to-end encrypted in the traditional consumer-WhatsApp sense — this is how Meta&apos;s
          platform is designed. We recommend your bot&apos;s welcome message informs customers
          that they are chatting with an AI assistant and not a human.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">12. Cookies</h2>
        <p>
          We use cookies only for essential functions: session authentication (Clerk) and
          active-bot selection. We do not use third-party advertising cookies.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">13. Changes to This Policy</h2>
        <p>
          We may update this policy. Material changes will be notified via email or in-product
          banner at least 15 days before taking effect.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">14. Contact</h2>
        <p>
          For privacy questions, contact our Data Protection point-of-contact at{' '}
          <a href="mailto:support@zaptext.shop" className="text-foreground underline">support@zaptext.shop</a>.
        </p>
      </section>
    </article>
  );
}
