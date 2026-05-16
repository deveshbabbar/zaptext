-- Storefront subdomain support — Phase 4-S (Compass roadmap).
--
-- Adds three columns to `clients` that power per-restaurant storefronts at
-- `<slug>.zaptext.shop`:
--   1. slug — human-readable DNS label (e.g. "bigchillicafe"). Unique among
--      non-empty values; ASCII a-z, 0-9, hyphen only; ≤60 base chars + up to
--      a 6-char "-NN..." collision suffix → fits well under the 63-char DNS
--      label limit. Backfilled from business_name with collision resolution.
--   2. service_pincodes — JSON array (stored as text, matching the existing
--      "JSON in text column" pattern used by table_sessions.customer_phones
--      and grocery categories). Empty array '[]' = no pincode gating.
--   3. storefront_enabled — opt-in toggle. Defaults FALSE so existing bots
--      don't accidentally expose a storefront before the owner configures it.
--      Owner flips it ON from /client/restaurant/storefront once the slug,
--      pincodes, and UPI ID are all set.
--
-- The unique partial index on slug mirrors the phone_number_id pattern from
-- migration 0000 — empty strings are allowed (newly-onboarded bots that
-- haven't picked a slug yet), but any non-empty value is globally unique.

ALTER TABLE "clients" ADD COLUMN "slug" varchar(80) DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "service_pincodes" text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "storefront_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint

-- Backfill slugs from business_name. Two CTEs:
--   1. `base` — runs the same regex chain as lib/inventory.ts:slugify
--      (lowercase → non-alnum → hyphens → trim leading/trailing hyphens →
--      truncate to 60 chars). Rows whose business_name has zero alnum chars
--      end up with base_slug = '' and are left empty so the owner can pick
--      one from the settings UI later.
--   2. `ranked` — partitions by the base slug ordered by created_at so the
--      oldest row keeps the bare slug and every subsequent collision gets
--      "-2", "-3", ... appended.
WITH base AS (
  SELECT
    client_id,
    LEFT(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            lower(trim(business_name)),
            '[^a-z0-9]+', '-', 'g'
          ),
          '^-+', '', 'g'
        ),
        '-+$', '', 'g'
      ),
      60
    ) AS base_slug,
    created_at,
    client_id AS tiebreaker
  FROM "clients"
),
ranked AS (
  SELECT
    client_id,
    base_slug,
    row_number() OVER (
      PARTITION BY base_slug
      ORDER BY created_at, tiebreaker
    ) AS rn
  FROM base
)
UPDATE "clients" c
SET slug = CASE
  WHEN ranked.base_slug = '' THEN ''
  WHEN ranked.rn = 1 THEN ranked.base_slug
  ELSE ranked.base_slug || '-' || ranked.rn::text
END
FROM ranked
WHERE c.client_id = ranked.client_id;
--> statement-breakpoint

CREATE UNIQUE INDEX "clients_slug_unique" ON "clients" ("slug") WHERE "slug" <> '';
