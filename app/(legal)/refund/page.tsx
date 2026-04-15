import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Refund Policy | ZapText',
  description: 'How refunds work for ZapText subscriptions.',
};

export default function RefundPage() {
  return (
    <article className="space-y-6">
      <header className="space-y-2 border-b border-border pb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Refund Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: April 2026</p>
      </header>

      <section className="space-y-4 text-muted-foreground leading-relaxed">
        <p>
          We want you to be happy with ZapText. This Refund Policy explains when refunds are
          available, how to request one, and how long they take.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">1. 7-Day Money-Back Guarantee</h2>
        <p>
          First-time subscribers can request a full refund within <span className="text-foreground">7 days</span>
          of their initial payment for any reason. No questions asked.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">2. Refund Processing Time</h2>
        <p>
          Approved refunds are processed through Razorpay and credited to your original payment
          method within <span className="text-foreground">5-7 business days</span>. The exact timing
          depends on your bank or card issuer.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">3. Non-Refundable Charges</h2>
        <p>Refunds are <span className="text-foreground">not</span> available for:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Any renewal payment after the initial 7-day window.</li>
          <li>Partial months or unused days after the 7-day window (no pro-rated refunds).</li>
          <li>Setup fees once setup work has been delivered.</li>
          <li>Add-on services that have already been delivered or consumed.</li>
          <li>Accounts terminated by us for breach of our Terms of Service.</li>
        </ul>

        <h2 className="text-2xl font-bold text-foreground pt-4">4. How to Request a Refund</h2>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Email <span className="text-foreground">support@zaptext.shop</span> from your registered email address.</li>
          <li>Use the subject line &quot;Refund Request - [Your Account Email]&quot;.</li>
          <li>Include your registered name, subscription plan, transaction ID, and a brief reason.</li>
          <li>Our team will acknowledge within 24 hours and confirm refund eligibility within 3 business days.</li>
        </ol>

        <h2 className="text-2xl font-bold text-foreground pt-4">5. Payment Gateway</h2>
        <p>
          All refunds are executed through <span className="text-foreground">Razorpay</span>, our
          authorised payment partner. You will receive a Razorpay confirmation email once the refund
          is initiated. Funds will be returned to the card, UPI account, or wallet originally used.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">6. Dispute Resolution</h2>
        <p>
          If you disagree with a refund decision, reply to our response email and we will escalate
          the matter to a senior team member within 5 business days. Unresolved disputes are subject
          to the governing law and jurisdiction clauses in our Terms of Service.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">7. Contact</h2>
        <p>
          For all refund queries, email <span className="text-foreground">support@zaptext.shop</span>.
        </p>
      </section>
    </article>
  );
}
