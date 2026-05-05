// ─── Feature gates ──────────────────────────────────────────────────────
//
// Single source of truth for "is this customer allowed to do X?". Every
// code path that performs a billable action MUST consult this module
// before proceeding — never branch on plan name directly. This is what
// enforces the user's "jo provide karna hai sirf wohi mile" rule.
//
// Three gate flavours:
//   canUse(plan, feature)            boolean feature flag check
//   checkBotLimit(plan, current)     "can owner create another bot?"
//   checkMessageQuota(plan, used)    "can the bot send another reply?"
//
// All gates return a structured { allowed, reason } so the UI/webhook
// can surface a friendly message + an upgrade link.

import { PLANS, type PlanKey, type FeatureKey, resolvePlanKey, TRIAL_MESSAGE_LIMIT } from './plans';

export interface GateResult {
  allowed: boolean;
  reason?: string;          // human-readable, OK to show in UI
  upgradeTo?: PlanKey;      // suggest the cheapest plan that unlocks this
}

// ─── feature flag check ────────────────────────────────────────────────

export function canUse(plan: PlanKey | string | null | undefined, feature: FeatureKey): GateResult {
  const key = resolvePlanKey(plan);
  if (PLANS[key].features[feature]) return { allowed: true };
  // Find the cheapest plan that does have this feature, for the upsell hint.
  const upgradeTo = (Object.keys(PLANS) as PlanKey[]).find((k) => PLANS[k].features[feature]);
  return {
    allowed: false,
    reason: `${humanFeature(feature)} is not available on the ${PLANS[key].name} plan.${
      upgradeTo ? ` Upgrade to ${PLANS[upgradeTo].name} to unlock it.` : ''
    }`,
    upgradeTo,
  };
}

// ─── bot count limit ───────────────────────────────────────────────────

export function checkBotLimit(
  plan: PlanKey | string | null | undefined,
  currentBotCount: number
): GateResult {
  const key = resolvePlanKey(plan);
  const cap = PLANS[key].bots;
  if (cap === -1) return { allowed: true };           // unlimited
  if (currentBotCount < cap) return { allowed: true };
  // Find a plan with a higher cap.
  const upgradeTo = (Object.keys(PLANS) as PlanKey[]).find((k) => {
    const c = PLANS[k].bots;
    return c === -1 || c > cap;
  });
  return {
    allowed: false,
    reason: `Your ${PLANS[key].name} plan allows ${cap} bot${cap === 1 ? '' : 's'}. You already have ${currentBotCount}.`,
    upgradeTo,
  };
}

// ─── monthly AI-reply quota ────────────────────────────────────────────

// `used` = lifetime outbound count for trial; current-month outbound count
// for paid plans. Webhook layer is responsible for computing it correctly.
// Returns allowed:false ONLY when the customer has exceeded their cap AND
// the plan does not allow overage. Paid plans allow overage by default;
// trial is a hard cap.
export function checkMessageQuota(
  plan: PlanKey | string | null | undefined,
  used: number
): GateResult & { hardCap: boolean; remaining: number; cap: number } {
  const key = resolvePlanKey(plan);
  const cap = PLANS[key].messages;
  const remaining = Math.max(0, cap - used);
  const hardCap = key === 'trial';

  if (used < cap) {
    return { allowed: true, hardCap, remaining, cap };
  }
  // Trial: hard cap, refuse send.
  if (hardCap) {
    return {
      allowed: false,
      reason: `Free trial limit reached (${cap} replies). Upgrade to Starter (₹599/mo) for 2,000 replies/month.`,
      upgradeTo: 'starter',
      hardCap,
      remaining: 0,
      cap,
    };
  }
  // Paid plan: still allowed, but caller should account for overage billing.
  return {
    allowed: true,
    reason: `Over monthly cap by ${used - cap}. Each extra reply costs the overage rate.`,
    hardCap,
    remaining: 0,
    cap,
  };
}

// ─── broadcast quotas ──────────────────────────────────────────────────

export function checkBroadcastQuota(
  plan: PlanKey | string | null | undefined,
  campaignsThisMonth: number,
  contactsRequested: number
): GateResult {
  const key = resolvePlanKey(plan);
  const camps = PLANS[key].broadcastCampaignsPerMonth;
  const contacts = PLANS[key].broadcastContactsPerMonth;
  if (camps === 0 || contacts === 0) {
    const upgradeTo = (Object.keys(PLANS) as PlanKey[]).find(
      (k) => PLANS[k].broadcastCampaignsPerMonth !== 0
    );
    return {
      allowed: false,
      reason: `Broadcasts aren't included in the ${PLANS[key].name} plan.`,
      upgradeTo,
    };
  }
  if (camps !== -1 && campaignsThisMonth >= camps) {
    return {
      allowed: false,
      reason: `Reached ${camps} broadcast(s) for this month on the ${PLANS[key].name} plan.`,
    };
  }
  if (contacts !== -1 && contactsRequested > contacts) {
    return {
      allowed: false,
      reason: `Your plan allows up to ${contacts} broadcast contacts/month; you tried ${contactsRequested}.`,
    };
  }
  return { allowed: true };
}

// ─── helpers ───────────────────────────────────────────────────────────

function humanFeature(f: FeatureKey): string {
  switch (f) {
    case 'bookings': return 'Bookings & calendar';
    case 'payments': return 'Payment requests';
    case 'multi_language': return 'Multi-language replies (Hindi, etc.)';
    case 'welcome_menu': return 'Welcome menu';
    case 'broadcasts': return 'Marketing broadcasts';
    case 'custom_system_prompt': return 'Custom bot personality';
    case 'live_takeover': return 'Live chat takeover';
    case 'staff_management': return 'Staff & trainer management';
    case 'inventory': return 'Inventory / product catalog';
    case 'api_access': return 'Public API';
    case 'whatsapp_flows': return 'WhatsApp Flows';
    case 'white_label': return 'White-label branding';
    case 'dedicated_csm': return 'Dedicated success manager';
    case 'custom_integrations': return 'Custom integrations';
    case 'sla_uptime': return 'Uptime SLA';
  }
}

// Re-export TRIAL_MESSAGE_LIMIT for any code path that imports it from
// feature-gates rather than plans (kept for convenience).
export { TRIAL_MESSAGE_LIMIT };
