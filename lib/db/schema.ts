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
    // Per-bot override for the auto-cancel-pending-booking timeout. NULL =
    // use the platform default (60 min). Lets a gym with slow-responding
    // trainers raise this to 120 or 240 without changing global behaviour.
    // Range guard is enforced at the API boundary (clamp to [30, 240]).
    stale_booking_minutes: integer('stale_booking_minutes'),
    // Storefront subdomain (Phase 4-S). Empty until the owner enables the
    // storefront; non-empty values must be DNS-safe (a-z, 0-9, hyphen) and
    // are globally unique via the partial index below. Powers the
    // <slug>.zaptext.shop public ordering page.
    slug: varchar('slug', { length: 80 }).notNull().default(''),
    // JSON array of serviceable delivery pincodes, stored as text to match
    // the existing "JSON-in-text" pattern used by table_sessions and
    // grocery categories. Empty '[]' = no pincode gating (storefront
    // accepts orders from anywhere).
    service_pincodes: text('service_pincodes').notNull().default('[]'),
    // Storefront opt-in toggle. Owner must flip ON from settings before
    // the subdomain rewrite serves real orders — prevents accidental
    // exposure of half-configured menus.
    storefront_enabled: boolean('storefront_enabled').notNull().default(false),
    // FSSAI allergen-safety guardrail (Work Item 4). When ON (default),
    // the bot is instructed to REFUSE allergen-safety confirmations for
    // any menu item whose declared allergens[] is empty — instead routes
    // the customer to call the kitchen. Mandatory for chains with 10+
    // outlets under FSSAI 2020 Menu Labelling Regulations; default-on
    // for everyone because the downside (a refusal) is cheap and the
    // upside (avoiding an anaphylaxis claim) is unbounded. Owners can
    // toggle OFF from /client/settings if they've populated allergen
    // data on every item.
    allergen_strict_mode: boolean('allergen_strict_mode').notNull().default(true),
    // Kitchen capacity gate (Work Item 5). Maximum number of concurrent
    // in-flight orders (status placed/preparing/ready, created in the
    // last 15 minutes) the kitchen can handle. When the live count
    // reaches this number the webhook injects a "kitchen at capacity"
    // instruction and the bot quotes a wait-time instead of accepting
    // the [ORDER:] tag. NULL = use platform default (8). Clamped to
    // [1, 200] at the API boundary.
    concurrent_order_cap: integer('concurrent_order_cap'),
    // Per-channel owner notification toggles. All default ON; owner can
    // mute individual channels in Bot Settings. Webhook checks these
    // before firing the corresponding outbound for every order /
    // booking / payment event. Defaults TRUE so legacy bots on
    // un-migrated environments behave as they always did.
    notify_whatsapp: boolean('notify_whatsapp').notNull().default(true),
    notify_email: boolean('notify_email').notNull().default(true),
    notify_dashboard: boolean('notify_dashboard').notNull().default(true),
    // Order approval mode. 'auto' (default): bot checks stock + capacity
    // and emits [ORDER:] directly; owner is notified after the fact.
    // 'manual': bot emits [ORDER_PENDING:], creates the booking in
    // pending_approval status, pings the owner on WhatsApp with
    // interactive Approve/Decline buttons, and tells the customer to
    // wait. Owner's button click flips status to confirmed/cancelled
    // and the bot relays the outcome to the customer.
    order_approval_mode: varchar('order_approval_mode', { length: 16 }).notNull().default('auto'),
    // Default conversation language for the WELCOME / first-touch
    // message. Per-message detection (Devanagari script + Hinglish
    // keyword scan in webhook) still overrides this once the customer
    // speaks. Values: 'english' | 'hindi' | 'hinglish'.
    default_language: varchar('default_language', { length: 16 }).notNull().default('english'),
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
    // Storefront subdomain lookup. Same partial-unique pattern as
    // phone_number_id — empty strings are allowed (pre-storefront bots),
    // any non-empty slug is globally unique.
    slugIdx: uniqueIndex('clients_slug_unique')
      .on(t.slug)
      .where(sql`${t.slug} <> ''`),
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
    // Conversation priority (Work Item 7). Per-message classification:
    //   'normal'    — routine message
    //   'attention' — refund / wrong-order / late / aggregator-threat
    //   'urgent'    — food poisoning / illness / legal / police / FSSAI
    // The conversations list page surfaces threads whose LAST inbound
    // is non-normal at the top — owner reply (next outbound) implicitly
    // clears the alert. Always 'normal' for outbound rows.
    priority_level: varchar('priority_level', { length: 16 }).notNull().default('normal'),
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
    // Tracks which expiry-warning email has been sent for this row.
    // null  = nothing sent yet
    // '7d'  = 7-day warning sent (still need to send 1d warning)
    // '1d'  = 1-day warning sent (final state until renewal)
    // Cron uses this to avoid re-sending the same warning every day.
    last_warned_period: varchar('last_warned_period', { length: 8 }),
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
    // Vertical-specific fields stored as a JSON blob so we can extend the
    // staff schema without a migration per vertical. Examples:
    //   salon  → { role, gender, photo, perServiceUpcharge, specialties[], experienceYears }
    //   gym    → { gender, certifications[], specialisations[], packageSessions, packagePriceRupees, femaleOnly, experienceYears }
    //   realestate → { agentReraNumber, agentReraState, agentReraExpiry, role }
    // Empty '{}' for legacy rows. UI strips unknown keys per vertical so
    // owner edits don't pollute the blob with cross-vertical fields.
    extra_json: text('extra_json').notNull().default('{}'),
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

