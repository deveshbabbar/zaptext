// ─── One-shot Clerk user_id remapper ─────────────────────────────────────
//
// When you migrate Clerk from dev → prod (or merge two Clerk instances),
// each user gets a NEW user_id in the new instance. Existing database rows
// still reference the OLD id, so the user logs in and sees "no bots" even
// though the data is right there.
//
// This script remaps `owner_user_id` (clients) and `user_id` (subscriptions)
// from the OLD Clerk id to the NEW Clerk id, atomically in a single
// transaction — either both update or neither does.
//
// Usage:
//   # 1. List all user_ids currently in the DB (figure out which is yours):
//   npx tsx scripts/remap-clerk-user-id.ts --list
//
//   # 2. Dry-run the remap (default — prints SQL, doesn't execute):
//   npx tsx scripts/remap-clerk-user-id.ts --from user_2DEV... --to user_2PROD...
//
//   # 3. Actually apply the change:
//   npx tsx scripts/remap-clerk-user-id.ts --from user_2DEV... --to user_2PROD... --execute
//
// Loads DATABASE_URL from .env.local then .env (matches drizzle.config.ts).

import { config } from 'dotenv';

// CRITICAL: load env BEFORE importing the db module. Static `import` is
// hoisted to the top of the file in JS, so previously the `lib/db` module
// initialized its Neon connection with DATABASE_URL=undefined even when
// .env.local had it set. The npm aliases (`clerk:list`, `clerk:remap`)
// avoided this via tsx's --env-file flag, but plain `npx tsx scripts/...`
// hit the bug. Loading dotenv first + dynamic-importing the db module
// fixes both invocation paths.
config({ path: '.env.local' });
config({ path: '.env' });

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set. Add it to .env.local from Neon console.');
  process.exit(1);
}

// Module-scope bindings, filled by initDb() inside the IIFE at the bottom
// AFTER dotenv has loaded (tsconfig targets CJS so top-level await isn't
// available; see the comment above). Typed `any` to keep the script tiny.
/* eslint-disable @typescript-eslint/no-explicit-any */
let db: any;
let clients: any;
let subscriptions: any;
let eq: any;
let sql: any;
async function initDb() {
  const dbMod = await import('../lib/db');
  const schemaMod = await import('../lib/db/schema');
  const drizzleMod = await import('drizzle-orm');
  db = dbMod.db;
  clients = schemaMod.clients;
  subscriptions = schemaMod.subscriptions;
  eq = drizzleMod.eq;
  sql = drizzleMod.sql;
}

function arg(name: string): string | undefined {
  const flag = `--${name}`;
  // --flag=value form first (unambiguous)
  const prefixed = process.argv.find((a) => a.startsWith(`${flag}=`));
  if (prefixed) return prefixed.slice(flag.length + 1);
  // --flag form: if next argv looks like a value (not another --flag), use it.
  // Otherwise treat as a boolean flag (return ''). The previous version
  // returned '' on first sight of `--flag` and never looked at the next
  // argv, which made `--to user_2DEF...` silently parse `to` as empty.
  const idx = process.argv.indexOf(flag);
  if (idx >= 0) {
    const next = process.argv[idx + 1];
    if (next && !next.startsWith('--')) return next;
    return ''; // boolean flag (present without value)
  }
  return undefined;
}

const list = arg('list') !== undefined;
let from = arg('from');
const to = arg('to');
const execute = arg('execute') !== undefined;
const autoFrom = arg('auto-from') !== undefined;

async function listAllUserIds() {
  console.log('\n═══ Clerk user_ids currently in the database ═══\n');

  const ownerCounts = await db
    .select({
      id: clients.owner_user_id,
      count: sql<number>`count(*)::int`,
    })
    .from(clients)
    .groupBy(clients.owner_user_id);

  console.log('clients.owner_user_id (each id = one bot owner):');
  if (ownerCounts.length === 0) {
    console.log('  (no rows)');
  } else {
    for (const row of ownerCounts) {
      console.log(`  ${row.id}  →  ${row.count} bot(s)`);
    }
  }

  const subCounts = await db
    .select({
      id: subscriptions.user_id,
      count: sql<number>`count(*)::int`,
    })
    .from(subscriptions)
    .groupBy(subscriptions.user_id);

  console.log('\nsubscriptions.user_id:');
  if (subCounts.length === 0) {
    console.log('  (no rows)');
  } else {
    for (const row of subCounts) {
      console.log(`  ${row.id}  →  ${row.count} subscription(s)`);
    }
  }

  console.log('\nNext step: log in to your Clerk PROD dashboard with the same email,');
  console.log('grab the new user_id (Users → click your email → top of page),');
  console.log('then run:\n');
  console.log('  npx tsx scripts/remap-clerk-user-id.ts \\');
  console.log('    --from <id-from-list-above> \\');
  console.log('    --to user_2YOUR_NEW_PROD_ID');
  console.log('\n(Add --execute when you\'re ready to apply.)\n');
}

