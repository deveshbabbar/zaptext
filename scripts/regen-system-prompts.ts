// ─── Regenerate stored system_prompt for existing bots ──────────────────
//
// Why this exists: clients.system_prompt is stored ONCE at onboarding.
// When lib/prompt-generator.ts changes (e.g. tightening language rules,
// adding new sections), existing bots keep using their stale prompt
// because nothing triggers regeneration. The webhook reads
// client.system_prompt directly — so a fix in prompt-generator.ts only
// reaches existing bots if (a) the owner re-saves settings, or (b) we
// run this script.
//
// Default mode is dry-run — prints a count + per-bot length deltas so
// you can sanity-check what's about to change. Pass --execute to
// actually write back. --bot=<id> targets a single bot. --include-empty
// doesn't skip bots with empty knowledge_base_json (defaults to skipping).
//
// Usage:
//   npx tsx scripts/regen-system-prompts.ts                 # dry-run all
//   npx tsx scripts/regen-system-prompts.ts --execute       # apply all
//   npx tsx scripts/regen-system-prompts.ts --bot=<id>      # single
//   npx tsx scripts/regen-system-prompts.ts --bot=<id> --execute

import { config } from 'dotenv';

// CRITICAL: load env BEFORE importing the db module. Same load-order
// fix as scripts/remap-clerk-user-id.ts.
config({ path: '.env.local' });
config({ path: '.env' });

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set. Add it to .env.local from Neon console.');
  process.exit(1);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
let db: any;
let clients: any;
let eq: any;
let generateSystemPrompt: any;

async function init() {
  const dbMod = await import('../lib/db');
  const schemaMod = await import('../lib/db/schema');
  const drizzleMod = await import('drizzle-orm');
  const promptMod = await import('../lib/prompt-generator');
  db = dbMod.db;
  clients = schemaMod.clients;
  eq = drizzleMod.eq;
  generateSystemPrompt = promptMod.generateSystemPrompt;
}

function arg(name: string): string | undefined {
  const flag = `--${name}`;
  const prefixed = process.argv.find((a) => a.startsWith(`${flag}=`));
  if (prefixed) return prefixed.slice(flag.length + 1);
  const idx = process.argv.indexOf(flag);
  if (idx >= 0) {
    const next = process.argv[idx + 1];
    if (next && !next.startsWith('--')) return next;
    return '';
  }
  return undefined;
}

const execute = arg('execute') !== undefined;
const includeEmpty = arg('include-empty') !== undefined;
const targetBotId = arg('bot');

interface RegenRow {
  client_id: string;
  business_name: string;
  type: string;
  status: string;
  oldPrompt: string;
  newPrompt: string;
  reason?: string;
}

async function main() {
  await init();

  const rows = targetBotId
    ? await db.select().from(clients).where(eq(clients.client_id, targetBotId))
    : await db.select().from(clients);

  if (rows.length === 0) {
    console.log(targetBotId ? `❌ No bot with client_id="${targetBotId}"` : 'No bots in DB.');
    process.exit(0);
  }

  const planned: RegenRow[] = [];
  const skipped: RegenRow[] = [];

  for (const r of rows) {
    const old = r.system_prompt || '';
    const kbRaw = r.knowledge_base_json || '';

    if (!kbRaw && !includeEmpty) {
      skipped.push({
        client_id: r.client_id,
        business_name: r.business_name,
        type: r.type,
        status: r.status,
        oldPrompt: old,
        newPrompt: old,
        reason: 'empty knowledge_base_json (use --include-empty to override)',
      });
      continue;
    }

    let kb: Record<string, unknown> = {};
    try {
      kb = kbRaw ? JSON.parse(kbRaw) : {};
    } catch {
      skipped.push({
        client_id: r.client_id,
        business_name: r.business_name,
        type: r.type,
        status: r.status,
        oldPrompt: old,
        newPrompt: old,
        reason: 'corrupt knowledge_base_json — fix it via /client/settings raw editor first',
      });
      continue;
    }

    let next = '';
    try {
      next = generateSystemPrompt(kb);
    } catch (e) {
      skipped.push({
        client_id: r.client_id,
        business_name: r.business_name,
        type: r.type,
        status: r.status,
        oldPrompt: old,
        newPrompt: old,
        reason: `generator threw: ${String(e).slice(0, 120)}`,
      });
      continue;
    }

    if (next === old) {
      skipped.push({
        client_id: r.client_id,
        business_name: r.business_name,
        type: r.type,
        status: r.status,
        oldPrompt: old,
        newPrompt: next,
        reason: 'already up-to-date',
      });
      continue;
    }

    planned.push({
      client_id: r.client_id,
      business_name: r.business_name,
      type: r.type,
      status: r.status,
      oldPrompt: old,
      newPrompt: next,
    });
  }

  console.log('\n═══ Regen plan ═══\n');
  console.log(`Total bots inspected : ${rows.length}`);
  console.log(`Will regenerate      : ${planned.length}`);
  console.log(`Skipped              : ${skipped.length}`);
  console.log('');

  if (planned.length > 0) {
    console.log('--- Bots that WILL be regenerated ---');
    for (const p of planned) {
      const lenDelta = p.newPrompt.length - p.oldPrompt.length;
      const sign = lenDelta >= 0 ? '+' : '';
      console.log(`  • ${p.business_name} [${p.type}/${p.status}]`);
      console.log(`    id=${p.client_id}`);
      console.log(`    length ${p.oldPrompt.length} → ${p.newPrompt.length} chars (${sign}${lenDelta})`);
    }
    console.log('');
  }

  if (skipped.length > 0) {
    console.log('--- Skipped bots ---');
    for (const s of skipped) {
      console.log(`  • ${s.business_name}  —  ${s.reason}`);
    }
    console.log('');
  }

  if (planned.length === 0) {
    console.log('Nothing to do.');
    process.exit(0);
  }

  if (!execute) {
    console.log('🟡 DRY RUN. No changes made.');
    console.log('   Re-run with --execute to apply.');
    if (!targetBotId) {
      console.log('   To preview a single bot: --bot=<client_id>\n');
    }
    process.exit(0);
  }

  console.log('🔴 EXECUTING regen — overwriting system_prompt rows…\n');
  let ok = 0;
  let failed = 0;
  for (const p of planned) {
    try {
      await db
        .update(clients)
        .set({ system_prompt: p.newPrompt })
        .where(eq(clients.client_id, p.client_id));
      ok += 1;
      console.log(`  ✅ ${p.business_name}`);
    } catch (e) {
      failed += 1;
      console.log(`  ❌ ${p.business_name} — ${String(e).slice(0, 200)}`);
    }
  }
  console.log('');
  console.log(`✅ Updated ${ok} / ${planned.length} bot(s).`);
  if (failed > 0) console.log(`⚠️  ${failed} failure(s). Re-run to retry — script is idempotent.`);
  console.log('');
  console.log('Webhook reads client.system_prompt fresh on each message — the new');
  console.log('language rules + bilingual templates are live for these bots immediately.');
  process.exit(0);
}

main().catch((e) => {
  console.error('❌ Script failed:', e);
  process.exit(1);
});
