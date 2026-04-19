'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { PLANS, DURATIONS, computePlanPrice, type PlanKey, type DurationKey } from '@/lib/plans';
import { toast } from 'sonner';
import { PageTopbar, PageHead, Panel, StatusPill, MonoLabel } from '@/components/app/primitives';

interface Subscription {
  plan: PlanKey;
  status: string;
  amount: number;
  startDate: string;
  endDate: string;
  razorpayPaymentId: string;
  createdAt: string;
}

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
interface RazorpayInstance { open: () => void; }
declare global {
  interface Window { Razorpay: new (options: RazorpayOptions) => RazorpayInstance; }
}

export default function SubscriptionPage() {
  const { user } = useUser();
  const [currentSub, setCurrentSub] = useState<Subscription | null>(null);
  const [history, setHistory] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState<PlanKey | null>(null);
  const [razorpayReady, setRazorpayReady] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState<Record<PlanKey, DurationKey>>({
    starter: 1, growth: 1, pro: 1, enterprise: 1,
  });

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

  async function handleSubscribe(plan: PlanKey, months: DurationKey) {
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
        body: JSON.stringify({ plan, months }),
      });
      if (!orderRes.ok) throw new Error('Failed to create order');
      const orderData = await orderRes.json();
      const razorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!razorpayKey) {
        toast.error('Payment configuration error. Please contact support.');
        return;
      }
      const options: RazorpayOptions = {
        key: razorpayKey,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'ZapText',
        description: `${PLANS[plan].name} Plan · ${DURATIONS[months].label}`,
        order_id: orderData.orderId,
        handler: async (response) => verifyPayment(response, plan, months),
        prefill: {
          name: user.fullName || '',
          email: user.emailAddresses[0]?.emailAddress || '',
        },
        theme: { color: '#14130F' },
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

  async function verifyPayment(response: RazorpayResponse, plan: PlanKey, months: DurationKey) {
    try {
      const verifyRes = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          plan,
          months,
        }),
      });
      if (verifyRes.ok) {
        toast.success('🎉 Payment successful! Subscription active.');
        loadSubscriptionData();
      } else {
        toast.error('Verification failed. Contact support.');
      }
    } catch (err) {
      console.error('Verification error:', err);
      toast.error('Verification failed. Contact support.');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-[var(--ink)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <PageTopbar
        crumbs={
          <>
            <b className="text-foreground">Subscription</b> ·{' '}
            {currentSub ? `${PLANS[currentSub.plan]?.name || currentSub.plan} · active` : 'no plan'}
          </>
        }
      />
      <div style={{ padding: '28px 32px 60px' }} className="max-w-6xl mx-auto flex flex-col gap-6">
        <PageHead
          title={<>Your <span className="zt-serif">plan.</span></>}
          sub="Upgrade, manage, or view billing history."
        />

        <Panel title="Current plan">
          {currentSub ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-[24px] font-bold tracking-[-0.025em]">
                    {PLANS[currentSub.plan]?.name || currentSub.plan}
                  </span>
                  <StatusPill variant={currentSub.status === 'active' ? 'active' : 'ok'}>
                    {currentSub.status}
                  </StatusPill>
                </div>
                <p className="mt-1 text-[13px] text-[var(--mute)]">
                  ₹{currentSub.amount}/mo · Renews on{' '}
                  {new Date(currentSub.endDate).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>
              </div>
              <div className="text-[13px] text-[var(--mute)]">
                Bots: {PLANS[currentSub.plan]?.bots || '-'} · Conversations:{' '}
                {PLANS[currentSub.plan]?.conversations === -1
                  ? 'Unlimited'
                  : PLANS[currentSub.plan]?.conversations || '-'}/mo
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-[15px] text-[var(--mute)]">No active plan</p>
              <p className="text-[13px] text-[var(--mute)] mt-1">Pick a plan below to get started</p>
            </div>
          )}
        </Panel>

        <div>
          <MonoLabel className="mb-4">{currentSub ? '// Upgrade your plan' : '// Choose a plan'}</MonoLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {(Object.entries(PLANS) as [PlanKey, (typeof PLANS)[PlanKey]][]).map(([key, plan]) => {
              const isCurrent = currentSub?.plan === key;
              const highlighted = 'highlighted' in plan && plan.highlighted === true;
              return (
                <div
                  key={key}
                  className={`rounded-[16px] border flex flex-col relative ${
                    isCurrent
                      ? 'bg-[var(--ink)] text-[var(--background)] border-[var(--ink)]'
                      : 'bg-[var(--card)] border-[var(--line)]'
                  }`}
                  style={{ padding: '20px 18px' }}
                >
                  {highlighted && !isCurrent && (
                    <div
                      className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[var(--accent)] text-[var(--accent-2)] zt-mono text-[10.5px] font-bold rounded-full"
                      style={{ padding: '3px 10px' }}
                    >
                      Most popular
                    </div>
                  )}
                  <div
                    className={`zt-mono text-[11.5px] font-semibold uppercase tracking-[.08em] ${
                      isCurrent ? 'text-white/55' : 'text-[var(--mute)]'
                    }`}
                  >
                    {plan.name}
                  </div>
                  <div className="mt-2.5 flex items-baseline gap-1">
                    <span className="text-[36px] font-bold tracking-[-0.03em] leading-none">
                      <span className="zt-serif text-[0.7em]">₹</span>
                      {computePlanPrice(key, selectedMonths[key]).toLocaleString('en-IN')}
                    </span>
                    <span className={`text-[12px] ${isCurrent ? 'text-white/55' : 'text-[var(--mute)]'}`}>
                      / {DURATIONS[selectedMonths[key]].label}
                    </span>
                  </div>
                  {!isCurrent && (
                    <div className="flex gap-1 mt-2">
                      {(Object.keys(DURATIONS) as unknown as DurationKey[]).map((m) => {
                        const months = Number(m) as DurationKey;
                        const active = selectedMonths[key] === months;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setSelectedMonths((prev) => ({ ...prev, [key]: months }))}
                            className={`flex-1 rounded-[8px] border text-[11px] font-semibold transition ${
                              active
                                ? 'bg-[var(--ink)] text-[var(--background)] border-[var(--ink)]'
                                : 'bg-[var(--card)] border-[var(--line)] hover:border-[var(--ink)]'
                            }`}
                            style={{ padding: '6px 4px' }}
                          >
                            {months}M
                            {DURATIONS[months].savingLabel && (
                              <div className="text-[9px] opacity-75 mt-0.5">
                                {DURATIONS[months].savingLabel}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <ul className="flex flex-col gap-1.5 my-3.5 text-[12.5px] list-none p-0 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className={`${isCurrent ? 'text-white/80' : 'text-[var(--ink-2)]'}`}>
                        <span className={`zt-mono mr-1 ${isCurrent ? 'text-[var(--accent)]' : 'text-[var(--mute)]'}`}>
                          →
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <div
                      className="text-center rounded-[10px] border font-semibold text-[12.5px]"
                      style={{
                        padding: 10,
                        background: 'var(--accent)',
                        color: 'var(--accent-2)',
                        borderColor: 'var(--accent)',
                      }}
                    >
                      Current plan
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSubscribe(key, selectedMonths[key])}
                      disabled={processingPlan === key}
                      className="text-center rounded-[10px] border border-[var(--ink)] font-semibold text-[12.5px] hover:bg-[var(--ink)] hover:text-[var(--background)] disabled:opacity-60"
                      style={{ padding: 10 }}
                    >
                      {processingPlan === key ? 'Processing…' : `Subscribe · ${DURATIONS[selectedMonths[key]].label}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <Panel title="Payment history">
          {history.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Date', 'Plan', 'Amount', 'Status', 'Payment ID'].map((h) => (
                      <th
                        key={h}
                        className="zt-mono text-[10.5px] uppercase tracking-[.08em] text-[var(--mute)] font-medium"
                        style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--line)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((sub, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
                        {new Date(sub.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </td>
                      <td className="capitalize" style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
                        {sub.plan}
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>₹{sub.amount}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
                        <StatusPill variant={sub.status === 'active' ? 'active' : 'ok'}>{sub.status}</StatusPill>
                      </td>
                      <td
                        className="zt-mono text-[11.5px] text-[var(--mute)]"
                        style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}
                      >
                        {sub.razorpayPaymentId || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[13px] text-[var(--mute)] text-center py-4 m-0">No payment history yet.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
