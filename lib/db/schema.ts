// ─── Drizzle ORM schema for Neon Postgres ───
//
// Mirrors the Google Sheets tabs 1:1 so the Phase 2 cutover is mechanical.
// Each table is named after its Sheets tab; columns match field names
// (snake_case) used in lib/google-sheets.ts and lib/types.ts.
//
// Notes on type choices:
// - `text` is used over `varchar(n)` for content fields whose length is
//   bounded only by Sheets' 50k cell limit (system_prompt, knowledge_base_json).
// - Timestamps are stored as `timestamptz` (UTC); the application layer
//   continues to surface IST strings via lib/utils.ts.
// - Money: stored as `numeric(12, 2)` to avoid float drift on INR amounts.
// - Booleans: real `boolean` columns. The migration script converts the
//   Sheets `"TRUE"`/`"FALSE"` strings on the fly.

import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  varchar,
  integer,
  numeric,
  boolean,
  timestamp,
  primaryKey,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// ─── clients ─────────────────────────────────────────────────────────────

export const clients = pgTable(
  'clients',
  {
    client_id: text('client_id').primaryKey(),
    business_name: varchar('business_name', { length: 200 }).notNull(),
    type: varchar('type', { length: 50 }).notNull(), // restaurant|coaching|realestate|salon|d2c|gym
    owner_name: varchar('owner_name', { length: 200 }).notNull(),
    whatsapp_number: varchar('whatsapp_number', { length: 32 }).notNull(),
    phone_number_id: varchar('phone_number_id', { length: 100 }).default(''),
    city: varchar('city', { length: 100 }).default(''),
    system_prompt: text('system_prompt').default(''),
    knowledge_base_json: text('knowledge_base_json').default(''),
    status: varchar('status', { length: 50 }).notNull().default('pending'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    owner_user_id: varchar('owner_user_id', { length: 100 }).notNull(),
    upi_id: varchar('upi_id', { length: 100 }).default(''),
    upi_name: varchar('upi_name', { length: 100 }).default(''),
    existing_system: varchar('existing_system', { length: 100 }).default(''),
    export_format: varchar('export_format', { length: 10 }).default('csv'),
    contact_number: varchar('contact_number', { length: 32 }).default(''),
    opt_in_accepted: boolean('opt_in_accepted').notNull().default(false),
  },
  (t) => ({
    // The webhook hot-path looks up clients by phone_number_id on every
    // inbound message — must be indexed for sub-millisecond lookups.
    // Partial: empty strings (newly-onboarded bots that haven't set a
    // Meta phone_number_id yet) are excluded from the uniqueness check
    // since multiple pending bots can legitimately share an empty value.
    // Once a real ID is filled in, it remains globally unique.
    phoneNumberIdIdx: uniqueIndex('clients_phone_number_id_idx')
      .on(t.phone_number_id)
      .where(sql`${t.phone_number_id} <> ''`),
    ownerUserIdIdx: index('clients_owner_user_id_idx').on(t.owner_user_id),
    statusIdx: index('clients_status_idx').on(t.status),
  })
);

// ─── conversations ───────────────────────────────────────────────────────

export const conversations = pgTable(
  'conversations',
  {
    id: text('id').primaryKey(), // synthetic UUID; Sheets had no PK
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
    client_id: text('client_id').notNull(),
    customer_phone: varchar('customer_phone', { length: 32 }).notNull(),
    direction: varchar('direction', { length: 16 }).notNull(), // 'incoming' | 'outgoing'
    message: text('message').notNull(),
    message_type: varchar('message_type', { length: 32 }).notNull().default('text'),
  },
  (t) => ({
    clientIdIdx: index('conversations_client_id_idx').on(t.client_id),
    customerIdx: index('conversations_client_customer_idx').on(t.client_id, t.customer_phone),
    timestampIdx: index('conversations_timestamp_idx').on(t.timestamp),
  })
);

// ─── analytics (daily aggregates) ────────────────────────────────────────

export const analytics = pgTable(
  'analytics',
  {
    date: varchar('date', { length: 10 }).notNull(), // 'YYYY-MM-DD' (IST)
    client_id: text('client_id').notNull(),
    total_messages: integer('total_messages').notNull().default(0),
    unique_customers: integer('unique_customers').notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.date, t.client_id] }),
    clientIdIdx: index('analytics_client_id_idx').on(t.client_id),
  })
);

