// ─── Plan Definitions (client-safe, no server-only imports) ───
//
// Pricing strategy (May 2026):
//   Free → Starter ₹599 → Growth ₹1,499 → Scale ₹3,999 → Enterprise ₹9,999
//   Starter undercuts the cheapest peer (Gallabox ₹999) by 40%; Enterprise
//   targets agencies and >100-staff verticals (logistics, hospital chains).
//
// Each plan exposes a `features` flag map — feature-gates.ts is the single
// source of truth that webhook/booking/payment paths consult to decide
// whether a code path is permitted. Adding a new feature = add a flag here
// + check it in the relevant code path. Never branch on plan name directly.

// Free tier — 50 lifetime AI replies. No card required, instant on signup.
export const TRIAL_MESSAGE_LIMIT = 50;

// Feature flag keys consumed by feature-gates.ts. Add a new entry and a
// matching column in the PLANS table below to extend the matrix.
export type FeatureKey =
  | 'bookings'              // booking + slot calendar
  | 'payments'              // UPI / Razorpay payment requests
  | 'multi_language'        // Hindi / Tamil / etc. AI replies (English-only on free)
  | 'welcome_menu'          // first-message interactive list
  | 'broadcasts'            // outbound marketing template campaigns
  | 'custom_system_prompt'  // owner-edited system prompt
  | 'live_takeover'         // human takeover via dashboard
  | 'staff_management'      // multi-staff with per-trainer calendar
  | 'inventory'             // products/services catalog
  | 'api_access'            // public API for owner to call
  | 'whatsapp_flows'        // WhatsApp Flows (forms inside chat)
  | 'white_label'           // hide ZapText branding
  | 'dedicated_csm'         // dedicated customer success manager
  | 'custom_integrations'   // bespoke integrations (CRM, ERP, custom)
  | 'sla_uptime';           // 99.9% uptime SLA contract

interface PlanDef {
  name: string;
  price: number;          // INR per month (base, before duration multiplier)
  setupFee: number;
  originalSetupFee: number;
  bots: number;           // -1 = unlimited
  numbers: number;        // -1 = unlimited
  // monthly AI-reply cap. trial uses TRIAL_MESSAGE_LIMIT as a LIFETIME cap;
  // paid plans treat this as a per-calendar-month cap (resets on the 1st).
  messages: number;
  // For backwards-compat with subscription/page.tsx UI which already reads
  // `conversations`. Keep numerically identical to `messages`.
  conversations: number;
  // Marketing broadcast contact cap per month. -1 = unlimited.
  broadcastContactsPerMonth: number;
  // Number of broadcast campaigns allowed per month. -1 = unlimited.
  broadcastCampaignsPerMonth: number;
  extraBotPrice: number | null;
  highlighted?: boolean;  // for the pricing UI
  features: Record<FeatureKey, boolean>;
  // Human-readable bullet list shown in the pricing card.
  featureList: string[];
}