// ─── paused_customers (per-customer "human is taking over" flag) ────────
// When the owner clicks "Take over" on the conversations page for a
// specific customer, a row is inserted here. Webhook checks this table
// BEFORE running AI — if the customer is paused, the bot stays silent
// and the owner is responsible for replying via the dashboard's send-box.
//
// Pauses are typically permanent until the owner clicks "Resume" — but
// the schema includes paused_until so a future "auto-resume after 24h"
// option can be added without a migration. NULL = paused indefinitely.
export const paused_customers = pgTable(
  'paused_customers',
  {
    client_id: text('client_id').notNull(),
    customer_phone: text('customer_phone').notNull(),
    paused_at: timestamp('paused_at', { withTimezone: true }).notNull().defaultNow(),
    paused_until: timestamp('paused_until', { withTimezone: true }),
    paused_by: text('paused_by').notNull().default(''), // clerk userId who paused
    reason: text('reason').notNull().default(''),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.client_id, t.customer_phone] }),
  })
);

// ─── welcome_menus (per-client first-message interactive menu) ────────
// When a customer sends their first message in a 7-day window, the bot
// replies with a list message: a greeting, a body prompt, and up to 10
// tappable options (e.g. "Talk to a trainer", "Today's timings"). Tapping
// an option becomes the user's effective intent and is fed to the AI.
//
// `use_auto_generated=true` (default): the bot ignores items_json and
// builds the menu live from the client's actual data — staff names from
// the staff table, services from inventory, plus per-vertical defaults
// (gym vs salon vs clinic vs restaurant vs coaching).
//
// `use_auto_generated=false`: the owner takes control via /client/welcome-menu
// and items_json is honored as-is. Used by clients who want bespoke wording.
export const welcome_menus = pgTable(
  'welcome_menus',
  {
    client_id: text('client_id').primaryKey(),
    is_enabled: boolean('is_enabled').notNull().default(true),
    use_auto_generated: boolean('use_auto_generated').notNull().default(true),
    header_text: varchar('header_text', { length: 60 }).notNull().default(''),
    body_text: varchar('body_text', { length: 1024 }).notNull().default(''),
    footer_text: varchar('footer_text', { length: 60 }).notNull().default(''),
    // JSON array of { id: string, label: string, description?: string }.
    // Up to 10 items per Meta's list-message limit. Stored as text to keep
    // schema portable and avoid Drizzle JSON-column quirks.
    items_json: text('items_json').notNull().default('[]'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  }
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

// ─── admin_audit_log ─────────────────────────────────────────────────────
//
// Immutable record of every admin-side mutation: granting a plan, seeding
// a test bot onto someone else's account, deleting a client, etc. Lets us
// answer "who did this and when" after the fact — previously these
// actions were untraceable, which is a real problem for billing disputes
// and abuse investigations. Append-only: nothing in the app deletes from
// here. Old rows can be archived out-of-band if the table grows large.
export const admin_audit_log = pgTable(
  'admin_audit_log',
  {
    id: text('id').primaryKey(),               // synthetic UUID
    actor_user_id: varchar('actor_user_id', { length: 100 }).notNull(),
    actor_email: varchar('actor_email', { length: 200 }).default(''),
    action: varchar('action', { length: 64 }).notNull(),  // e.g. 'plan.grant', 'bot.seed', 'client.delete'
    target_user_id: varchar('target_user_id', { length: 100 }).default(''),
    target_email: varchar('target_email', { length: 200 }).default(''),
    target_resource: varchar('target_resource', { length: 200 }).default(''),
    // Free-form JSON blob (stored as text) so callers can attach plan
    // names, durations, prior values, etc. without a schema change.
    details_json: text('details_json').default(''),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    actionIdx: index('admin_audit_log_action_idx').on(t.action),
    actorIdx: index('admin_audit_log_actor_idx').on(t.actor_user_id),
    targetUserIdx: index('admin_audit_log_target_user_idx').on(t.target_user_id),
    createdIdx: index('admin_audit_log_created_idx').on(t.created_at),
  })
);

// ─── email_send_log (deliverability observability) ────────────────────
//
// Every transactional email passes through sendEmail in lib/email.ts.
// Failures used to be logged to console only — operators couldn't see
// which owner missed which booking notification or trace deliverability
// trends. This table captures one row per send attempt outcome.
//
// status:
//   'sent'      — ZeptoMail accepted (200 OK)
//   'retrying'  — last attempt failed but more retries remain
//   'failed'    — all retries exhausted
// attempt_count is the final attempt number (1..MAX_ATTEMPTS).
// last_error is the truncated upstream error (first 500 chars) on failure.
// Powers the upcoming /admin/email-log dashboard.
export const email_send_log = pgTable(
  'email_send_log',
  {
    id: text('id').primaryKey(),
    to_email: varchar('to_email', { length: 200 }).notNull(),
    subject: text('subject').notNull(),
    status: varchar('status', { length: 16 }).notNull(),
    attempt_count: integer('attempt_count').notNull().default(1),
    last_error: text('last_error').default(''),
    sent_at: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sentAtIdx: index('email_send_log_sent_at_idx').on(t.sent_at),
    statusIdx: index('email_send_log_status_idx').on(t.status),
    toIdx: index('email_send_log_to_idx').on(t.to_email),
  })
);

