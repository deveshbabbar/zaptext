# Neon Postgres Migration

We're moving the persistence layer from Google Sheets to Neon Postgres.
This file walks through the cutover phase by phase. Run the steps in order
the first time; afterwards, only the **Phase 2/3** sections matter for new
work.

## Why

| | Google Sheets | Neon Postgres |
|---|---|---|
| Read latency | 2–4 s | 30–80 ms |
| Concurrent writes | Frequently silently clobbers | Safe (MVCC + indexes) |
| Quota | 60 reads/min | Unlimited (free tier 500 MB) |
| Webhook responsiveness | 13–25 s end-to-end | < 2 s end-to-end |
| SQL queries / joins | Impossible | First-class |

## Phase 1 — Foundation (done in this commit)

- `lib/db/schema.ts` — Drizzle schema for all 9 tables (clients, conversations, analytics, subscriptions, bookings, staff, inventory, slots, date_overrides)
- `lib/db/index.ts` — Neon HTTP client + Drizzle instance
- `drizzle.config.ts` — Drizzle Kit config (migrations, push, studio)
- `package.json` — adds `@neondatabase/serverless`, `drizzle-orm`, `drizzle-kit`, `dotenv`, `tsx`
- `.env.example` — `DATABASE_URL` placeholder

### What you (the developer) do now

1. **Provision Neon** — done. You have a project at `console.neon.tech`.
2. **Copy the connection string**
   - Neon dashboard → your project → **Connect**
   - Copy the URL beginning with `postgres://`
3. **Add it locally**
   - Open `.env.local`
   - Add `DATABASE_URL=postgres://...`
4. **Add it to Vercel**
   - `vercel.com` → project → Settings → Environment Variables
   - Add `DATABASE_URL` for **Production + Preview + Development**
5. **Install + push schema**
   ```bash
   npm install
   npm run db:push
   ```
   `db:push` creates all 9 tables + indexes in Neon. Output should end with `Changes applied`.
6. **Verify in Neon Studio** (optional)
   - Neon dashboard → **SQL Editor** → run `\dt` (or `SELECT table_name FROM information_schema.tables WHERE table_schema='public';`)
   - You should see the 9 tables.
7. **Migrate existing data** (only if you have live Sheets data)
   ```bash
   npm run db:seed-from-sheets
   ```
   Copies every row from your existing Sheets tabs into Neon. Idempotent — safe to re-run.

## Phase 2 — Code cutover (NOT in this commit)

Next session we'll build new query modules that match the existing
`lib/google-sheets.ts` API surface but hit Neon:

- `lib/db/clients.ts` — `getAllClients`, `getClientById`, `getClientByPhoneNumberId`, `addClient`, `updateClientField`, `updateClientFields`, `deleteClient`
- `lib/db/conversations.ts` — `addConversationMessage`, `getConversationHistory`, `getClientConversations`, `getConversationsByDate`
- `lib/db/analytics.ts` — `updateAnalytics`, `getClientAnalytics`
- `lib/db/subscriptions.ts` — `getActiveSubscription`, `createSubscription`, `getSubscriptionHistory`, `getSubscriptionByPaymentId`
- `lib/db/bookings.ts`, `lib/db/staff.ts`, `lib/db/inventory.ts`, etc.

Then `lib/google-sheets.ts` is rewritten as a thin re-export of the new
modules so the 23 importing files don't need to change. Final step is
deleting the old googleapis read/write paths.

## Phase 3 — Verification + Sheets shutdown (also next session)

- Side-by-side dual-read for one day to verify Neon parity
- Then drop the old `lib/google-sheets.ts` body and the `googleapis`
  dependency from `package.json`
- Sheets becomes a read-only audit log; new writes only go to Neon

## Common commands

| Command | What it does |
|---|---|
| `npm run db:push` | Sync schema directly to Neon (dev, fast, no migration files) |
| `npm run db:generate` | Generate SQL migration files from schema diff (commit these in prod) |
| `npm run db:migrate` | Apply pending migration files to Neon (use this in CI/Vercel) |
| `npm run db:studio` | Open Drizzle Studio (browser table viewer) on `local.drizzle.studio` |
| `npm run db:seed-from-sheets` | One-time copy of existing Sheets data → Neon |

## Troubleshooting

- **`DATABASE_URL is not set`** — add it to `.env.local` (locally) or Vercel env (deploy). Restart `next dev` after adding.
- **`SSL connection required`** — your URL is missing `?sslmode=require`. Re-copy from Neon dashboard.
- **`relation "clients" does not exist`** — you skipped `npm run db:push`. Run it.
- **`duplicate key value violates unique constraint clients_phone_number_id_idx`** — your Sheets has two rows with the same `phone_number_id`. The migration script will surface which rows; clean them up in Sheets and re-run.
- **Migration script aborts halfway** — it's idempotent (uses `ON CONFLICT DO UPDATE`). Just re-run.
