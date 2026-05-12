CREATE TABLE "dine_in_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"session_id" text,
	"table_number" varchar(16),
	"customer_phone" varchar(32) NOT NULL,
	"customer_name" varchar(200) DEFAULT '',
	"order_type" varchar(24) DEFAULT 'dine_in' NOT NULL,
	"items" text NOT NULL,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"delivery_address" text DEFAULT '',
	"status" varchar(24) DEFAULT 'placed' NOT NULL,
	"special_notes" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"served_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "restaurant_tables" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"table_number" varchar(16) NOT NULL,
	"qr_token" varchar(64) NOT NULL,
	"qr_token_rotated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seats" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "table_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"table_number" varchar(16) NOT NULL,
	"status" varchar(16) DEFAULT 'open' NOT NULL,
	"customer_phones" text DEFAULT '[]' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_reason" varchar(32)
);
--> statement-breakpoint
CREATE INDEX "dine_in_orders_client_created_idx" ON "dine_in_orders" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE INDEX "dine_in_orders_session_idx" ON "dine_in_orders" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "dine_in_orders_type_status_idx" ON "dine_in_orders" USING btree ("client_id","order_type","status");--> statement-breakpoint
CREATE UNIQUE INDEX "restaurant_tables_client_table_unique" ON "restaurant_tables" USING btree ("client_id","table_number");--> statement-breakpoint
CREATE INDEX "restaurant_tables_client_idx" ON "restaurant_tables" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "table_sessions_client_status_idx" ON "table_sessions" USING btree ("client_id","status");--> statement-breakpoint
CREATE INDEX "table_sessions_activity_idx" ON "table_sessions" USING btree ("last_activity_at");