// ─── usage_counters (atomic quota) ──────────────────────────────────────
//
// Replaces the read-then-act pattern in the webhook (count outbound rows
// → check quota → process → insert). With high concurrency, two messages
// could BOTH read used=N, BOTH pass the cap check, and BOTH process — so a
// bot on a 10k/month plan could end the month at 10,002. Atomic counter
// with INSERT ... ON CONFLICT DO UPDATE ... RETURNING count gives us the
// post-increment value in one round-trip, eliminating the window.
//
// `period_key` is 'YYYY-MM' (UTC) for monthly cycles. Trial bots use
// 'lifetime' as the period_key — a single row that just keeps growing.
// `period_start` is a proper timestamptz for human readability and
// future analytics; the gate uses period_key for equality.
export const usage_counters = pgTable(
  'usage_counters',
  {
    client_id: text('client_id').notNull(),
    period_key: varchar('period_key', { length: 16 }).notNull(),
    count: integer('count').notNull().default(0),
    period_start: timestamp('period_start', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.client_id, t.period_key] }),
  })
);

// ─── cron_runs (idempotency + observability) ───────────────────────────
//
// Vercel Cron has retry semantics: if our cron handler times out the next
// scheduled tick can fire on a fresh lambda WHILE the prior one is still
// running, leading to duplicate sends (digests, reminders, auto-cancels).
// Each cron route now records a row here at start, and refuses to re-run
// the same task if a successful run finished within the lockout window.
// Doubles as a /admin/cron observability source.
//
// Lifecycle:
//   1. Cron handler reads recent rows for `task`. If any successful run
//      finished within `lockoutSec`, return early ("already done").
//   2. Otherwise INSERT a row with started_at = now, ok = false.
//   3. After processing, UPDATE finished_at + ok + result_json.
//
// Columns:
//   id            synthetic UUID
//   task          short identifier ('morning-summary', 'reminders', ...)
//   started_at    when the handler claimed the run
//   finished_at   nullable until completion
//   ok            true on clean completion, false until then
//   result_json   summary blob (counts, errors slice) — capped at 4kB
export const cron_runs = pgTable(
  'cron_runs',
  {
    id: text('id').primaryKey(),
    task: varchar('task', { length: 64 }).notNull(),
    started_at: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finished_at: timestamp('finished_at', { withTimezone: true }),
    ok: boolean('ok').notNull().default(false),
    result_json: text('result_json').default(''),
  },
  (t) => ({
    taskStartedIdx: index('cron_runs_task_started_idx').on(t.task, t.started_at),
  })
);