// ─── subscriptions ───────────────────────────────────────────────────────

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: text('id').primaryKey(), // synthetic UUID
    user_id: varchar('user_id', { length: 100 }).notNull(),
    plan: varchar('plan', { length: 32 }).notNull(), // trial|starter|growth|pro|enterprise
    status: varchar('status', { length: 32 }).notNull().default('active'),
    razorpay_payment_id: varchar('razorpay_payment_id', { length: 64 }).default(''),
    razorpay_order_id: varchar('razorpay_order_id', { length: 64 }).default(''),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull().default('0'),
    start_date: timestamp('start_date', { withTimezone: true }).notNull(),
    end_date: timestamp('end_date', { withTimezone: true }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdIdx: index('subscriptions_user_id_idx').on(t.user_id),
    // Idempotency guard: prevents the same Razorpay payment from creating
    // two subscription rows on duplicate webhook delivery. Partial — empty
    // payment ids (all trial subscriptions) are excluded from uniqueness so
    // multiple users can each have a trial row.
    paymentIdIdx: uniqueIndex('subscriptions_payment_id_idx')
      .on(t.razorpay_payment_id)
      .where(sql`${t.razorpay_payment_id} <> ''`),
    statusIdx: index('subscriptions_status_idx').on(t.status),
  })
);

// ─── bookings ────────────────────────────────────────────────────────────

export const bookings = pgTable(
  'bookings',
  {
    booking_id: text('booking_id').primaryKey(),
    client_id: text('client_id').notNull(),
    customer_phone: varchar('customer_phone', { length: 32 }).notNull(),
    customer_name: varchar('customer_name', { length: 200 }).default(''),
    date: varchar('date', { length: 10 }).notNull(), // 'YYYY-MM-DD' (IST)
    time_slot: varchar('time_slot', { length: 5 }).notNull(), // 'HH:MM'
    end_time: varchar('end_time', { length: 5 }).default(''), // 'HH:MM'
    service: varchar('service', { length: 200 }).default(''),
    // NULL = generic gym/business slot. Non-NULL = booked with this specific
    // trainer/staff member; conflict checks and the per-trainer calendar
    // view scope by staff_id when populated. Lets two customers book
    // DIFFERENT trainers in the same hour without one blocking the other.
    staff_id: text('staff_id'),
    status: varchar('status', { length: 32 }).notNull().default('pending_approval'),
    notes: text('notes').default(''),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    reminded: boolean('reminded').notNull().default(false),
    owner_notified: boolean('owner_notified').notNull().default(false),
  },
  (t) => ({
    clientIdIdx: index('bookings_client_id_idx').on(t.client_id),
    dateIdx: index('bookings_client_date_idx').on(t.client_id, t.date),
    customerIdx: index('bookings_client_customer_idx').on(t.client_id, t.customer_phone),
    statusIdx: index('bookings_status_idx').on(t.status),
    staffDateIdx: index('bookings_staff_date_idx').on(t.staff_id, t.date),
  })
);

// ─── pending_payments ────────────────────────────────────────────────────
// Tracks "bot just sent a [PAY:] tag, waiting on customer's screenshot" so
// the screenshot handler can verify the amount + UPI when it arrives. Used
// to live in a Sheets tab `pending_payments` (replaced as part of the
// Sheets→Neon cutover so Google Cloud credentials can be removed).
//
// Composite PK (client_id, customer_phone) matches the natural identity:
// one pending payment per customer per business. setPendingPayment is
// upsert-style — re-asking for the same customer overwrites the previous
// row, just like the Sheets implementation did.

export const pending_payments = pgTable(
  'pending_payments',
  {
    client_id: text('client_id').notNull(),
    customer_phone: varchar('customer_phone', { length: 32 }).notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    note: text('note').default(''),
    expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.client_id, t.customer_phone] }),
  })
);

// ─── staff ───────────────────────────────────────────────────────────────

