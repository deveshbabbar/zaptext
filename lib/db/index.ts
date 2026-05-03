// ─── Neon Postgres connection (Drizzle ORM) ───
//
// Uses @neondatabase/serverless's HTTP driver — works in Vercel serverless
// AND Edge runtimes without TCP pooling. For our usage (short-lived API
// route invocations, no long transactions) this is the right choice.
//
// Caching: a module-level singleton avoids re-parsing the connection URL
// on every request. Vercel serverless reuses the module across warm
// invocations, so we get connection reuse for free.

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  // Don't throw at import time — that would break unrelated routes during
  // the dual-write transition (when some code paths still go to Sheets).
  // Throw lazily on first query instead.
  console.warn('[db] DATABASE_URL is not set. Neon queries will fail until it is configured in your environment.');
}

const sql = neon(connectionString || 'postgres://placeholder:placeholder@invalid/none');

export const db = drizzle(sql, { schema });

export { schema };
