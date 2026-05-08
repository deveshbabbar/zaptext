CREATE TABLE "admin_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_user_id" varchar(100) NOT NULL,
	"actor_email" varchar(200) DEFAULT '',
	"action" varchar(64) NOT NULL,
	"target_user_id" varchar(100) DEFAULT '',
	"target_email" varchar(200) DEFAULT '',
	"target_resource" varchar(200) DEFAULT '',
	"details_json" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics" (
	"date" varchar(10) NOT NULL,
	"client_id" text NOT NULL,
	"total_messages" integer DEFAULT 0 NOT NULL,
	"unique_customers" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "analytics_date_client_id_pk" PRIMARY KEY("date","client_id")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"booking_id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"customer_phone" varchar(32) NOT NULL,
	"customer_name" varchar(200) DEFAULT '',
	"date" varchar(10) NOT NULL,
	"time_slot" varchar(5) NOT NULL,
	"end_time" varchar(5) DEFAULT '',
	"service" varchar(200) DEFAULT '',
	"staff_id" text,
	"status" varchar(32) DEFAULT 'pending_approval' NOT NULL,
	"notes" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reminded" boolean DEFAULT false NOT NULL,
	"owner_notified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"client_id" text PRIMARY KEY NOT NULL,
	"business_name" varchar(200) NOT NULL,
	"type" varchar(50) NOT NULL,
	"owner_name" varchar(200) NOT NULL,
	"whatsapp_number" varchar(32) NOT NULL,
	"phone_number_id" varchar(100) DEFAULT '',
	"city" varchar(100) DEFAULT '',
	"system_prompt" text DEFAULT '',
	"knowledge_base_json" text DEFAULT '',
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_user_id" varchar(100) NOT NULL,
	"upi_id" varchar(100) DEFAULT '',
	"upi_name" varchar(100) DEFAULT '',
	"existing_system" varchar(100) DEFAULT '',
	"export_format" varchar(10) DEFAULT 'csv',
	"contact_number" varchar(32) DEFAULT '',
	"opt_in_accepted" boolean DEFAULT false NOT NULL,
	"stale_booking_minutes" integer
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"client_id" text NOT NULL,
	"customer_phone" varchar(32) NOT NULL,
	"direction" varchar(16) NOT NULL,
	"message" text NOT NULL,
	"message_type" varchar(32) DEFAULT 'text' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cron_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"task" varchar(64) NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"ok" boolean DEFAULT false NOT NULL,
	"result_json" text DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE "date_overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"date" varchar(10) NOT NULL,
	"override_type" varchar(16) NOT NULL,
	"custom_start" varchar(5) DEFAULT '',
	"custom_end" varchar(5) DEFAULT '',
	"reason" varchar(200) DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE "email_send_log" (
	"id" text PRIMARY KEY NOT NULL,
	"to_email" varchar(200) NOT NULL,
	"subject" text NOT NULL,
	"status" varchar(16) NOT NULL,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"last_error" text DEFAULT '',
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grocery_cart_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"customer_phone" varchar(32) NOT NULL,
	"payload" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grocery_daily_catalog" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"product_id" text NOT NULL,
	"date" varchar(10) NOT NULL,
	"price_per_unit" numeric(12, 2) NOT NULL,
	"in_stock" boolean DEFAULT true NOT NULL,
	"stock_qty" numeric(12, 2),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grocery_orders" (
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
);
--> statement-breakpoint
CREATE TABLE "grocery_products" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"name" varchar(100) NOT NULL,
	"name_aliases" text DEFAULT '[]' NOT NULL,
	"unit" varchar(16) NOT NULL,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grocery_recurring_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"customer_phone" varchar(32) NOT NULL,
	"day_of_week" integer NOT NULL,
	"slot_id" text NOT NULL,
	"template_items" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_run_date" varchar(10)
);
--> statement-breakpoint
CREATE TABLE "grocery_slots" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"label" varchar(100) NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"cutoff_time" varchar(5) NOT NULL,
	"days_of_week" text DEFAULT '[0,1,2,3,4,5,6]' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grocery_substitution_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"name" varchar(100) NOT NULL,
	"product_ids" text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grocery_zones" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"label" varchar(100) NOT NULL,
	"pincode" varchar(10),
	"area_keywords" text DEFAULT '[]' NOT NULL,
	"delivery_fee" numeric(12, 2) DEFAULT '0' NOT NULL,
	"min_order_for_free_delivery" numeric(12, 2),
	"min_order" numeric(12, 2)
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"client_id" text NOT NULL,
	"sku" varchar(100) NOT NULL,
	"name" varchar(200) NOT NULL,
	"price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"stock" integer DEFAULT -1 NOT NULL,
	"low_stock_threshold" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text DEFAULT '',
	"available_from" varchar(5) DEFAULT '',
	"available_to" varchar(5) DEFAULT '',
	"available_days" varchar(64) DEFAULT '',
	"category" varchar(100) DEFAULT '',
	"tracks_stock" boolean DEFAULT true NOT NULL,
	CONSTRAINT "inventory_client_id_sku_pk" PRIMARY KEY("client_id","sku")
);
--> statement-breakpoint
CREATE TABLE "inventory_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"name" varchar(100) NOT NULL,
	"tracks_stock" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paused_customers" (
	"client_id" text NOT NULL,
	"customer_phone" text NOT NULL,
	"paused_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paused_until" timestamp with time zone,
	"paused_by" text DEFAULT '' NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	CONSTRAINT "paused_customers_client_id_customer_phone_pk" PRIMARY KEY("client_id","customer_phone")
);
--> statement-breakpoint
CREATE TABLE "pending_payments" (
	"client_id" text NOT NULL,
	"customer_phone" varchar(32) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"note" text DEFAULT '',
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "pending_payments_client_id_customer_phone_pk" PRIMARY KEY("client_id","customer_phone")
);
--> statement-breakpoint
CREATE TABLE "processed_webhook_messages" (
	"message_id" varchar(200) PRIMARY KEY NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slots" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"day_of_week" varchar(12) NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"slot_duration_minutes" integer DEFAULT 30 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"service_type" varchar(100) DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"staff_id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"name" varchar(200) NOT NULL,
	"specialty" varchar(200) DEFAULT '',
	"price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"whatsapp_phone" varchar(32) DEFAULT '',
	"bio" text DEFAULT '',
	"is_active" boolean DEFAULT true NOT NULL,
	"availability" text DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"plan" varchar(32) NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"razorpay_payment_id" varchar(64) DEFAULT '',
	"razorpay_order_id" varchar(64) DEFAULT '',
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_warned_period" varchar(8)
);
--> statement-breakpoint
CREATE TABLE "template_submissions" (
	"waba_id" varchar(64) NOT NULL,
	"template_name" varchar(100) NOT NULL,
	"language" varchar(8) NOT NULL,
	"category" varchar(32) NOT NULL,
	"status" varchar(32) DEFAULT 'PENDING' NOT NULL,
	"meta_template_id" varchar(64) DEFAULT '',
	"last_error" text DEFAULT '',
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "template_submissions_waba_id_template_name_language_pk" PRIMARY KEY("waba_id","template_name","language")
);
--> statement-breakpoint
CREATE TABLE "usage_counters" (
	"client_id" text NOT NULL,
	"period_key" varchar(16) NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"period_start" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_counters_client_id_period_key_pk" PRIMARY KEY("client_id","period_key")
);
--> statement-breakpoint
CREATE TABLE "welcome_menus" (
	"client_id" text PRIMARY KEY NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"use_auto_generated" boolean DEFAULT true NOT NULL,
	"header_text" varchar(60) DEFAULT '' NOT NULL,
	"body_text" varchar(1024) DEFAULT '' NOT NULL,
	"footer_text" varchar(60) DEFAULT '' NOT NULL,
	"items_json" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "admin_audit_log_action_idx" ON "admin_audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "admin_audit_log_actor_idx" ON "admin_audit_log" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "admin_audit_log_target_user_idx" ON "admin_audit_log" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "admin_audit_log_created_idx" ON "admin_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "analytics_client_id_idx" ON "analytics" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "bookings_client_id_idx" ON "bookings" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "bookings_client_date_idx" ON "bookings" USING btree ("client_id","date");--> statement-breakpoint
CREATE INDEX "bookings_client_customer_idx" ON "bookings" USING btree ("client_id","customer_phone");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bookings_staff_date_idx" ON "bookings" USING btree ("staff_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "clients_phone_number_id_idx" ON "clients" USING btree ("phone_number_id") WHERE "clients"."phone_number_id" <> '';--> statement-breakpoint
CREATE INDEX "clients_owner_user_id_idx" ON "clients" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "clients_status_idx" ON "clients" USING btree ("status");--> statement-breakpoint
CREATE INDEX "conversations_client_id_idx" ON "conversations" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "conversations_client_customer_idx" ON "conversations" USING btree ("client_id","customer_phone");--> statement-breakpoint
CREATE INDEX "conversations_timestamp_idx" ON "conversations" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "cron_runs_task_started_idx" ON "cron_runs" USING btree ("task","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "date_overrides_client_date_idx" ON "date_overrides" USING btree ("client_id","date");--> statement-breakpoint
CREATE INDEX "email_send_log_sent_at_idx" ON "email_send_log" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "email_send_log_status_idx" ON "email_send_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "email_send_log_to_idx" ON "email_send_log" USING btree ("to_email");--> statement-breakpoint
CREATE INDEX "grocery_cart_drafts_exp_idx" ON "grocery_cart_drafts" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "grocery_daily_catalog_uniq" ON "grocery_daily_catalog" USING btree ("client_id","product_id","date");--> statement-breakpoint
CREATE INDEX "grocery_daily_catalog_date_idx" ON "grocery_daily_catalog" USING btree ("client_id","date");--> statement-breakpoint
CREATE INDEX "grocery_orders_client_idx" ON "grocery_orders" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "grocery_orders_slot_date_idx" ON "grocery_orders" USING btree ("client_id","slot_date");--> statement-breakpoint
CREATE INDEX "grocery_orders_customer_idx" ON "grocery_orders" USING btree ("client_id","customer_phone");--> statement-breakpoint
CREATE INDEX "grocery_products_client_idx" ON "grocery_products" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "grocery_recur_client_idx" ON "grocery_recurring_orders" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "grocery_recur_day_idx" ON "grocery_recurring_orders" USING btree ("day_of_week","is_active");--> statement-breakpoint
CREATE INDEX "grocery_slots_client_idx" ON "grocery_slots" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "grocery_subgroups_client_idx" ON "grocery_substitution_groups" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "grocery_zones_client_idx" ON "grocery_zones" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "inventory_client_id_idx" ON "inventory" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "inventory_client_name_idx" ON "inventory" USING btree ("client_id","name");--> statement-breakpoint
CREATE INDEX "inventory_client_category_idx" ON "inventory" USING btree ("client_id","category");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_categories_client_name_idx" ON "inventory_categories" USING btree ("client_id","name");--> statement-breakpoint
CREATE INDEX "inventory_categories_client_id_idx" ON "inventory_categories" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "processed_webhook_messages_processed_at_idx" ON "processed_webhook_messages" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX "slots_client_day_idx" ON "slots" USING btree ("client_id","day_of_week");--> statement-breakpoint
CREATE INDEX "staff_client_id_idx" ON "staff" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "staff_whatsapp_phone_idx" ON "staff" USING btree ("whatsapp_phone");--> statement-breakpoint
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_payment_id_idx" ON "subscriptions" USING btree ("razorpay_payment_id") WHERE "subscriptions"."razorpay_payment_id" <> '';--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "template_submissions_status_idx" ON "template_submissions" USING btree ("status");