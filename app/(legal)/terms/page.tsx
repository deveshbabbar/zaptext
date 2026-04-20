import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | ZapText',
  description: 'The terms that govern your use of the ZapText platform, including WhatsApp Business Platform compliance.',
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
          between you (&quot;Customer&quot;, &quot;you&quot;) and ZapText (&quot;we&quot;, &quot;us&quot;).
          You also agree to the <a href="/privacy" className="text-foreground underline">Privacy Policy</a>,
          which is part of these Terms.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">2. What ZapText Is (and Is Not)</h2>
        <p>
          ZapText is a software platform that helps Indian small and medium businesses configure AI
          chatbots that run over the <b>WhatsApp Business Platform</b> (operated by WhatsApp LLC /
          Meta Platforms, Inc.). We provide the tooling; WhatsApp messaging itself is governed by
          Meta&apos;s own terms and policies.
        </p>
        <p className="border-l-4 border-red-400 bg-red-500/5 p-4 rounded">
          <b>ZapText does not provide emergency services.</b> Do not rely on the bot for any
          emergency (medical, fire, crime, or otherwise). For emergencies in India, call 112 (all
          services), 100 (police), 102 (ambulance), or 108 (ambulance/fire). Neither ZapText nor
          the Customer is liable for consequences of using the bot instead of emergency services.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">3. Account Registration</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>You must be at least 18 years old and legally able to enter into contracts in India.</li>
          <li>You must provide accurate, current, and complete information during registration.</li>
          <li>You are responsible for safeguarding your login credentials and for all activity under your account.</li>
          <li>One account per business; creating multiple accounts to evade usage limits is prohibited.</li>
          <li>You must have a separate, valid WhatsApp Business Account (WABA) registered with Meta for each bot.</li>
        </ul>

        <h2 className="text-2xl font-bold text-foreground pt-4">4. Subscription Plans and Billing</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Plans are billed in advance for the selected 1-, 6-, or 12-month duration via Razorpay.</li>
          <li>A free trial of 50 bot replies (lifetime) is available once per account without a card.</li>
          <li>All fees are inclusive or exclusive of GST as indicated at checkout.</li>
          <li>Failed payments may result in suspension of the Service until the balance is cleared.</li>
          <li>Price changes will be communicated at least 30 days in advance and apply on the next billing cycle.</li>
          <li>WhatsApp&apos;s own conversation fees (Meta&apos;s pricing, paise per conversation) are passed through at cost and are separate from ZapText&apos;s subscription fees.</li>
        </ul>

        <h2 className="text-2xl font-bold text-foreground pt-4">5. WhatsApp Business Platform Compliance (You Attest At Onboarding)</h2>
        <p>
          When you create a bot on ZapText, you explicitly attest to each of the following.
          Violations may result in immediate suspension of the Service and your WABA.
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <b>Opt-in consent:</b> You have obtained valid opt-in consent, through a clear and
            affirmative action, from every customer whose phone number will receive messages from
            your bot. You maintain proof of consent and can produce it on request.
          </li>
          <li>
            <b>No unsolicited messages:</b> You will not use the bot to send promotional or bulk
            unsolicited messages to people who have not opted in.
          </li>
          <li>
            <b>Honor opt-outs:</b> You will honor every opt-out request immediately, whether it
            comes in on WhatsApp or through any other channel.
          </li>
          <li>
            <b>Approved templates only outside the 24h window:</b> You will only send
            business-initiated messages (reminders, notifications, etc.) using pre-approved
            WhatsApp Message Templates. Free-form messages are permitted only as a reply within 24
            hours of the customer&apos;s last inbound message.
          </li>
          <li>
            <b>Quality responsibility:</b> You are responsible for the content your bot sends. A
            drop in WhatsApp quality rating (driven by blocks/reports) may cause throttling or a
            WABA ban, for which ZapText is not liable.
          </li>
          <li>
            <b>Meta&apos;s own terms apply:</b> Your WhatsApp usage is also governed by Meta&apos;s
            {' '}<a href="https://www.whatsapp.com/legal/business-terms/" target="_blank" rel="noopener noreferrer" className="text-foreground underline">WhatsApp Business Terms</a>,
            {' '}<a href="https://business.whatsapp.com/policy" target="_blank" rel="noopener noreferrer" className="text-foreground underline">Business Messaging Policy</a>,
            and {' '}<a href="https://www.whatsapp.com/legal/messaging-guidelines" target="_blank" rel="noopener noreferrer" className="text-foreground underline">Messaging Guidelines</a>.
            You must read and comply with all of them.
          </li>
        </ul>

        <h2 className="text-2xl font-bold text-foreground pt-4">6. Prohibited Industries and Content</h2>
        <p>You may not use ZapText for any of the following, whether directly or indirectly:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Healthcare, telemedicine, medical advice, pharmacy, or distribution of health information where regulations prohibit it (the <b>clinic / doctor vertical is not supported</b> on ZapText).</li>
          <li>Firearms, weapons, ammunition, explosives, or any regulated arms.</li>
          <li>Illegal drugs, controlled substances, or unauthorized sale of prescription medication.</li>
          <li>Real, virtual, or speculative currency including cryptocurrencies, tokens, ICOs, and related promotion.</li>
          <li>Online gambling, betting, lotteries, or gaming-for-money.</li>
          <li>Adult / sexually-explicit content or services, dating services, or escort services.</li>
          <li>Tobacco, e-cigarettes, or alcohol (unless you are licensed AND age-gating AND messaging complies with local law).</li>
          <li>Multi-level marketing, payday loans, pyramid schemes, or other predatory financial products.</li>
          <li>Content that is illegal, defamatory, obscene, harassing, hateful, deceptive, or infringes any third-party rights.</li>
          <li>Impersonating another business, government body, or person.</li>
          <li>Any activity prohibited under Indian law, the WhatsApp Business Messaging Policy, or these Terms.</li>
        </ul>

        <h2 className="text-2xl font-bold text-foreground pt-4">7. Your Responsibilities as Data Controller</h2>
        <p>
          For the personal data of <b>your</b> customers that flows through your bot, <b>you are the
          Data Controller</b> and ZapText is the Data Processor, as defined under applicable data
          protection law (including India&apos;s Digital Personal Data Protection Act, 2023 and the
          EU GDPR where applicable). This means:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>You have the lawful basis (including opt-in consent) to collect and send messages.</li>
          <li>You decide what data is processed and for what purpose.</li>
          <li>You respond to end-customer data requests (access, correction, deletion, portability).</li>
          <li>You notify your customers of data breaches when applicable.</li>
          <li>You maintain records of processing activities as required.</li>
        </ul>
        <p>
          ZapText processes data only as instructed by you, stores it in Google Workspace (Sheets)
          and Clerk (authentication), and retains it for up to 90 days after subscription
          termination unless you request earlier deletion.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">8. Use of AI and Accuracy</h2>
        <p>
          The bot uses large language models (currently Google Gemini) to generate replies. AI
          responses can be wrong, outdated, or misleading. You are solely responsible for reviewing
          and correcting what your bot sends. Do not use the bot for any use case where an incorrect
          automated reply could cause real-world harm (medical, legal, financial advice, etc.).
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">9. Acceptable Use</h2>
        <p>You also agree not to:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Reverse-engineer, decompile, scrape, or interfere with the Service.</li>
          <li>Resell, sub-license, or white-label the Service without our prior written agreement.</li>
          <li>Attempt to access data belonging to other customers.</li>
          <li>Circumvent rate limits, payment, or authentication.</li>
          <li>Use the Service to build a substantially similar competing product.</li>
        </ul>

        <h2 className="text-2xl font-bold text-foreground pt-4">10. Intellectual Property</h2>
        <p>
          ZapText, its platform code, designs, UI, prompts, and brand belong to us. You retain
          ownership of the content you upload (menus, product lists, knowledge base) and grant us a
          limited licence to use it solely to operate your bot. We may use aggregated,
          non-identifying usage data to improve the Service.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">11. Suspension and Termination</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>You may cancel anytime from the Subscription page. Access continues until the end of the billed period; no pro-rated refunds unless required by law.</li>
          <li>We may suspend or terminate your account immediately for violation of these Terms, the WhatsApp Business Messaging Policy, or any applicable law.</li>
          <li>On termination, the Service stops, and data is retained for up to 90 days for recovery before permanent deletion from our live systems (backup copies may persist up to 180 days).</li>
        </ul>

        <h2 className="text-2xl font-bold text-foreground pt-4">12. Disclaimers</h2>
        <p className="uppercase text-xs tracking-wide">
          The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties
          of any kind, express or implied. We do not warrant uninterrupted or error-free service,
          accuracy of AI replies, or fitness for any particular purpose. WhatsApp may suspend,
          throttle, or change its API at any time, and we are not liable for such changes.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">13. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, our total aggregate liability to you for any
          claim arising from or relating to the Service is limited to the <b>greater of (a) ₹8,500
          or (b) the total fees you paid to us in the 12 months preceding the event that gave rise
          to the claim</b>. In no event are we liable for indirect, incidental, special,
          consequential, or punitive damages, including lost profits, lost revenue, lost data, or
          business interruption.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">14. Indemnification</h2>
        <p>
          You agree to defend, indemnify, and hold harmless ZapText, its officers, directors,
          employees, and agents from all claims, damages, liabilities, costs, and expenses
          (including reasonable lawyers&apos; fees) arising from or related to: (a) your use of the
          Service; (b) your violation of these Terms or any applicable law; (c) your violation of
          the WhatsApp Business Messaging Policy, Meta&apos;s terms, or any third-party right;
          (d) the content of messages you send through your bot.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">15. Governing Law and Disputes</h2>
        <p>
          These Terms are governed by the laws of India. Courts in Bengaluru, Karnataka have
          exclusive jurisdiction over disputes. You agree to first attempt informal resolution by
          contacting us at <a href="mailto:support@zaptext.shop" className="text-foreground underline">support@zaptext.shop</a>.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">16. Changes to Terms</h2>
        <p>
          We may update these Terms. Material changes will be notified via email or in-product
          banner at least 15 days before taking effect. Continued use after that date is acceptance
          of the revised Terms.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">17. Contact</h2>
        <p>
          Questions? Email <a href="mailto:support@zaptext.shop" className="text-foreground underline">support@zaptext.shop</a>.
        </p>
      </section>
    </article>
  );
}