// ─── processed_webhook_messages (dedup) ──────────────────────────────────
//
// Meta's WhatsApp webhook can retry the same message_id when our 200 OK
// reply doesn't reach them in time. The previous in-memory Set was wiped
// on Vercel cold starts, so a retry hitting a fresh instance reprocessed
// the message — creating duplicate orders, double-bookings, and burning
// extra Groq quota. This table is the durable replacement: we INSERT the
// message_id with ON CONFLICT DO NOTHING and treat zero affected rows as
// "duplicate, skip processing". Cleanup of old rows is handled by a
// daily cron (entries older than 7 days can be dropped — Meta retries
// stop well within 24 hours).
export const processed_webhook_messages = pgTable(
  'processed_webhook_messages',
  {
    message_id: varchar('message_id', { length: 200 }).primaryKey(),
    processed_at: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    processedAtIdx: index('processed_webhook_messages_processed_at_idx').on(t.processed_at),
  })
);

// ─── restaurant dine-in: tables, sessions, orders ───────────────────────
//
// QR-code-driven dine-in flow:
//   1. restaurant_tables — one row per physical table; holds the rotating
//      shift token used in the QR's wa.me URL.
//   2. table_sessions — one row per "customer-at-table" session. Opens on
//      the first valid scan, auto-closes after 2hr inactivity or manager
//      action. customer_phones is a JSON array — multiple phones can join
//      the same table.
//   3. dine_in_orders — every order coming from a table session, with
//      explicit order_type so dine-in / home-delivery / parcel-takeaway
//      flow into separate sections of the manager dashboard.

export const restaurant_tables = pgTable(
  'restaurant_tables',
  {
    id: text('id').primaryKey(),
    client_id: text('client_id').notNull(),
    table_number: varchar('table_number', { length: 16 }).notNull(),
    qr_token: varchar('qr_token', { length: 64 }).notNull(),
    qr_token_rotated_at: timestamp('qr_token_rotated_at', { withTimezone: true }).notNull().defaultNow(),
    seats: integer('seats').default(0),
    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // Multi-outlet scoping. Default 'main' so single-outlet kitchens
    // are unaffected (their data continues to live under one synthetic
    // outlet). When a kitchen opts into multi-outlet, the slug becomes
    // their per-outlet identifier (e.g. 'SAK', 'CP', 'GUR').
    outlet_id: varchar('outlet_id', { length: 60 }).notNull().default('main'),
  },
  (t) => ({
    clientTableUnique: uniqueIndex('restaurant_tables_client_table_unique').on(t.client_id, t.table_number),
    clientIdx: index('restaurant_tables_client_idx').on(t.client_id),
    clientOutletIdx: index('restaurant_tables_client_outlet_idx').on(t.client_id, t.outlet_id),
  })
);

export const table_sessions = pgTable(
  'table_sessions',
  {
    id: text('id').primaryKey(),
    client_id: text('client_id').notNull(),
    table_number: varchar('table_number', { length: 16 }).notNull(),
    status: varchar('status', { length: 16 }).notNull().default('open'),
    customer_phones: text('customer_phones').notNull().default('[]'),
    started_at: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    last_activity_at: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
    closed_at: timestamp('closed_at', { withTimezone: true }),
    closed_reason: varchar('closed_reason', { length: 32 }),
  },
  (t) => ({
    clientStatusIdx: index('table_sessions_client_status_idx').on(t.client_id, t.status),
    activityIdx: index('table_sessions_activity_idx').on(t.last_activity_at),
  })
);