export const PLANS = {
  // ── Free / trial ─────────────────────────────────────────────────────
  trial: {
    name: 'Free',
    price: 0,
    setupFee: 0,
    originalSetupFee: 0,
    bots: 1,
    numbers: 1,
    messages: TRIAL_MESSAGE_LIMIT,
    conversations: TRIAL_MESSAGE_LIMIT,
    broadcastContactsPerMonth: 0,
    broadcastCampaignsPerMonth: 0,
    extraBotPrice: null,
    features: {
      bookings: false,
      payments: false,
      multi_language: false,
      welcome_menu: true,
      broadcasts: false,
      custom_system_prompt: false,
      live_takeover: false,
      staff_management: false,
      inventory: false,
      api_access: false,
      whatsapp_flows: false,
      white_label: false,
      dedicated_csm: false,
      custom_integrations: false,
      sla_uptime: false,
    },
    featureList: [
      `${TRIAL_MESSAGE_LIMIT} bot replies (lifetime)`,
      '1 WhatsApp bot, 1 number',
      'Basic FAQ auto-reply (English only)',
      'Welcome menu for first-time customers',
      'No credit card required',
      'Upgrade anytime for bookings, payments, Hindi',
    ],
  },

  // ── Starter ₹599/mo ──────────────────────────────────────────────────
  // Customer-acquisition tier — undercuts Gallabox ₹999 / AiSensy ₹1,500.
  starter: {
    name: 'Starter',
    price: 599,
    setupFee: 0,
    originalSetupFee: 999,
    bots: 1,
    numbers: 1,
    messages: 2000,
    conversations: 2000,
    broadcastContactsPerMonth: 500,
    broadcastCampaignsPerMonth: 1,
    extraBotPrice: null,
    features: {
      bookings: true,
      payments: true,
      multi_language: true,
      welcome_menu: true,
      broadcasts: true,
      custom_system_prompt: false,
      live_takeover: true,
      staff_management: true,
      inventory: true,
      api_access: false,
      whatsapp_flows: false,
      white_label: false,
      dedicated_csm: false,
      custom_integrations: false,
      sla_uptime: false,
    },
    featureList: [
      '2,000 AI replies / month',
      '1 WhatsApp bot, 1 number',
      'Bookings + appointment calendar',
      'UPI / Razorpay payment requests',
      'Hindi + English replies',
      'Live chat takeover from dashboard',
      'Welcome menu + opt-in flows',
      '1 broadcast / month, up to 500 contacts',
      'Email support',
      'Overage: ₹0.15 per extra reply',
    ],
  },

  // ── Growth ₹1,499/mo ─────────────────────────────────────────────────
  growth: {
    name: 'Growth',
    price: 1499,
    setupFee: 0,
    originalSetupFee: 2999,
    bots: 3,
    numbers: 3,
    messages: 10000,
    conversations: 10000,
    broadcastContactsPerMonth: 5000,
    broadcastCampaignsPerMonth: -1,
    extraBotPrice: 999,
    highlighted: true,
    features: {
      bookings: true,
      payments: true,
      multi_language: true,
      welcome_menu: true,
      broadcasts: true,
      custom_system_prompt: true,
      live_takeover: true,
      staff_management: true,
      inventory: true,
      api_access: false,
      whatsapp_flows: false,
      white_label: false,
      dedicated_csm: false,
      custom_integrations: false,
      sla_uptime: false,
    },
    featureList: [
      '10,000 AI replies / month',
      'Up to 3 bots, 3 numbers',
      'Everything in Starter',
      'Custom system prompt (own bot personality)',
      'Unlimited broadcasts, up to 5,000 contacts/mo',
      'Daily summary reports',
      'WhatsApp + Email support',
      'Extra bot: ₹999/mo',
      'Overage: ₹0.13 per extra reply',
    ],
  },

  // ── Scale ₹3,999/mo ──────────────────────────────────────────────────
  scale: {
    name: 'Scale',
    price: 3999,
    setupFee: 0,
    originalSetupFee: 7999,
    bots: 10,
    numbers: 10,
    messages: 50000,
    conversations: 50000,
    broadcastContactsPerMonth: -1,
    broadcastCampaignsPerMonth: -1,
    extraBotPrice: 599,
    features: {
      bookings: true,
      payments: true,
      multi_language: true,
      welcome_menu: true,
      broadcasts: true,
      custom_system_prompt: true,
      live_takeover: true,
      staff_management: true,
      inventory: true,
      api_access: true,
      whatsapp_flows: true,
      white_label: true,
      dedicated_csm: false,
      custom_integrations: false,
      sla_uptime: false,
    },
    featureList: [
      '50,000 AI replies / month',
      'Up to 10 bots, 10 numbers',
      'Everything in Growth',
      'Public API access',
      'WhatsApp Flows (forms inside chat)',
      'White-label option (hide ZapText branding)',
      'Priority support (4hr response)',
      'Monthly strategy call',
      'Extra bot: ₹599/mo',
      'Overage: ₹0.12 per extra reply',
    ],
  },

  // ── Enterprise ₹9,999/mo ─────────────────────────────────────────────
  // Agency / multi-location chains / >100-staff operations. Effectively
  // a contractual relationship — comes with a dedicated success manager,
  // custom integrations, and a 99.9% uptime SLA.
  enterprise: {
    name: 'Enterprise',
    price: 9999,
    setupFee: 0,
    originalSetupFee: 19999,
    bots: -1,
    numbers: -1,
    messages: 200000,
    conversations: 200000,
    broadcastContactsPerMonth: -1,
    broadcastCampaignsPerMonth: -1,
    extraBotPrice: 0,
    features: {
      bookings: true,
      payments: true,
      multi_language: true,
      welcome_menu: true,
      broadcasts: true,
      custom_system_prompt: true,
      live_takeover: true,
      staff_management: true,
      inventory: true,
      api_access: true,
      whatsapp_flows: true,
      white_label: true,
      dedicated_csm: true,
      custom_integrations: true,
      sla_uptime: true,
    },
    featureList: [
      '200,000 AI replies / month',
      'Unlimited bots & numbers',
      'Everything in Scale',
      'Dedicated customer success manager',
      'Custom integrations (CRM, ERP, your stack)',
      '99.9% uptime SLA contract',
      'White-glove onboarding & training',
      'Weekly optimization calls',
      'Priority support (1hr response)',
      'Overage: ₹0.10 per extra reply',
    ],
  },
} satisfies Record<string, PlanDef>;

export type PlanKey = keyof typeof PLANS;

// Overage rate when a paid client exceeds their monthly AI-reply cap.
// Charged at month-end on the next invoice. Each tier gets a slightly
// lower rate as a fairness + retention nudge for heavier users.
export const OVERAGE_PRICE_PER_REPLY: Record<PlanKey, number> = {
  trial: 0,        // hard cap, no overage
  starter: 0.15,
  growth: 0.13,
  scale: 0.12,
  enterprise: 0.10,
};

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

// Type guard for plan keys — safe to use when reading from DB where the
// `plan` column is a free-form varchar(32) and may contain legacy values
// (`'pro'`) we no longer support.
export function isPlanKey(v: unknown): v is PlanKey {
  return v === 'trial' || v === 'starter' || v === 'growth' || v === 'scale' || v === 'enterprise';
}

// Resolves an unknown plan string to a known key, defaulting to 'trial'
// so legacy/unknown plans fall back to free-tier behavior (the safe
// default — we never want to ACCIDENTALLY grant a paid feature to
// somebody on a deleted plan).
export function resolvePlanKey(v: unknown): PlanKey {
  return isPlanKey(v) ? v : 'trial';
}
