// ─── Legacy import surface (now Neon-backed) ───
//
// This module used to wrap the Google Sheets `subscriptions` tab. As of
// Phase 2B of the Neon migration the implementations live in
// lib/db/subscriptions.ts and this file re-exports them so the 9 callers
// across the codebase don't need to change their imports yet.

import { PLANS, type PlanKey, DURATIONS, type DurationKey, computePlanPrice, isDurationKey, TRIAL_MESSAGE_LIMIT, isTrialPlan } from './plans';

// Re-export plan definitions for backward compatibility.
export { PLANS, type PlanKey, DURATIONS, type DurationKey, computePlanPrice, isDurationKey, TRIAL_MESSAGE_LIMIT, isTrialPlan };

export type { SubscriptionRecord } from './db/subscriptions';
export {
  getActiveSubscription,
  getSubscriptionByPaymentId,
  createSubscription,
  cancelSubscriptionByPaymentId,
  getSubscriptionHistory,
  getAllSubscriptions,
} from './db/subscriptions';