async function remap() {
  if (!to) {
    console.error('❌ --to is required (the new prod user_id).');
    process.exit(1);
  }

  // --auto-from: when the dev user_id isn't passed, detect it by reading all
  // distinct user_ids in the DB and picking the one that is NOT --to. Only
  // works cleanly when there's exactly ONE other user_id (the typical
  // single-developer dev→prod migration). Aborts on ambiguity.
  if (!from && autoFrom) {
    const distinctOwners = await db
      .select({ id: clients.owner_user_id })
      .from(clients)
      .groupBy(clients.owner_user_id);
    const distinctSubs = await db
      .select({ id: subscriptions.user_id })
      .from(subscriptions)
      .groupBy(subscriptions.user_id);
    const all = new Set<string>();
    distinctOwners.forEach((r: { id: string | null }) => r.id && all.add(r.id));
    distinctSubs.forEach((r: { id: string | null }) => r.id && all.add(r.id));
    all.delete(to);
    const candidates = Array.from(all);
    if (candidates.length === 0) {
      console.error('❌ --auto-from found no other user_ids in the DB. Either:');
      console.error('   • The remap is already done (everything is on the new id), or');
      console.error('   • The DB is empty.');
      process.exit(1);
    }
    if (candidates.length > 1) {
      console.error(`❌ --auto-from is ambiguous — found ${candidates.length} possible source ids:`);
      candidates.forEach((c) => console.error(`   • ${c}`));
      console.error('\nRe-run with --from <explicit-id> to pick the right one.');
      process.exit(1);
    }
    from = candidates[0];
    console.log(`🔎 --auto-from picked: ${from}`);
  }

  if (!from) {
    console.error('❌ Both --from and --to are required (or pass --auto-from to auto-detect).');
    console.error('   Run with --list first to see existing user_ids in the DB.');
    process.exit(1);
  }
  if (from === to) {
    console.error('❌ --from and --to are the same. Nothing to do.');
    process.exit(1);
  }
  if (!from.startsWith('user_') || !to.startsWith('user_')) {
    console.error('⚠️  Clerk user_ids normally start with "user_". Double-check your args.');
    console.error(`   from: ${from}`);
    console.error(`   to:   ${to}`);
    // Don't bail — proceed (user might know what they're doing).
  }

  // Pre-flight counts so we can show "X rows will change"
  const beforeClients = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(clients)
    .where(eq(clients.owner_user_id, from));
  const beforeSubs = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(subscriptions)
    .where(eq(subscriptions.user_id, from));

  // Also check whether the destination already has rows — would mean either
  // the user has already partially migrated, or the wrong --to was passed.
  const collisionClients = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(clients)
    .where(eq(clients.owner_user_id, to));
  const collisionSubs = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(subscriptions)
    .where(eq(subscriptions.user_id, to));

  console.log('\n═══ Remap plan ═══');
  console.log(`FROM: ${from}`);
  console.log(`TO:   ${to}`);
  console.log('');
  console.log(`clients      : ${beforeClients[0].count} row(s) will move`);
  console.log(`subscriptions: ${beforeSubs[0].count} row(s) will move`);
  if (collisionClients[0].count > 0 || collisionSubs[0].count > 0) {
    console.log('');
    console.log(`⚠️  Destination already has data:`);
    console.log(`   clients      : ${collisionClients[0].count} existing row(s) under "${to}"`);
    console.log(`   subscriptions: ${collisionSubs[0].count} existing row(s) under "${to}"`);
    console.log(`   This is fine if you intentionally want to merge — they'll all end up under "${to}".`);
  }
  console.log('');

  if (beforeClients[0].count === 0 && beforeSubs[0].count === 0) {
    console.log('Nothing to remap. Either the --from id has no rows, or you already migrated.');
    process.exit(0);
  }

  if (!execute) {
    console.log('🟡 DRY RUN. No changes made.');
    console.log('   Re-run with --execute to apply.\n');
    process.exit(0);
  }

  console.log('🔴 EXECUTING transaction…');

  // Capture into const so TS narrows correctly inside the transaction closure.
  // (`from` is `let` because --auto-from may assign it; the guards above
  // ensure it's defined by this point.)
  const fromId = from;
  const toId = to;

  // Atomic — if either UPDATE fails, both roll back.
  await db.transaction(async (tx: any) => {
    const updatedClients = await tx
      .update(clients)
      .set({ owner_user_id: toId })
      .where(eq(clients.owner_user_id, fromId))
      .returning({ id: clients.client_id });
    const updatedSubs = await tx
      .update(subscriptions)
      .set({ user_id: toId })
      .where(eq(subscriptions.user_id, fromId))
      .returning({ id: subscriptions.id });
    console.log(`   ✅ clients      : ${updatedClients.length} row(s) updated`);
    console.log(`   ✅ subscriptions: ${updatedSubs.length} row(s) updated`);
  });

  console.log('\n✅ Done. Log in to the app with the new Clerk account — your bots should appear.\n');
  process.exit(0);
}

(async () => {
  try {
    await initDb();
    if (list) await listAllUserIds();
    else await remap();
  } catch (e) {
    console.error('❌ Script failed:', e);
    process.exit(1);
  }
})();