export const dine_in_orders = pgTable(
  'dine_in_orders',
  {
    id: text('id').primaryKey(),
    client_id: text('client_id').notNull(),
    session_id: text('session_id'),
    table_number: varchar('table_number', { length: 16 }),
    customer_phone: varchar('customer_phone', { length: 32 }).notNull(),
    customer_name: varchar('customer_name', { length: 200 }).default(''),
    order_type: varchar('order_type', { length: 24 }).notNull().default('dine_in'),
    items: text('items').notNull(),
    subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull().default('0'),
    total: numeric('total', { precision: 12, scale: 2 }).notNull().default('0'),
    delivery_address: text('delivery_address').default(''),
    status: varchar('status', { length: 24 }).notNull().default('placed'),
    special_notes: text('special_notes').default(''),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    served_at: timestamp('served_at', { withTimezone: true }),
    // Multi-outlet scoping — same pattern as restaurant_tables. The
    // dashboard layer filters by outlet_id for outlet-manager roles;
    // owner queries leave it un-filtered. Default 'main' covers all
    // pre-multi-outlet rows.
    outlet_id: varchar('outlet_id', { length: 60 }).notNull().default('main'),
    // Optional customer-supplied location coords (Phase 3K — WhatsApp
    // native location messages OR map-pin from /m page). NULL when the
    // customer didn't share location. Used by zone-assignment math to
    // pick the right outlet at order time.
    delivery_lat: numeric('delivery_lat', { precision: 10, scale: 7 }),
    delivery_lng: numeric('delivery_lng', { precision: 10, scale: 7 }),
  },
  (t) => ({
    clientCreatedIdx: index('dine_in_orders_client_created_idx').on(t.client_id, t.created_at),
    sessionIdx: index('dine_in_orders_session_idx').on(t.session_id),
    typeStatusIdx: index('dine_in_orders_type_status_idx').on(t.client_id, t.order_type, t.status),
    clientOutletCreatedIdx: index('dine_in_orders_client_outlet_created_idx').on(t.client_id, t.outlet_id, t.created_at),
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
export type WelcomeMenuRow = typeof welcome_menus.$inferSelect;
export type NewWelcomeMenuRow = typeof welcome_menus.$inferInsert;
export type PausedCustomerRow = typeof paused_customers.$inferSelect;
export type NewPausedCustomerRow = typeof paused_customers.$inferInsert;
export type RestaurantTableRow = typeof restaurant_tables.$inferSelect;
export type NewRestaurantTableRow = typeof restaurant_tables.$inferInsert;
export type TableSessionRow = typeof table_sessions.$inferSelect;
export type NewTableSessionRow = typeof table_sessions.$inferInsert;
export type DineInOrderRow = typeof dine_in_orders.$inferSelect;
export type NewDineInOrderRow = typeof dine_in_orders.$inferInsert;

// ─── grocery vertical ────────────────────────────────────────────────────

export const grocery_products = pgTable(
  'grocery_products',
  {
    id: text('id').primaryKey(),
    client_id: text('client_id').notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    name_aliases: text('name_aliases').notNull().default('[]'), // JSON array
    unit: varchar('unit', { length: 16 }).notNull(),
    image_url: text('image_url'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    clientIdx: index('grocery_products_client_idx').on(t.client_id),
  })
);

export const grocery_daily_catalog = pgTable(
  'grocery_daily_catalog',
  {
    id: text('id').primaryKey(),
    client_id: text('client_id').notNull(),
    product_id: text('product_id').notNull(),
    date: varchar('date', { length: 10 }).notNull(), // YYYY-MM-DD
    price_per_unit: numeric('price_per_unit', { precision: 12, scale: 2 }).notNull(),
    in_stock: boolean('in_stock').notNull().default(true),
    stock_qty: numeric('stock_qty', { precision: 12, scale: 2 }),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqDay: uniqueIndex('grocery_daily_catalog_uniq')
      .on(t.client_id, t.product_id, t.date),
    dateIdx: index('grocery_daily_catalog_date_idx').on(t.client_id, t.date),
  })
);

export const grocery_substitution_groups = pgTable(
  'grocery_substitution_groups',
  {
    id: text('id').primaryKey(),
    client_id: text('client_id').notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    product_ids: text('product_ids').notNull().default('[]'), // JSON array
  },
  (t) => ({
    clientIdx: index('grocery_subgroups_client_idx').on(t.client_id),
  })
);

export const grocery_zones = pgTable(
  'grocery_zones',
  {
    id: text('id').primaryKey(),
    client_id: text('client_id').notNull(),
    label: varchar('label', { length: 100 }).notNull(),
    pincode: varchar('pincode', { length: 10 }),
    area_keywords: text('area_keywords').notNull().default('[]'),
    delivery_fee: numeric('delivery_fee', { precision: 12, scale: 2 }).notNull().default('0'),
    min_order_for_free_delivery: numeric('min_order_for_free_delivery', { precision: 12, scale: 2 }),
    min_order: numeric('min_order', { precision: 12, scale: 2 }),
  },
  (t) => ({
    clientIdx: index('grocery_zones_client_idx').on(t.client_id),
  })
);

export const grocery_slots = pgTable(
  'grocery_slots',
  {
    id: text('id').primaryKey(),
    client_id: text('client_id').notNull(),
    label: varchar('label', { length: 100 }).notNull(),
    start_time: varchar('start_time', { length: 5 }).notNull(),
    end_time: varchar('end_time', { length: 5 }).notNull(),
    cutoff_time: varchar('cutoff_time', { length: 5 }).notNull(),
    days_of_week: text('days_of_week').notNull().default('[0,1,2,3,4,5,6]'),
    is_active: boolean('is_active').notNull().default(true),
  },
  (t) => ({
    clientIdx: index('grocery_slots_client_idx').on(t.client_id),
  })
);

export const grocery_orders = pgTable(
  'grocery_orders',
  {
    id: text('id').primaryKey(),
    client_id: text('client_id').notNull(),
    customer_phone: varchar('customer_phone', { length: 32 }).notNull(),
    customer_name: varchar('customer_name', { length: 200 }),
    delivery_address: text('delivery_address').notNull(),
    zone_id: text('zone_id').notNull(),
    slot_id: text('slot_id').notNull(),
    slot_date: varchar('slot_date', { length: 10 }).notNull(),
    items: text('items').notNull(), // JSON: CartItem[]
    subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
    delivery_fee: numeric('delivery_fee', { precision: 12, scale: 2 }).notNull(),
    total: numeric('total', { precision: 12, scale: 2 }).notNull(),
    status: varchar('status', { length: 16 }).notNull().default('pending'),
    payment_mode: varchar('payment_mode', { length: 16 }).notNull().default('cod'),
    notes: text('notes'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    clientIdx: index('grocery_orders_client_idx').on(t.client_id),
    slotDateIdx: index('grocery_orders_slot_date_idx').on(t.client_id, t.slot_date),
    customerIdx: index('grocery_orders_customer_idx').on(t.client_id, t.customer_phone),
  })
);

export const grocery_recurring_orders = pgTable(
  'grocery_recurring_orders',
  {
    id: text('id').primaryKey(),
    client_id: text('client_id').notNull(),
    customer_phone: varchar('customer_phone', { length: 32 }).notNull(),
    day_of_week: integer('day_of_week').notNull(),
    slot_id: text('slot_id').notNull(),
    template_items: text('template_items').notNull(), // JSON CartItem[]
    is_active: boolean('is_active').notNull().default(true),
    last_run_date: varchar('last_run_date', { length: 10 }),
  },
  (t) => ({
    clientIdx: index('grocery_recur_client_idx').on(t.client_id),
    dayIdx: index('grocery_recur_day_idx').on(t.day_of_week, t.is_active),
  })
);

export const grocery_cart_drafts = pgTable(
  'grocery_cart_drafts',
  {
    id: text('id').primaryKey(), // ${client_id}:${customer_phone}
    client_id: text('client_id').notNull(),
    customer_phone: varchar('customer_phone', { length: 32 }).notNull(),
    payload: text('payload').notNull(), // JSON CartDraft
    expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    expIdx: index('grocery_cart_drafts_exp_idx').on(t.expires_at),
  })
);

// ─── consent_log (DPDPA 2023) ────────────────────────────────────────────
//
// Evidence ledger for every consent event we rely on under the Digital
// Personal Data Protection Act 2023 §6 ("free, specific, informed,
// unconditional and unambiguous") and Meta's Business Messaging Policy
// opt-in requirements. DPDPA §6(10): "the Data Fiduciary shall be
// obliged to prove that a notice was given by her to the Data Principal
// and consent was given" — i.e. we need a row per event we'll later cite.
//
// event_type values:
//   - inbound_csw         — customer's first inbound message in the
//                           7-day window, opens the 24-h customer
//                           service window. NOT marketing opt-in.
//   - menu_phone_entry    — customer typed their phone on /m/<clientId>
//                           and confirmed the order — covers reorder
//                           history retention + WA confirmation send.
//   - qr_scan_start       — customer scanned table QR + tapped Send on
//                           the pre-filled message (consent flow).
//   - marketing_opt_in    — explicit "yes I want offers" event.
//   - marketing_opt_out   — STOP / RUKO keyword or unsubscribe tap.
//   - erasure_request     — DPDPA §12 right-to-erasure invocation by the
//                           customer; 90-day SLA to honour.
//
// `business_name_shown` records the EXACT business-name string the user
// saw at consent time — needed because the bot may be re-branded later
// and we still need to attest to the original disclosure.
// `notice_version` is the privacy-notice version string so we can prove
// which text was shown. `categories` is a JSON-stringified string[] of
// permission categories granted at this event.
export const consent_log = pgTable(
  'consent_log',
  {
    id: text('id').primaryKey(),
    client_id: text('client_id').notNull(),
    customer_phone: varchar('customer_phone', { length: 32 }).notNull(),
    event_type: varchar('event_type', { length: 40 }).notNull(),
    source: varchar('source', { length: 80 }).notNull().default(''),
    business_name_shown: text('business_name_shown').notNull().default(''),
    notice_version: varchar('notice_version', { length: 20 }).notNull().default(''),
    categories: text('categories').notNull().default('[]'),
    user_agent: text('user_agent').default(''),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    clientPhoneIdx: index('consent_log_client_phone_idx').on(t.client_id, t.customer_phone),
    eventIdx: index('consent_log_event_idx').on(t.event_type),
    createdIdx: index('consent_log_created_idx').on(t.created_at),
  })
);

