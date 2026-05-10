// Subscription: re-exports Neon-backed implementations from lib/db/subscriptions.ts.

import { PLANS, type PlanKey, DURATIONS, type DurationKey, computePlanPrice, isDurationKey, TRIAL_MESSAGE_LIMIT, isTrialPlan } from './plans';

// Re-export plan definitions for backward compatibility.
export { PLANS, type PlanKey, DURATIONS, type DurationKey, computePlanPrice, isDurationKey, TRIAL_MESSAGE_LIMIT, isTrialPlan };

export type { SubscriptionRecord } from './db/subscriptions';
export {
  getActiveSubscription,
  getSubscriptionByPaymentId,
  createSubscription,
  cancelSubscriptionByPaymentId,
  markSubscriptionWarned,
  getExpiringActiveSubscriptions,
  getSubscriptionHistory,
  getAllSubscriptions,
} from './db/subscriptions';
