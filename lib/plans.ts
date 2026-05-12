// ─── Plan Definitions (client-safe, no server-only imports) ───
//
// Pricing strategy (May 2026 — post-Meta-Business-AI launch):
//   Try-it-Free (100-msg trial) → Starter ₹599 → Growth ₹1,499 → Scale ₹3,999 → Enterprise ₹9,999
//
// The trial is a FULL-FEATURE preview (bookings, payments, Hindi, multi-bot
// flag) capped at 100 replies — designed so the prospect can see a real
// booking land before paying. This is materially different from Meta's
// free in-app Business AI (FAQ-only, single number, no integrations, no
// compliance gates). Our pricing tiers price the gap: what does it cost to
// run a real revenue-generating bot, not just an auto-responder.
//
// Each plan exposes a `features` flag map — feature-gates.ts is the single
// source of truth that webhook/booking/payment paths consult. Adding a new
// feature = add a flag here + check it in the relevant code path. Never
// branch on plan name directly.

// Try-it-Free trial — 100 AI replies (lifetime cap), full Pro features
// unlocked so the owner can see a real booking land before paying.
export const TRIAL_MESSAGE_LIMIT = 100;

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
  | 'sla_uptime'            // 99.9% uptime SLA contract
  | 'dine_in';              // Restaurant QR table dine-in ordering (Growth+)

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
      bookings: true,           // unlocked on trial — show prospects what they're paying for
      payments: true,
      multi_language: true,
      welcome_menu: true,
      broadcasts: false,
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
      dine_in: false,           // power feature, Growth+ only
    },
    featureList: [
      `Full-feature trial — first ${TRIAL_MESSAGE_LIMIT} replies free`,
      'Bookings, UPI links, Hindi/Hinglish — all unlocked from minute 1',
      'See your first real booking land before you pay',
      'No credit card required',
      'After 100 replies → upgrade to Starter at ₹599/mo',
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
      dine_in: false,
    },
    featureList: [
      '2,000 conversations / month — never miss a customer ping',
      'Bookings flow into your calendar (not your inbox)',
      'UPI / Razorpay payment links sent in chat — close the sale',
      'Hindi · English · Hinglish — speaks like your customers',
      'Auto-detects language; matches Marathi, Gujarati, Punjabi, Bengali, Tamil, Telugu',
      'Voice-note transcription — sabziwala paste-list / customer voice queries handled',
      'Vertical-trained bot (FSSAI / RERA / GSTIN aware — won\'t make compliance mistakes)',
      'Welcome menu + opt-in flows + abandoned-cart recovery',
      'Live takeover from a web dashboard (no separate app needed)',
      '1 broadcast / month, up to 500 contacts',
      'Email support · WhatsApp support during business hours',
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
      dine_in: true,           // unlocks QR-table ordering for restaurants
    },
    featureList: [
      '10,000 conversations / month — scale into festive surge without hiring',
      'Up to 3 separate bots — different brand fronts, branches, or numbers',
      'Everything in Starter, plus:',
      'Custom AI personality (your brand voice, not a generic Meta tone)',
      'Unlimited broadcasts to 5,000 opted-in customers / month',
      'Cart abandonment + booking-reminder automations',
      'Daily summary reports — bookings, missed leads, top questions',
      'Multi-staff inbox (assign chats to different employees)',
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
      dine_in: true,
    },
    featureList: [
      '50,000 conversations / month — chain-store volume',
      'Up to 10 bots / numbers — one per branch, brand-front, or city',
      'Everything in Growth, plus:',
      'Public API access — wire ZapText into your CRM, ERP, accounting',
      'WhatsApp Flows (forms-inside-chat for lead capture / surveys)',
      'White-label — hide ZapText branding, run as your own brand',
      'Per-branch analytics (compare which outlet converts best)',
      'Priority support (4hr response, dedicated channel)',
      'Monthly strategy call — we audit your bot, suggest improvements',
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
      dine_in: true,
    },
    featureList: [
      '200,000 conversations / month — agency / multi-city operator scale',
      'Unlimited bots & numbers — every franchise, every brand, your call',
      'Everything in Scale, plus:',
      'Dedicated customer success manager (single point of contact)',
      'Custom integrations — your CRM, ERP, POS, accounting, HRMS',
      'Per-vertical compliance audit (FSSAI / RERA / DPDPA / Coaching Bill)',
      '99.9% uptime SLA contract with credits if breached',
      'White-glove onboarding & in-person training (Tier-1 cities)',
      'Weekly optimisation calls — our team tunes your bot performance',
      'Priority support (1hr response, weekend cover)',
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