// ─── team_members (multi-outlet role-based access) ───────────────────────
//
// One row per (owner_client_id, email, outlet_id) assignment. Restaurant
// chains use this to let outlet managers log in with their own email and
// see ONLY their outlet's data. The owner remains the master account
// holder + the one paying the subscription.
//
// status values:
//   - invited     — invite sent, manager hasn't accepted yet
//   - active      — manager has signed in via Clerk; access granted
//   - revoked     — owner removed access; row kept for audit trail
//
// role values (small set; can grow later):
//   - outlet_manager — sees own outlet's orders/menu specials/tables
//   - staff          — view-only for own outlet (no menu edits)
//
// CRITICAL invariant: data is keyed on (owner_client_id, outlet_id) —
// never on team_member email. So when an owner swaps Rohit out and
// Suresh in (revoke old row, insert new row with same outlet_id), ALL
// of Saket's orders/menu/customer history stays intact. The new
// manager just walks into the same dataset under a new auth identity.
//
// Email matching is case-insensitive at the application layer; we
// store the user's typed-in form for display but always look up via
// lowercased + trimmed value.
export const team_members = pgTable(
  'team_members',
  {
    id: text('id').primaryKey(),
    owner_client_id: text('owner_client_id').notNull(),
    email: varchar('email', { length: 200 }).notNull(),
    role: varchar('role', { length: 40 }).notNull(),
    outlet_id: varchar('outlet_id', { length: 60 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('invited'),
    invited_at: timestamp('invited_at', { withTimezone: true }).notNull().defaultNow(),
    accepted_at: timestamp('accepted_at', { withTimezone: true }),
    revoked_at: timestamp('revoked_at', { withTimezone: true }),
    invited_by_email: varchar('invited_by_email', { length: 200 }).default(''),
  },
  (t) => ({
    // "Who manages this outlet right now?" — typical query.
    ownerOutletStatusIdx: index('team_members_owner_outlet_status_idx').on(t.owner_client_id, t.outlet_id, t.status),
    // "Does this email have access to anything?" — login-time lookup.
    emailStatusIdx: index('team_members_email_status_idx').on(t.email, t.status),
  })
);