export const staff = pgTable(
  'staff',
  {
    staff_id: text('staff_id').primaryKey(),
    client_id: text('client_id').notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    specialty: varchar('specialty', { length: 200 }).default(''),
    price: numeric('price', { precision: 12, scale: 2 }).notNull().default('0'),
    whatsapp_phone: varchar('whatsapp_phone', { length: 32 }).default(''),
    bio: text('bio').default(''),
    is_active: boolean('is_active').notNull().default(true),
    // Full Mon–Sun availability stored as a JSON string — matches the legacy
    // Sheets column-I layout 1:1 so the seed script can copy verbatim and
    // lib/staff.ts's parseAvailability() reads the same shape it always did.
    // (We considered splitting into 7 day-specific columns but the JSON-in-text
    // form is simpler, the cell is small enough to never approach Postgres
    // text limits, and no query needs to filter by inner block times.)
    availability: text('availability').default('{}'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    clientIdIdx: index('staff_client_id_idx').on(t.client_id),
    phoneIdx: index('staff_whatsapp_phone_idx').on(t.whatsapp_phone),
  })
);

// ─── inventory (products / menu / services) ──────────────────────────────

export const inventory = pgTable(
  'inventory',
  {
    client_id: text('client_id').notNull(),
    sku: varchar('sku', { length: 100 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    price: numeric('price', { precision: 12, scale: 2 }).notNull().default('0'),
    stock: integer('stock').notNull().default(-1), // -1 = unlimited
    low_stock_threshold: integer('low_stock_threshold').notNull().default(0),
    is_active: boolean('is_active').notNull().default(true),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    notes: text('notes').default(''),
    available_from: varchar('available_from', { length: 5 }).default(''), // 'HH:MM'
    available_to: varchar('available_to', { length: 5 }).default(''),
    available_days: varchar('available_days', { length: 64 }).default(''), // 'mon,tue,wed'
    // Logical grouping for multi-category UI. Examples per vertical:
    //   gym         → 'Membership Plans' | 'Personal Training' | 'Group Classes' | 'Merchandise' | 'Equipment'
    //   salon       → 'Services' | 'Packages' | 'Products' | 'Memberships'
    //   restaurant  → 'Menu' (with sub-cat in notes) | 'Combos' | 'Catering'
    //   coaching    → 'Courses' | 'Books' | 'Online Resources'
    //   d2c         → 'Products' | 'Subscriptions'
    //   realestate  → 'Listings' | 'Project Ads'
    // Empty string is treated as the vertical's default category at read time.
    // Note: 'Supplements' / 'Diet Plans' are intentionally not seeded for
    // any vertical — see lib/db/inventory-categories.ts header for the
    // WhatsApp Commerce Policy reasoning.
    category: varchar('category', { length: 100 }).default(''),
    // tracks_stock=false for service-type categories (memberships, classes,
    // services, courses) where "stock" is meaningless. UI hides stock fields
    // when this is false. Default true for backward compat with existing
    // restaurant/d2c rows.
    tracks_stock: boolean('tracks_stock').notNull().default(true),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.client_id, t.sku] }),
    clientIdIdx: index('inventory_client_id_idx').on(t.client_id),
    nameIdx: index('inventory_client_name_idx').on(t.client_id, t.name),
    categoryIdx: index('inventory_client_category_idx').on(t.client_id, t.category),
  })
);

// ─── inventory_categories (per-client category definitions) ─────────────

// Each client gets a list of category labels. Verticals come pre-seeded
// with sensible defaults (see lib/inventory-sync.ts), and the owner can
// add custom categories from /client/settings (e.g. "Diet Plans" for a
// gym, "Nail Art" for a salon). The `tracks_stock` flag controls whether
// the inventory page exposes stock + low-stock fields for items in that
// category.
export const inventoryCategories = pgTable(
  'inventory_categories',
  {
    id: text('id').primaryKey(),
    client_id: text('client_id').notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    tracks_stock: boolean('tracks_stock').notNull().default(true),
    display_order: integer('display_order').notNull().default(0),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    clientNameIdx: uniqueIndex('inventory_categories_client_name_idx').on(t.client_id, t.name),
    clientIdIdx: index('inventory_categories_client_id_idx').on(t.client_id),
  })
);

// ─── slots (weekly availability template per client) ─────────────────────

