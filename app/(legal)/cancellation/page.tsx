import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cancellation Policy | ZapText',
  description: 'How to cancel your ZapText subscription.',
};

export default function CancellationPage() {
  return (
    <article className="space-y-6">
      <header className="space-y-2 border-b border-border pb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Cancellation Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: April 2026</p>
      </header>

      <section className="space-y-4 text-muted-foreground leading-relaxed">
        <p>
          You can cancel your ZapText subscription at any time. This page explains how
          cancellation works and what happens to your data afterwards.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">1. When Cancellation Takes Effect</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Cancellation takes effect at the <span className="text-foreground">end of your current billing cycle</span>.</li>
          <li>Your bot and dashboard remain fully active until that date.</li>
          <li>Auto-renewal is turned off immediately upon cancellation, so no further charges are made.</li>
          <li>No pro-rated refund is issued for the unused portion of the current cycle (see our Refund Policy for the 7-day first-time exception).</li>
        </ul>

        <h2 className="text-2xl font-bold text-foreground pt-4">2. How to Cancel from the Dashboard</h2>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Sign in to your ZapText account.</li>
          <li>Go to <span className="text-foreground">Dashboard &rarr; Subscription</span>.</li>
          <li>Click <span className="text-foreground">Cancel Subscription</span>.</li>
          <li>Confirm cancellation. You will receive an email confirmation.</li>
        </ol>

        <h2 className="text-2xl font-bold text-foreground pt-4">3. How to Cancel by Email</h2>
        <p>
          Alternatively, email <span className="text-foreground">support@zaptext.shop</span> from
          your registered address with the subject &quot;Cancel Subscription&quot;. We will process the
          request within 1 business day and send you a confirmation.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">4. Data Retention After Cancellation</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Your account and bot configuration are retained for <span className="text-foreground">90 days</span> after the subscription ends.</li>
          <li>During this period you can reactivate with a single click, and all settings will be restored.</li>
          <li>After 90 days, all personal data and bot configurations are permanently deleted from our systems.</li>
          <li>Invoice records are retained for up to 8 years as required by Indian tax law.</li>
        </ul>

        <h2 className="text-2xl font-bold text-foreground pt-4">5. Reactivation</h2>
        <p>
          To reactivate within the 90-day window, simply sign in and resubscribe. Your prior bot
          configuration, conversation history, and business details will be restored.
        </p>

        <h2 className="text-2xl font-bold text-foreground pt-4">6. Contact</h2>
        <p>
          Need help cancelling? Email <span className="text-foreground">support@zaptext.shop</span>
          and our team will assist you within 24 hours.
        </p>
      </section>
    </article>
  );
}
