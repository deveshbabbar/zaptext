// ─── One-shot WhatsApp template submission ──────────────────────────────
//
// Submits every template defined in lib/whatsapp-templates.ts to Meta's
// /{WABA_ID}/message_templates Graph API endpoint, in every language
// (currently en + hi), and records each submission in the
// template_submissions table with status PENDING.
//
// Meta then asynchronously approves (or rejects) each one — usually
// within a few hours. The status flips via the
// `message_template_status_update` webhook (handled separately).
//
// Usage:
//   # Dry-run (default) — prints what WOULD be submitted, hits no APIs:
//   npx tsx scripts/submit-templates.ts
//
//   # Actually submit to Meta:
//   npx tsx scripts/submit-templates.ts --execute
//
//   # Resubmit only templates that are not currently APPROVED:
//   npx tsx scripts/submit-templates.ts --execute --skip-approved
//
// Required env (loaded from .env.local then .env):
//   WHATSAPP_BUSINESS_ACCOUNT_ID  the WABA id (NOT phone_number_id)
//   WHATSAPP_ACCESS_TOKEN         system user / app token with whatsapp_business_management
//   DATABASE_URL                  for upserting status into template_submissions

import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// CRITICAL: load env BEFORE importing the db module. See remap-clerk-user-id.ts
// for the why — Drizzle's neon() initializes at import time.
const envLocal = resolve(process.cwd(), '.env.local');
const envFile = resolve(process.cwd(), '.env');
if (existsSync(envLocal)) config({ path: envLocal });
if (existsSync(envFile)) config({ path: envFile });

// Templates module is pure (no env reads at module load), so a static
// import is fine. The DB module IS env-dependent and gets dynamically
// imported inside main() AFTER dotenv has loaded (see below).
import {
  ALL_LANGUAGES,
  ALL_TEMPLATE_NAMES,
  TEMPLATE_DEFINITIONS,
  getTemplatePayload,
  type TemplateLanguage,
  type TemplateName,
} from '../lib/whatsapp-templates';

// Type-only — erased at runtime, no module init triggered.
import type { db as DbType } from '../lib/db';
import type { template_submissions as TemplateSubmissionsType } from '../lib/db/schema';

// Lazily-loaded DB handles. Populated by loadDb() inside main() AFTER
// dotenv config so lib/db sees a real DATABASE_URL on init.
let db: typeof DbType | null = null;
let template_submissions: typeof TemplateSubmissionsType | null = null;
let drizzleSql: typeof import('drizzle-orm').sql | null = null;

async function loadDb(): Promise<boolean> {
  try {
    const dbModule = await import('../lib/db');
    const schemaModule = await import('../lib/db/schema');
    const drizzleModule = await import('drizzle-orm');
    db = dbModule.db;
    template_submissions = schemaModule.template_submissions;
    drizzleSql = drizzleModule.sql;
    return true;
  } catch (err) {
    console.warn(`[warn] DB load failed (status will not be persisted): ${String(err).slice(0, 200)}`);
    return false;
  }
}

const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0';

interface SubmitResult {
  template: TemplateName;
  language: TemplateLanguage;
  ok: boolean;
  alreadyExists?: boolean;  // template name+lang already submitted to Meta — script is idempotent
  metaTemplateId?: string;
  status?: string;
  error?: string;
  errorDetails?: unknown;  // full Meta error block, surfaced for debugging
}

async function submitOne(
  wabaId: string,
  accessToken: string,
  template: TemplateName,
  language: TemplateLanguage
): Promise<SubmitResult> {
  const payload = getTemplatePayload(template, language);

  try {
    const res = await fetch(`${WHATSAPP_API_URL}/${wabaId}/message_templates`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      // Meta's `error.message` is often a generic "Invalid parameter" — the
      // actually-useful text is buried in error_user_msg / error_user_title /
      // error_data.details. Concat everything so the operator can see why.
      const e = data?.error || {};
      const parts = [
        e.message,
        e.error_user_title,
        e.error_user_msg,
        e.error_data?.details,
      ].filter(Boolean);
      const errMsg = parts.length > 0 ? parts.join(' | ') : 'Unknown error';

      // "Template already exists" is NOT a real failure — the previous
      // submission is still pending or approved upstream. Treat it as a
      // skip so re-runs of this script are idempotent. Meta returns
      // error_subcode 2388024 (or message containing "already exists").
      const alreadyExists =
        e.error_subcode === 2388024 ||
        /already exists/i.test(errMsg);
      if (alreadyExists) {
        return { template, language, ok: true, alreadyExists: true, status: 'EXISTS' };
      }

      return { template, language, ok: false, error: errMsg, errorDetails: data };
    }
    return {
      template,
      language,
      ok: true,
      metaTemplateId: data?.id,
      status: data?.status || 'PENDING',
    };
  } catch (err) {
    return { template, language, ok: false, error: String(err).slice(0, 300) };
  }
}

