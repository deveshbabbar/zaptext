// ─── Plan Definitions (client-safe, no server-only imports) ───

// Free trial: 50 outbound bot messages (lifetime), FAQ auto-reply only,
// no bookings/payments/orders, 1 bot, no card required.
export const TRIAL_MESSAGE_LIMIT = 50;

export const PLANS = {
  trial: {
    name: 'Free Trial',
    price: 0,
    setupFee: 0,
    originalSetupFee: 0,
    bots: 1,
    numbers: 1,
    conversations: TRIAL_MESSAGE_LIMIT,
    messages: TRIAL_MESSAGE_LIMIT,
    extraBotPrice: null as number | null,
    hidden: true, // not shown in pricing grid — activated via "Start trial" CTA
    features: [
      `${TRIAL_MESSAGE_LIMIT} bot replies (lifetime)`,
      '1 WhatsApp Bot',
      'FAQ auto-reply only',
      'English responses',
      'No credit card required',
      'Upgrade anytime for bookings, payments, multi-language',
    ],
  },
  starter: {
    name: 'Starter',
    price: 2999,
    setupFee: 0,
    originalSetupFee: 4999,
    bots: 1,
    numbers: 1,
    conversations: 500,
    messages: 500,
    extraBotPrice: null as number | null,
    features: [
      '1 WhatsApp Bot',
      '1 WhatsApp number',
      'Up to 500 conversations/month',
      'FAQ handling + auto-reply',
      'Monthly summary report',
      'Email support',
    ],
  },
  growth: {
    name: 'Growth',
    price: 5999,
    setupFee: 0,
    originalSetupFee: 7999,
    bots: 3,
    numbers: 3,
    conversations: -1, // unlimited
    messages: -1,
    extraBotPrice: 1499,
    highlighted: true,
    features: [
      'Up to 3 WhatsApp Bots',
      '3 WhatsApp numbers (locations/departments)',
      'Unlimited conversations',
      'Booking & scheduling system',
      'Client dashboard with analytics',
      'Availability calendar management',
      'Automated reminders + notifications',
      'Daily summary reports',
      'WhatsApp + Email support',
      'Extra bot: ₹1,499/mo',
    ],
  },
  pro: {
    name: 'Pro',
    price: 9999,
    setupFee: 0,
    originalSetupFee: 14999,
    bots: 5,
    numbers: 5,
    conversations: -1,
    messages: -1,
    extraBotPrice: 1299,
    features: [
      'Up to 5 WhatsApp Bots',
      '5 WhatsApp numbers',
      'Everything in Growth',
      'Lead scoring',
      'Escalation alerts',
      'Conversation export',
      'Custom bot personality per number',
      'Monthly strategy call',
      'Priority support (4hr response)',
      'Extra bot: ₹1,299/mo',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    price: 19999,
    setupFee: 0,
    originalSetupFee: 24999,
    bots: 10,
    numbers: 10,
    conversations: -1,
    messages: -1,
    extraBotPrice: 999,
    features: [
      'Up to 10 WhatsApp Bots',
      '10 WhatsApp numbers',
      'Everything in Pro',
      'Dedicated account manager',
      'Custom integrations',
      'API access',
      'White-label option',
      'Weekly optimization calls',
      '99.9% uptime SLA',
      'Extra bot: ₹999/mo',
    ],
  },
} as const;

export type PlanKey = keyof typeof PLANS;

// Subscription duration options.
// 6-month = 5.5× monthly (≈8% off), 12-month = 10× monthly (≈17% off)
export const DURATIONS = {
  1: { months: 1, multiplier: 1, label: '1 month', savingLabel: null as string | null },
  6: { months: 6, multiplier: 5.5, label: '6 months', savingLabel: 'Save ~8%' as string | null },
  12: { months: 12, multiplier: 10, label: '12 months', savingLabel: 'Save ~17%' as string | null },
} as const;

export type DurationKey = keyof typeof DURATIONS;

export function computePlanPrice(plan: PlanKey, months: DurationKey): number {
  return Math.round(PLANS[plan].price * DURATIONS[months].multiplier);
}

export function isDurationKey(v: unknown): v is DurationKey {
  return v === 1 || v === 6 || v === 12;
}

export function isTrialPlan(plan: PlanKey | string | undefined | null): boolean {
  return plan === 'trial';
}