export const slots = pgTable(
  'slots',
  {
    id: text('id').primaryKey(),
    client_id: text('client_id').notNull(),
    day_of_week: varchar('day_of_week', { length: 12 }).notNull(), // 'monday'..'sunday'
    start_time: varchar('start_time', { length: 5 }).notNull(),
    end_time: varchar('end_time', { length: 5 }).notNull(),
    slot_duration_minutes: integer('slot_duration_minutes').notNull().default(30),
    is_active: boolean('is_active').notNull().default(true),
    service_type: varchar('service_type', { length: 100 }).default(''),
  },
  (t) => ({
    clientDayIdx: index('slots_client_day_idx').on(t.client_id, t.day_of_week),
  })
);

// ─── date_overrides (holidays / special hours) ───────────────────────────

export const date_overrides = pgTable(
  'date_overrides',
  {
    id: text('id').primaryKey(),
    client_id: text('client_id').notNull(),
    date: varchar('date', { length: 10 }).notNull(), // 'YYYY-MM-DD'
    override_type: varchar('override_type', { length: 16 }).notNull(), // 'blocked' | 'custom'
    custom_start: varchar('custom_start', { length: 5 }).default(''),
    custom_end: varchar('custom_end', { length: 5 }).default(''),
    reason: varchar('reason', { length: 200 }).default(''),
  },
  (t) => ({
    clientDateIdx: uniqueIndex('date_overrides_client_date_idx').on(t.client_id, t.date),
  })
);

// ─── template_submissions (Meta WhatsApp template approval state) ────────
// One row per (waba_id, template_name, language). Tracks the lifecycle of
// each template we submit to Meta's /message_templates endpoint, so the
// admin UI can show which templates are APPROVED vs PENDING vs REJECTED
// without re-querying Meta on every render. The submit script upserts on
// the natural key; the Meta webhook (`message_template_status_update`) is
// what later flips status PENDING -> APPROVED/REJECTED.
//
// Stored states (mirrors Meta's enum verbatim so we can store whatever
// Meta returns without translation):
//   PENDING | APPROVED | REJECTED | PAUSED | DISABLED | IN_APPEAL
export const template_submissions = pgTable(
  'template_submissions',
  {
    waba_id: varchar('waba_id', { length: 64 }).notNull(),
    template_name: varchar('template_name', { length: 100 }).notNull(),
    language: varchar('language', { length: 8 }).notNull(),
    category: varchar('category', { length: 32 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('PENDING'),
    // Meta's template ID (returned on creation); useful for the GET
    // status endpoint and for distinguishing two submissions of the same
    // name (Meta only allows one APPROVED per (name, language) pair).
    meta_template_id: varchar('meta_template_id', { length: 64 }).default(''),
    // Last error/reason text from Meta — surfaced verbatim in the admin
    // UI so the operator can fix the template body and resubmit.
    last_error: text('last_error').default(''),
    submitted_at: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.waba_id, t.template_name, t.language] }),
    statusIdx: index('template_submissions_status_idx').on(t.status),
  })
);

// ─── inferred row types ──────────────────────────────────────────────────

export type ClientRow = typeof clients.$inferSelect;
export type NewClientRow = typeof clients.$inferInsert;
export type ConversationRow = typeof conversations.$inferSelect;
export type NewConversationRow = typeof conversations.$inferInsert;
export type AnalyticsRow = typeof analytics.$inferSelect;
export type NewAnalyticsRow = typeof analytics.$inferInsert;
export type SubscriptionRow = typeof subscriptions.$inferSelect;
export type NewSubscriptionRow = typeof subscriptions.$inferInsert;
export type BookingRow = typeof bookings.$inferSelect;
export type NewBookingRow = typeof bookings.$inferInsert;
export type StaffRow = typeof staff.$inferSelect;
export type NewStaffRow = typeof staff.$inferInsert;
export type InventoryRow = typeof inventory.$inferSelect;
export type NewInventoryRow = typeof inventory.$inferInsert;
export type SlotRow = typeof slots.$inferSelect;
export type NewSlotRow = typeof slots.$inferInsert;
export type DateOverrideRow = typeof date_overrides.$inferSelect;
export type NewDateOverrideRow = typeof date_overrides.$inferInsert;
export type InventoryCategoryRow = typeof inventoryCategories.$inferSelect;
export type NewInventoryCategoryRow = typeof inventoryCategories.$inferInsert;
export type TemplateSubmissionRow = typeof template_submissions.$inferSelect;
export type NewTemplateSubmissionRow = typeof template_submissions.$inferInsert;