async function recordSubmission(
  wabaId: string,
  result: SubmitResult,
  category: string
) {
  // No-op when DB isn't available (loadDb failed or DATABASE_URL missing).
  // Meta is the source of truth for template state — DB is just our cache.
  if (!db || !template_submissions) return;
  // "Already exists" is treated as success at the script level but we
  // don't know its true Meta status (PENDING vs APPROVED) without a
  // separate fetch — leave the existing DB row untouched if any.
  if (result.alreadyExists) return;

  await db
    .insert(template_submissions)
    .values({
      waba_id: wabaId,
      template_name: result.template,
      language: result.language,
      category,
      status: result.ok ? (result.status || 'PENDING') : 'REJECTED',
      meta_template_id: result.metaTemplateId || '',
      last_error: result.ok ? '' : (result.error || ''),
      submitted_at: new Date(),
      updated_at: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        template_submissions.waba_id,
        template_submissions.template_name,
        template_submissions.language,
      ],
      set: {
        status: result.ok ? (result.status || 'PENDING') : 'REJECTED',
        meta_template_id: result.metaTemplateId || '',
        last_error: result.ok ? '' : (result.error || ''),
        category,
        updated_at: new Date(),
      },
    });
}

async function getApprovedKeys(wabaId: string): Promise<Set<string>> {
  if (!db || !template_submissions || !drizzleSql) return new Set();
  const rows = await db
    .select({
      template_name: template_submissions.template_name,
      language: template_submissions.language,
    })
    .from(template_submissions)
    .where(drizzleSql`${template_submissions.waba_id} = ${wabaId} AND ${template_submissions.status} = 'APPROVED'`);
  return new Set(rows.map((r) => `${r.template_name}|${r.language}`));
}

async function main() {
  // Load DB lazily, AFTER dotenv has populated process.env. lib/db reads
  // DATABASE_URL at module-init time, so a static import would have seen
  // undefined (env loads happen inside config({path:...}) at the top of
  // this file but JS hoists static imports above that).
  await loadDb();

  const args = process.argv.slice(2);
  const execute = args.includes('--execute');
  const skipApproved = args.includes('--skip-approved');

  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!wabaId) {
    console.error('Missing WHATSAPP_BUSINESS_ACCOUNT_ID. Add it to .env.local.');
    process.exit(1);
  }
  if (!accessToken) {
    console.error('Missing WHATSAPP_ACCESS_TOKEN. Add it to .env.local.');
    process.exit(1);
  }

  const total = ALL_TEMPLATE_NAMES.length * ALL_LANGUAGES.length;
  console.log(`\nWABA: ${wabaId}`);
  console.log(`Mode: ${execute ? 'EXECUTE (will hit Meta API)' : 'DRY-RUN (no API calls)'}`);
  console.log(`Templates: ${ALL_TEMPLATE_NAMES.length} x ${ALL_LANGUAGES.length} languages = ${total} submissions\n`);

  let approvedSkip: Set<string> = new Set();
  if (execute && skipApproved) {
    approvedSkip = await getApprovedKeys(wabaId);
    if (approvedSkip.size > 0) {
      console.log(`Skipping ${approvedSkip.size} already-APPROVED submissions.\n`);
    }
  }

  const results: SubmitResult[] = [];

  for (const template of ALL_TEMPLATE_NAMES) {
    const def = TEMPLATE_DEFINITIONS[template];
    for (const language of ALL_LANGUAGES) {
      const key = `${template}|${language}`;
      if (approvedSkip.has(key)) {
        console.log(`  - ${template} [${language}]  SKIP (already APPROVED)`);
        continue;
      }

      if (!execute) {
        const payload = getTemplatePayload(template, language);
        const firstComponent = payload.components[0] as { text?: string };
        console.log(`  - ${template} [${language}]  (${def.category}) DRY-RUN: ${(firstComponent.text || '').slice(0, 60)}...`);
        continue;
      }

      const result = await submitOne(wabaId, accessToken, template, language);
      // DB write is best-effort: if DATABASE_URL is missing or the
      // template_submissions table doesn't exist yet (migration not run),
      // we still want to see Meta's response on stdout. Log and continue.
      try {
        await recordSubmission(wabaId, result, def.category);
      } catch (dbErr) {
        console.warn(`    [warn] could not record to DB: ${String(dbErr).slice(0, 200)}`);
      }
      results.push(result);

      const status = result.alreadyExists
        ? 'SKIP (already on Meta)'
        : result.ok
          ? `OK (${result.status || 'PENDING'})`
          : `FAIL: ${result.error}`;
      console.log(`  - ${template} [${language}]  ${status}`);

      // Print the FULL Meta error response for the first failure so the
      // operator can inspect raw fields (error_subcode, fbtrace_id,
      // error_data.details) and fix the payload. Subsequent failures with
      // identical messages are usually the same root cause.
      if (!result.ok && results.filter((r) => !r.ok).length === 1) {
        console.log('    [first-failure full response] ' + JSON.stringify(result.errorDetails, null, 2));
      }

      // Rate-limit: Meta's template create has tight limits. Sleep 350ms between calls
      // (~3 req/sec) to stay well under the documented 100/hour soft cap.
      await new Promise((r) => setTimeout(r, 350));
    }
  }

  if (execute) {
    const submitted = results.filter((r) => r.ok && !r.alreadyExists).length;
    const skipped = results.filter((r) => r.alreadyExists).length;
    const failed = results.filter((r) => !r.ok).length;
    console.log(`\nDone. ${submitted} new submissions, ${skipped} already-on-Meta (skipped), ${failed} failed.`);
    if (failed > 0) {
      console.log('\nCheck /admin/templates or the template_submissions table for the rejection reasons.');
    } else {
      console.log('\nMeta will approve each template within a few hours. Track via /admin/templates.');
    }
  } else {
    console.log('\nDry-run complete. Re-run with --execute to actually submit.');
  }
}

main().catch((err) => {
  console.error('submit-templates failed:', err);
  process.exit(1);
});
