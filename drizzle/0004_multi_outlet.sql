-- Multi-outlet support — Phase 3.
--
-- 1. Adds `outlet_id` to restaurant_tables and dine_in_orders.
--    Default 'main' so every existing row falls under one synthetic
--    outlet (single-outlet kitchens are entirely unaffected).
-- 2. Adds optional delivery_lat / delivery_lng to dine_in_orders for
--    location-aware order routing (Phase 3K).
-- 3. Creates team_members table for owner-managed outlet access.
--
-- See lib/db/schema.ts -> outlet_id columns + team_members for column
-- docstrings and rationale.

ALTER TABLE "restaurant_tables" ADD COLUMN "outlet_id" varchar(60) DEFAULT 'main' NOT NULL;
--> statement-breakpoint
CREATE INDEX "restaurant_tables_client_outlet_idx" ON "restaurant_tables" ("client_id","outlet_id");
--> statement-breakpoint

ALTER TABLE "dine_in_orders" ADD COLUMN "outlet_id" varchar(60) DEFAULT 'main' NOT NULL;
--> statement-breakpoint
ALTER TABLE "dine_in_orders" ADD COLUMN "delivery_lat" numeric(10, 7);
--> statement-breakpoint
ALTER TABLE "dine_in_orders" ADD COLUMN "delivery_lng" numeric(10, 7);
--> statement-breakpoint
CREATE INDEX "dine_in_orders_client_outlet_created_idx" ON "dine_in_orders" ("client_id","outlet_id","created_at");
--> statement-breakpoint

CREATE TABLE "team_members" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_client_id" text NOT NULL,
	"email" varchar(200) NOT NULL,
	"role" varchar(40) NOT NULL,
	"outlet_id" varchar(60) NOT NULL,
	"status" varchar(20) DEFAULT 'invited' NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"invited_by_email" varchar(200) DEFAULT ''
);
--> statement-breakpoint
CREATE INDEX "team_members_owner_outlet_status_idx" ON "team_members" ("owner_client_id","outlet_id","status");
--> statement-breakpoint
CREATE INDEX "team_members_email_status_idx" ON "team_members" ("email","status");
