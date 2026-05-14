// Helper for writing consent_log rows. See lib/db/schema.ts ->
// consent_log for the underlying table + DPDPA 2023 §6/§6(10) rationale.
//
// `recordConsentEvent` is fire-and-forget by design — callers should
// never block the customer's order/reply on the log write succeeding.
// If the database is down, we'd rather complete the customer's action
// and lose the evidence row than refuse the action. We log errors so
// SRE has a signal, but never throw.

import { db } from '@/lib/db';
import { consent_log } from '@/lib/db/schema';

// The privacy-notice text shown to customers is versioned so we can
// prove which wording was current when each row was written. Bump
// this string whenever the user-facing notice copy changes.
export const PRIVACY_NOTICE_VERSION = '2026-05';

export type ConsentEventType =
  | 'inbound_csw'
  | 'menu_phone_entry'
  | 'qr_scan_start'
  | 'marketing_opt_in'
  | 'marketing_opt_out'
  | 'erasure_request';

export type ConsentCategory = 'transactional' | 'marketing' | 'support';

interface RecordConsentInput {
  client_id: string;
  customer_phone: string;          // digits only or e164; stored as-given
  event_type: ConsentEventType;
  source: string;                  // e.g. 'webhook' / '/m/<clientId>' / 'admin_manual'
  business_name_shown: string;     // exact string the customer saw
  categories: ConsentCategory[];   // which permission categories this event grants
  user_agent?: string;             // optional UA string for /m page events
  notice_version?: string;         // override only when replaying old data; defaults to current
}

export async function recordConsentEvent(input: RecordConsentInput): Promise<void> {
  try {
    const id = `cl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    await db.insert(consent_log).values({
      id,
      client_id: input.client_id,
      customer_phone: (input.customer_phone || '').slice(0, 32),
      event_type: input.event_type,
      source: (input.source || '').slice(0, 80),
      business_name_shown: input.business_name_shown || '',
      notice_version: input.notice_version || PRIVACY_NOTICE_VERSION,
      categories: JSON.stringify(input.categories || []),
      user_agent: input.user_agent ? input.user_agent.slice(0, 500) : '',
    });
  } catch (err) {
    // Never throw — the consent log is best-effort. We'd rather complete
    // the customer's action than fail it because the audit write hiccupped.
    console.error('[consent-log] write failed (non-fatal)', {
      event_type: input.event_type,
      client_id: input.client_id,
      err,
    });
  }
}
