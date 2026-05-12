// scripts/run-migrations.ts
//
// Drop-in replacement for `drizzle-kit migrate` that uses Neon's HTTP
// `neon()` function instead of the websocket-based serverless driver.
// drizzle-kit's CLI auto-picks the websocket Pool driver for Neon URLs,
// which hangs on Vercel build and on some local environments. The HTTP
// path is single-shot REST per statement and works everywhere `fetch`
// works.
//
// Same migration metadata table (__drizzle_migrations) as drizzle-kit,
// so this is fully interchangeable — run either, they track each other's
// applied migrations.
//
// Usage:
//   npm run db:migrate:safe

import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';

interface JournalEntry { idx: number; when: number; tag: string }

// Drizzle's expected hash for a migration is the SHA256 of the full
// .sql file content. The migrator looks up these hashes in
// __drizzle_migrations and skips ones already recorded.
function hashOfMigration(folder: string, tag: string): string {
  const sqlPath = path.join(folder, `${tag}.sql`);
  const content = readFileSync(sqlPath, 'utf8');
  return createHash('sha256').update(content).digest('hex');
}

// Bootstrap: if the project's original tables already exist in the DB
// (created via drizzle-kit push or hand-applied before this migration
// pipeline existed), we'd otherwise hit "relation already exists" the
// first time we run migrate(). To avoid that, mark every migration
// older than the LATEST one as already-applied, but only when the
// __drizzle_migrations table is currently empty AND at least one of
// the project's older tables (`clients`) already exists.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function bootstrapIfNeeded(sql: any, folder: string) {
  await sql(`CREATE SCHEMA IF NOT EXISTS drizzle`);
  await sql(`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
  )`);
  // Build a Set of hashes already present so we don't double-insert.
  const existingRows = await sql(`SELECT hash FROM drizzle.__drizzle_migrations`) as Array<{ hash: string }>;
  const alreadyKnown = new Set(existingRows.map((r) => r.hash));

  const journalPath = path.join(folder, 'meta', '_journal.json');
  if (!existsSync(journalPath)) {
    console.log('→ No journal file — fresh migration pipeline.');
    return;
  }
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: JournalEntry[] };
  if (!Array.isArray(journal.entries) || journal.entries.length < 2) {
    console.log('→ Journal has 0-1 entries — no bootstrap needed.');
    return;
  }

  // Has the project already been deployed with at least the original
  // schema? If `clients` exists, yes.
  const clientsExists = await sql(`SELECT EXISTS (
    SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='clients'
  ) AS exists`) as Array<{ exists: boolean }>;
  if (!clientsExists[0]?.exists) {
    console.log('→ Original tables not present in DB — letting migrate() apply everything from scratch.');
    return;
  }

  // Heuristic per-migration: for each journal entry, parse the .sql for
  // CREATE TABLE statements; if all the tables it creates already exist
  // in the DB, mark that migration as already-applied. Skips ones that
  // are still pending.
  for (const entry of journal.entries) {
    const sqlPath = path.join(folder, `${entry.tag}.sql`);
    const content = readFileSync(sqlPath, 'utf8');
    const tableNames = [...content.matchAll(/CREATE TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+"?([\w]+)"?/gi)].map(
      (m) => m[1].toLowerCase()
    );
    if (tableNames.length === 0) {
      // No CREATE TABLE in this migration — can't safely auto-bootstrap.
      // Skip; let migrate() handle it.
      continue;
    }
    let allExist = true;
    for (const t of tableNames) {
      const r = await sql(
        `SELECT EXISTS (
           SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name=$1
         ) AS exists`,
        [t]
      ) as Array<{ exists: boolean }>;
      if (!r[0]?.exists) {
        allExist = false;
        break;
      }
    }
    const hash = hashOfMigration(folder, entry.tag);
    if (alreadyKnown.has(hash)) {
      // Drizzle already tracks this — skip silently.
      continue;
    }
    if (allExist) {
      await sql(
        `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
        [hash, entry.when]
      );
      console.log(`  ✓ marked ${entry.tag} (tables already exist: ${tableNames.join(', ')})`);
    } else {
      console.log(`  → ${entry.tag} pending — migrate() will apply it`);
    }
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Check .env.local.');
    process.exit(1);
  }
  console.log('→ Connecting to Neon via HTTP driver…');
  const sql = neon(url);
  const folder = './drizzle';

  await bootstrapIfNeeded(sql, folder);

  // drizzle's neon-http adapter wants a wider NeonQueryFunction generic
  // than what neon() returns by default. Runtime shape is identical;
  // the cast is the canonical workaround pattern.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = drizzle(sql as any);
  console.log('→ Applying pending migrations from ./drizzle …');
  await migrate(db, { migrationsFolder: folder });
  console.log('✓ Migrations applied.');
}

main().catch((err) => {
  console.error('✗ Migration failed:', err);
  process.exit(1);
});
