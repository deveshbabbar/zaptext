// ─── Drizzle Kit configuration ───
//
// Read by `npm run db:generate` (creates SQL migrations), `db:push` (applies
// schema diff straight to Neon, dev-only), `db:migrate` (production-safe),
// and `db:studio` (browser-based table viewer).
//
// Loads .env.local before reading DATABASE_URL so `npm run db:*` works on
// a developer's machine without exporting the var manually.

import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

config({ path: '.env.local' });
config({ path: '.env' });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    'DATABASE_URL is not set. Add it to .env.local with the Neon connection string from console.neon.tech.'
  );
}

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  verbose: true,
  strict: true,
});
