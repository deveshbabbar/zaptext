// One-shot script to apply the grocery CREATE TABLE + indexes from
// drizzle/0000_mushy_ken_ellis.sql against Neon. Skips the unrelated
// `ALTER TABLE inventory ALTER COLUMN stock SET DEFAULT -1` that drizzle-kit
// would also emit (pre-existing default-value drift; out of scope for Task 4).
//
// Usage: tsx --env-file=.env.local scripts/apply-grocery-migration.ts

import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const sql = neon(url);

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "grocery_cart_drafts" (
    "id" text PRIMARY KEY NOT NULL,
    "client_id" text NOT NULL,
    "customer_phone" varchar(32) NOT NULL,
    "payload" text NOT NULL,
    "expires_at" timestamp with time zone NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "grocery_daily_catalog" (
    "id" text PRIMARY KEY NOT NULL,
    "client_id" text NOT NULL,
    "product_id" text NOT NULL,
    "date" varchar(10) NOT NULL,
    "price_per_unit" numeric(12, 2) NOT NULL,
    "in_stock" boolean DEFAULT true NOT NULL,
    "stock_qty" numeric(12, 2),
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "grocery_orders" (
    "id" text PRIMARY KEY NOT NULL,
    "client_id" text NOT NULL,
    "customer_phone" varchar(32) NOT NULL,
    "customer_name" varchar(200),
    "delivery_address" text NOT NULL,
    "zone_id" text NOT NULL,
    "slot_id" text NOT NULL,
    "slot_date" varchar(10) NOT NULL,
    "items" text NOT NULL,
    "subtotal" numeric(12, 2) NOT NULL,
    "delivery_fee" numeric(12, 2) NOT NULL,
    "total" numeric(12, 2) NOT NULL,
    "status" varchar(16) DEFAULT 'pending' NOT NULL,
    "payment_mode" varchar(16) DEFAULT 'cod' NOT NULL,
    "notes" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "grocery_products" (
    "id" text PRIMARY KEY NOT NULL,
    "client_id" text NOT NULL,
    "name" varchar(100) NOT NULL,
    "name_aliases" text DEFAULT '[]' NOT NULL,
    "unit" varchar(16) NOT NULL,
    "image_url" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "grocery_recurring_orders" (
    "id" text PRIMARY KEY NOT NULL,
    "client_id" text NOT NULL,
    "customer_phone" varchar(32) NOT NULL,
    "day_of_week" integer NOT NULL,
    "slot_id" text NOT NULL,
    "template_items" text NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "last_run_date" varchar(10)
  )`,
  `CREATE TABLE IF NOT EXISTS "grocery_slots" (
    "id" text PRIMARY KEY NOT NULL,
    "client_id" text NOT NULL,
    "label" varchar(100) NOT NULL,
    "start_time" varchar(5) NOT NULL,
    "end_time" varchar(5) NOT NULL,
    "cutoff_time" varchar(5) NOT NULL,
    "days_of_week" text DEFAULT '[0,1,2,3,4,5,6]' NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "grocery_substitution_groups" (
    "id" text PRIMARY KEY NOT NULL,
    "client_id" text NOT NULL,
    "name" varchar(100) NOT NULL,
    "product_ids" text DEFAULT '[]' NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "grocery_zones" (
    "id" text PRIMARY KEY NOT NULL,
    "client_id" text NOT NULL,
    "label" varchar(100) NOT NULL,
    "pincode" varchar(10),
    "area_keywords" text DEFAULT '[]' NOT NULL,
    "delivery_fee" numeric(12, 2) DEFAULT '0' NOT NULL,
    "min_order_for_free_delivery" numeric(12, 2),
    "min_order" numeric(12, 2)
  )`,
  `CREATE INDEX IF NOT EXISTS "grocery_cart_drafts_exp_idx" ON "grocery_cart_drafts" USING btree ("expires_at")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "grocery_daily_catalog_uniq" ON "grocery_daily_catalog" USING btree ("client_id","product_id","date")`,
  `CREATE INDEX IF NOT EXISTS "grocery_daily_catalog_date_idx" ON "grocery_daily_catalog" USING btree ("client_id","date")`,
  `CREATE INDEX IF NOT EXISTS "grocery_orders_client_idx" ON "grocery_orders" USING btree ("client_id")`,
  `CREATE INDEX IF NOT EXISTS "grocery_orders_slot_date_idx" ON "grocery_orders" USING btree ("client_id","slot_date")`,
  `CREATE INDEX IF NOT EXISTS "grocery_orders_customer_idx" ON "grocery_orders" USING btree ("client_id","customer_phone")`,
  `CREATE INDEX IF NOT EXISTS "grocery_products_client_idx" ON "grocery_products" USING btree ("client_id")`,
  `CREATE INDEX IF NOT EXISTS "grocery_recur_client_idx" ON "grocery_recurring_orders" USING btree ("client_id")`,
  `CREATE INDEX IF NOT EXISTS "grocery_recur_day_idx" ON "grocery_recurring_orders" USING btree ("day_of_week","is_active")`,
  `CREATE INDEX IF NOT EXISTS "grocery_slots_client_idx" ON "grocery_slots" USING btree ("client_id")`,
  `CREATE INDEX IF NOT EXISTS "grocery_subgroups_client_idx" ON "grocery_substitution_groups" USING btree ("client_id")`,
  `CREATE INDEX IF NOT EXISTS "grocery_zones_client_idx" ON "grocery_zones" USING btree ("client_id")`,
];

async function main() {
  for (const stmt of STATEMENTS) {
    const head = stmt.replace(/\s+/g, ' ').slice(0, 80);
    process.stdout.write(`Running: ${head}...\n`);
    await sql(stmt);
  }

  const rows = await sql(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'grocery_%' ORDER BY table_name`
  );
  process.stdout.write(`\nGrocery tables in DB: ${JSON.stringify(rows)}\n`);
  process.stdout.write('OK\n');
}

main().catch((e) => {
  process.stderr.write(`Failed: ${(e as Error).stack ?? String(e)}\n`);
  process.exit(1);
});
