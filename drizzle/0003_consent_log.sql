-- DPDPA 2023 §6 + §6(10) consent evidence ledger.
-- One row per consent event we rely on (inbound CSW, /m phone entry,
-- QR scan, marketing opt-in/out, erasure request). Lets us prove
-- which notice text was shown to which customer at which moment.
-- See lib/db/schema.ts -> consent_log for column docstrings.

CREATE TABLE "consent_log" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"customer_phone" varchar(32) NOT NULL,
	"event_type" varchar(40) NOT NULL,
	"source" varchar(80) DEFAULT '' NOT NULL,
	"business_name_shown" text DEFAULT '' NOT NULL,
	"notice_version" varchar(20) DEFAULT '' NOT NULL,
	"categories" text DEFAULT '[]' NOT NULL,
	"user_agent" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "consent_log_client_phone_idx" ON "consent_log" ("client_id","customer_phone");
--> statement-breakpoint
CREATE INDEX "consent_log_event_idx" ON "consent_log" ("event_type");
--> statement-breakpoint
CREATE INDEX "consent_log_created_idx" ON "consent_log" ("created_at");
