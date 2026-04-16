'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { PLANS, type PlanKey } from '@/lib/plans';
import { toast } from 'sonner';

interface Subscription {
  plan: PlanKey;
  status: string;
  amount: number;
  startDate: string;
  endDate: string;
  razorpayPaymentId: string;
  createdAt: string;
}

// ─── Razorpay Types ───

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  prefill: { name: string; email: string };
  theme: { color: string };
}

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

// ─── Component ───

export default function SubscriptionPage() {
  const { user } = useUser();
  const [currentSub, setCurrentSub] = useState<Subscription | null>(null);
  const [history, setHistory] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState<PlanKey | null>(null);

  useEffect(() => {
    loadSubscriptionData();
    loadRazorpayScript();
  }, []);

  async function loadSubscriptionData() {
    try {
      const res = await fetch('/api/client/subscription');
      if (res.ok) {
        const data = await res.json();
        setCurrentSub(data.current);
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error('Failed to load subscription:', err);
    } finally {
      setLoading(false);
    }
  }

  const [razorpayReady, setRazorpayReady] = useState(false);

  function loadRazorpayScript() {
    if (typeof window !== 'undefined' && window.Razorpay) {
      setRazorpayReady(true);
      return;
    }
    if (document.getElementById('razorpay-script')) return;
    const script = document.createElement('script');
    script.id = 'razorpay-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setRazorpayReady(true);
    script.onerror = () => toast.error('Payment system failed to load. Please refresh the page.');
    document.body.appendChild(script);
  }

  async function handleSubscribe(plan: PlanKey) {
    if (!user) return;

    if (!razorpayReady || !window.Razorpay) {
      toast.error('Payment system is still loading. Please wait a moment and try again.');
      return;
    }

    setProcessingPlan(plan);

    try {
      const orderRes = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });

      if (!orderRes.ok) throw new Error('Failed to create order');

      const orderData = await orderRes.json();

      const options: RazorpayOptions = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'ZapText',
        description: `${PLANS[plan].name} Plan - Monthly Subscription`,
        order_id: orderData.orderId,
        handler: async (response: RazorpayResponse) => {
          await verifyPayment(response, plan);
        },
        prefill: {
          name: user.fullName || '',
          email: user.emailAddresses[0]?.emailAddress || '',
        },
        theme: { color: '#25D366' },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error('Payment error:', err);
      toast.error('Failed to initiate payment. Please try again.');
    } finally {
      setProcessingPlan(null);
    }
  }

  async function verifyPayment(response: RazorpayResponse, plan: PlanKey) {
    try {
      const verifyRes = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          plan,
        }),
      });

      if (verifyRes.ok) {
        toast.success('🎉 Payment successful! Your subscription is now active.');
        loadSubscriptionData();
      } else {
        toast.error('Payment verification failed. Please contact support at zaptextofficial@gmail.com');
      }
    } catch (err) {
      console.error('Verification error:', err);
      toast.error('Payment verification failed. Please contact support at zaptextofficial@gmail.com');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Subscription</h1>
        <p className="mt-1 text-muted-foreground">Manage your plan and billing</p>
      </div>

      {/* Current Plan */}
      <section className="p-6 rounded-xl bg-card border border-border">
        <h2 className="text-lg font-semibold text-foreground mb-4">Current Plan</h2>
        {currentSub ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-primary">
                  {PLANS[currentSub.plan]?.name || currentSub.plan}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase">
                  {currentSub.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                &#8377;{currentSub.amount}/mo &middot; Renews on{' '}
                {new Date(currentSub.endDate).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              Bots: {PLANS[currentSub.plan]?.bots || '-'} &middot; Conversations:{' '}
              {PLANS[currentSub.plan]?.conversations === -1 ? 'Unlimited' : PLANS[currentSub.plan]?.conversations || '-'}/mo
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground text-lg">No active plan</p>
            <p className="text-sm text-muted-foreground mt-1">Choose a plan below to get started</p>
          </div>
        )}
      </section>

      {/* Pricing Cards */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-6">
          {currentSub ? 'Upgrade Your Plan' : 'Choose a Plan'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {(Object.entries(PLANS) as [PlanKey, (typeof PLANS)[PlanKey]][]).map(([key, plan]) => {
            const isCurrent = currentSub?.plan === key;
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
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-primary text-primary-foreground text-xs font-bold rounded-full uppercase whitespace-nowrap">
                    Most Popular
                  </div>
                )}
                <h3 className={`text-lg font-bold ${isHighlighted ? 'text-foreground' : 'text-foreground/80'}`}>
                  {plan.name}
                </h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className={`text-3xl font-extrabold ${isHighlighted ? 'text-primary' : 'text-foreground'}`}>
                    &#8377;{plan.price.toLocaleString('en-IN')}
                  </span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <p className="mt-1 text-xs flex items-center gap-1.5 flex-wrap">
                  <span className="text-primary font-semibold">FREE Setup</span>
                  {'originalSetupFee' in plan && plan.originalSetupFee ? (
                    <span className="text-muted-foreground line-through text-[10px]">
                      &#8377;{plan.originalSetupFee.toLocaleString('en-IN')}
                    </span>
                  ) : null}
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
                {isCurrent ? (
                  <div className="mt-6 w-full py-2.5 rounded-xl font-semibold text-sm text-center bg-primary/10 text-primary border border-primary/30">
                    Current Plan
                  </div>
                ) : (
                  <button
                    onClick={() => handleSubscribe(key)}
                    disabled={processingPlan === key}
                    className={`mt-6 w-full py-2.5 rounded-xl font-semibold text-sm transition-colors ${
                      isHighlighted
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20'
                        : 'border border-primary/40 text-primary hover:bg-primary/10'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {processingPlan === key ? 'Processing...' : 'Subscribe'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Payment History */}
      <section className="p-6 rounded-xl bg-card border border-border">
        <h2 className="text-lg font-semibold text-foreground mb-4">Payment History</h2>
        {history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="pb-3 pr-4 font-medium">Date</th>
                  <th className="pb-3 pr-4 font-medium">Plan</th>
                  <th className="pb-3 pr-4 font-medium">Amount</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 font-medium">Payment ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map((sub, idx) => (
                  <tr key={idx} className="text-foreground/80">
                    <td className="py-3 pr-4">
                      {new Date(sub.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 pr-4 capitalize">{sub.plan}</td>
                    <td className="py-3 pr-4">&#8377;{sub.amount}</td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        sub.status === 'active'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-gray-500/10 text-muted-foreground'
                      }`}>
                        {sub.status}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-xs text-muted-foreground">
                      {sub.razorpayPaymentId || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-6">No payment history yet</p>
        )}
      </section>
    </div>
  );
}
