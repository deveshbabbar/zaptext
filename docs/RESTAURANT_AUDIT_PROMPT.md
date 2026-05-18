# Master Research & Remediation Prompt — ZapText.shop Restaurant Vertical

> **How to use this file**
>
> Open a fresh Claude (or Claude Code) session, paste **everything below the horizontal rule**, and let Claude work. The prompt is self-contained: it already includes the codebase audit so the new Claude session doesn't need to re-read files unless it wants to verify a specific claim.
>
> Web-research portions assume the model has internet access (Claude.ai, ChatGPT, Gemini, etc.). If you're running locally without web access, ask the model to flag every claim that needs verification and you can spot-check.

---

# Brief

You are doing a **deep audit + market research + remediation plan** for ZapText.shop, an AI WhatsApp bot platform for Indian restaurants. The platform already ships, but the restaurant vertical has gaps (wiring, onboarding, feature parity with industry standards). Your job is:

1. **Confirm the current state** — I'm giving you a full inventory below; verify it makes sense and flag anything that smells wrong.
2. **Research live** — what do Indian restaurants actually use? How do Zomato / Swiggy / Petpooja / POSist / UrbanPiper handle stock, menus, slots, table reservations, etc.?
3. **Produce a structured report** — what we have vs what we're missing vs what the market expects.
4. **Produce a remediation prompt** — a separate, self-contained prompt that an implementing-Claude can use to rebuild the wiring and ship the missing pieces, end-to-end, without ambiguity.

Output should be **directly actionable**. No hand-waving like "consider adding X" — give file paths, table names, field names, and the exact UX flow.

---

## 1. About ZapText.shop (the company)

- **Product:** AI-powered WhatsApp bot for Indian SMB businesses. The bot replies to customers 24×7 in Hindi / Hinglish / English / regional languages, takes orders, books tables, answers menu questions, processes payments.
- **Stack:** Next.js 16 App Router + TypeScript + Tailwind v4 + Clerk auth + Postgres (Neon) + Drizzle ORM. LLM: Groq llama-3.3-70b (text) + Groq whisper-large-v3 (voice transcription) + Gemini (image only).
- **Verticals supported:** restaurant, gym, salon, coaching, real estate, tiffin, ecommerce, grocery, d2c. **This audit is restaurant-only.**
- **Pricing tiers:** Free trial (50 lifetime messages, English-only), Starter ₹599, Growth ₹1,499, Scale ₹3,999, Enterprise.
- **Compliance:** WhatsApp Business Messaging Policy (24-hr CSW), DPDPA 2023, FSSAI menu-labelling, GST.
- **WhatsApp integration:** Meta Cloud API, no BSP middleman. Bot has its own phone number per client.
- **Domain layout:**
  - `www.zaptext.shop` → landing + sign-up
  - `<slug>.zaptext.shop` → per-restaurant public storefront (web ordering)
  - `clerk.zaptext.shop` → Clerk auth satellite

---

## 2. Current restaurant workspace — what each page does

The signed-in restaurant owner sees this sidebar:

```
WORKSPACE
  Dashboard
  Restaurant overview
  Analytics
  Menu
  Inventory  (recently re-labelled from "Stock")
  Live tables
  QR codes
  Today's orders
  Reservations
  Availability  (recently surfaced)
  Specials
  Outlets
  Storefront
  Team Members
  Conversations
  Bot Settings
  Welcome menu
ACCOUNT
  Subscription
  All bots
  Create bot
```

### Per-page inventory

| # | Path | Purpose | Reads from DB | Writes to DB |
|---|---|---|---|---|
| 1 | `app/client/dashboard/page.tsx` | Bot selector / first-screen redirect | `clients` | none |
| 2 | `app/client/restaurant/page.tsx` | Chain KPI dashboard — today's revenue, bookings, top items, peak hours, per-outlet ranking | `dine_in_orders`, `bookings`, `outlets`, `clients` | none |
| 3 | `app/client/restaurant/analytics/page.tsx` | Today's order breakdown (mode mix, top tables, top items) | `dine_in_orders` | none |
| 4 | `app/client/restaurant/menu/page.tsx` + `menu-editor.tsx` | Edit `menuCategories[].items[]` inside `knowledge_base_json`. Bulk import via CSV/Excel/PDF. Per-outlet menu overrides via `menuByOutlet`. | `clients.knowledge_base_json` | `clients.knowledge_base_json` (POST `/api/client/settings`) |
| 5 | `app/client/inventory/page.tsx` | Add/edit individual inventory items (name, price, stock, threshold, time windows, days). Per-vertical inventory categories. Bulk CSV import. **Auto-fix logic added recently** to recover prices when the parsePrice bug poisoned old rows. | `inventory`, `inventoryCategories` | `inventory` (via `/api/client/inventory`), category CRUD |
| 6 | `app/client/restaurant/orders/page.tsx` | Kanban board of today's orders. Status workflow: placed → preparing → ready → served/delivered. Sends WhatsApp status updates on transition. | `dine_in_orders` | `dine_in_orders.status` |
| 7 | `app/client/restaurant/tables-live/page.tsx` | Open dine-in sessions per table (QR-scan initiated). Shows elapsed time, items per table, close-session button. | `table_sessions`, `dine_in_orders` | `table_sessions.status` |
| 8 | `app/client/restaurant/qr-codes/page.tsx` | Generate/print/rotate per-table QR codes. Auto-creates tables from `numberOfTables` in KB on first visit. | `restaurant_tables`, `outlets` | `restaurant_tables` |
| 9 | `app/client/restaurant/tables/page.tsx` | Advance reservation list (today + future). Shows status pill per booking. **Read-only — confirmations happen over WhatsApp.** | `bookings` | none |
| 10 | `app/client/availability/page.tsx` | Weekly schedule (per-day open/close, multi-block, slot duration 15–120 min). Drives bookable-slot generation. | `slots` | `slots` (via `/api/client/schedule`) |
| 11 | `app/client/restaurant/specials/page.tsx` | Edit `dailySpecial` + `specialOffers` strings in KB. Shown to customers asking "kuch offer hai?". | `clients.KB` | `clients.KB` |
| 12 | `app/client/restaurant/outlets/page.tsx` | Multi-branch CRUD. Slug, name, address, isActive. Assign team members. Owner-only. | `outlets`, `team_members` | `outlets` |
| 13 | `app/client/restaurant/storefront/page.tsx` | Toggle storefront, edit slug (`<slug>.zaptext.shop`), brand color, logo, palette. | `clients.storefront_*`, `clients.slug` | same |
| 14 | `app/client/restaurant/team/page.tsx` | Invite outlet managers via email. Owner-only. Outlet managers see a stripped sidebar (only their working surfaces). | `team_members` | `team_members` |
| 15 | `app/client/conversations/page.tsx` | Unified WhatsApp inbox. Search, take-over (pause AI), send manual message, export CSV/JSON. | `conversations`, `paused_customers` | `conversations`, `paused_customers` |
| 16 | `app/client/settings/page.tsx` | Master config: system prompt (raw), KB JSON (raw), business details, UPI, inventory categories, daily-export format, live prompt preview. | `clients` (everything) | `clients` (bulk POST) |
| 17 | `app/client/welcome-menu/page.tsx` | Configure first-contact WhatsApp interactive list — header, body, footer, items[]. Auto-mode pulls from staff + inventory; custom mode is hand-picked. | `welcome_menus`, `staff` (for auto-mode preview) | `welcome_menus` |

---

## 3. How the bot's system prompt is assembled (the wiring)

When a customer's message hits `app/api/webhook/route.ts` (POST), the webhook builds the AI prompt by **concatenating named blocks**. Order matters — later blocks override earlier ones if there's conflict.

### Static blocks (always present)

| Block | Source | Content |
|---|---|---|
| `basePrompt` | `lib/prompt-generator.ts → generateSystemPrompt(kb)` | Business header (name/owner/location/hours/contact), language rules, personality, custom welcome line, additionalInfo, **restaurant-specific block** (sub-types, full menu, service modes, service windows, delivery rules, surge, table booking, bulk orders, FSSAI compliance, pure-veg disclosure, strict rules) |
| Plan language gate | `lib/plans.ts` | If trial: append "English-only" rule |

### Dynamic blocks (injected per-message based on triggers)

| Block | Trigger | Plan gate | DB read | What it teaches the AI |
|---|---|---|---|---|
| `availabilityContext` | Message contains booking keywords (`book`, `table`, `reserve`, `kal`, `aaj`, `slot`, `time`, etc.) | `bookings` feature | `slots`, `bookings` (customer's existing) | 3-day slot list + `[BOOK:date:time:name:service:notes]` + `[CANCEL:booking_id]` tags |
| `paymentContext` | `clients.upi_id` is set | `payments` feature | `clients.upi_id` | `[PAY:amount:note]` tag + UPI auto-link + screenshot flow |
| `orderContext` + `stockBlock` | Always (for non-trial restaurant bots) | `inventory` feature | `inventory` (active items only) | `[ORDER:total:items:address:notes]` tag + Zomato-style availability (SOLD OUT / ONLY N LEFT / UNAVAILABLE NOW / available with hidden count) |
| `staffContext` | Always | none | `staff` (active, not deleted) | `[BOOK:date:time:name:Role - <Name>:notes]` for staff-specific bookings. Emitted even when empty as negative signal so the LLM doesn't pattern-match old staff names from chat history. |
| `dineInContext` | Customer has an open `table_sessions` row | `dine_in` feature | `table_sessions`, `dine_in_orders` | Current table number — routes food items as table additions, not delivery |
| Welcome menu | First message in 7-day window AND `[welcome-menu]` not sent in last 7 days | none | `welcome_menus`, `staff`, `inventory` (for auto-mode) | Sent as WhatsApp interactive list, **skips AI** for that turn |

### Bot-emittable tags (webhook parses these out of AI replies)

| Tag | Validation | DB writes | Side effects |
|---|---|---|---|
| `[BOOK:date:time:name:service:notes]` | Date/time format, slot exists, staff match | `bookings` (status=`confirmed` or `pending_approval`) | WhatsApp + email to owner; staff approval request if staff booking |
| `[CANCEL:booking_id]` | booking exists, belongs to customer | `bookings.status='cancelled'` | Owner notice + slot freed |
| `[ORDER:total:items:address:notes]` | Items resolve in `inventory`, stock ≥ qty | `inventory.stock -= qty` (atomic), `dine_in_orders` row, `bookings` row as order-as-booking | Owner WhatsApp + email; low-stock alert if threshold hit |
| `[PAY:amount:note]` | amount > 0 | `pending_payments` row | UPI deep-link sent to customer; owner sees "awaiting payment" |
| `[MENU_LINK]` | client.type=`restaurant` | none | Replaced with `https://<slug>.zaptext.shop/m/...` |

---

## 4. Onboarding form — what we collect today

The wizard runs at `/onboarding` and posts to `/api/onboard`. Field surface:

### Identity (CommonFields)
`businessName` · `ownerName` · `whatsappNumber` (bot's number) · `contactNumber` (owner's personal) · `languages[]`

### Location
`city` · `address` · `latitude` · `longitude` · `multiOutletEnabled` · `outletCount` · `outlets[]` ({id, slug, name, address, lat, lng, deliveryRadiusKm, isActive})

### Hours
`workingHours` (free-text, e.g. "Mon-Sun: 11 AM to 11 PM"). Plus separate optional windows: `serviceBreakfastWindow`, `serviceLunchWindow`, `serviceSnacksWindow`, `serviceDinnerWindow`, `serviceLateNightWindow`.

### Menu
`menuCategories[]` (array of `{category, items[]}`). Each item carries: name, price, description, isVeg, isBestseller, imageUrl, foodType, allergens[], caloriesKcal, isJainCompatible, availableDays[], availableTimeWindow, gstSlab, aggregatorPriceOverride {swiggy?, zomato?}, weightVariants[], shelfLifeDays, spiceLevel.

### Operations
`cuisineType` · `deliveryAvailable` · `deliveryRadius` · `deliveryCharges` · `minimumOrder` · `specialOffers` · `deliveryPartners[]` (only `own_rider` enabled today — Zomato/Swiggy/Dunzo etc. are UI-gated) · `packagingChargesPerOrder` · `packagingChargesPerItem`

### Service modes
`serviceModes[]` (`dine_in`, `takeaway`, `delivery`, `cloud_kitchen_only`)

### Table booking
`tableBookingEnabled` · `tableMinPartySize` · `tableMaxPartySize` · `tableAdvanceBookingDays` · `tableDepositRequired` · `numberOfTables` · `qrAutoRotateEnabled` · `qrAutoRotateIntervalHours`

### Surge
`rainSurchargePercent` · `peakHourSurchargePercent` · `festivalSurchargePercent`

### Bulk / corporate
`bulkOrdersEnabled` · `bulkOrdersMinPax` · `bulkOrdersContactNumber` · `bulkOrdersInvoiceWithGst`

### Sub-types (multi-select)
`subTypes[]` — fine-dine, dine-in-family, QSR, cloud-kitchen-single, dhaba, food-truck, sweet-shop, bakery, eggless-bakery, custom-cake-studio, ice-cream-parlour, juice-bar, chai-tapri, cafe, pure-veg, jain-only, regional-specialty, tiffin-attached.

Sub-type extras: custom-cake lead time, eggless flag, photo-on-cake, advance-deposit %; ice-cream tubs/scoops/flavor-of-day; juice fruit-of-day, cold-pressed; mithai festival gift boxes, interstate shipping.

### Compliance
`fssaiLicenseNumber` (14-digit) · `fssaiExpiryDate` · `fssaiQrCodeUrl` · `gstin` · `panNumber` · `jainCertified` · `servesAlcohol` · `alcoholLicenseNumber`

### Brand & disclosure
`pureVeg` · `sharedKitchenWithNonVeg` · `noPreservativesClaim` · `noMsgClaim` · `cuisineType` · (color/logo set later in /storefront, not onboarding)

### Payment
`paymentMethods[]` (currently hardcoded to `['Cash on Delivery']`). UPI/Razorpay fields exist but UI-disabled.

### Misc
`welcomeMessage` · `additionalInfo` · `existingSystem` (POS name, free text) · `exportFormat` (`csv`|`json`) · `optInAccepted` (WhatsApp Policy compliance)

### Storage
Everything except `business_name`, `owner_name`, `whatsapp_number`, `contact_number`, `city`, `upi_id`, `upi_name`, `existing_system`, `export_format`, `slug` is serialized into the `clients.knowledge_base_json` blob (one JSON string ≈ 90 fields).

---

## 5. Confirmed wiring gaps (already-identified)

These have been verified by code inspection. Treat them as starting points, not the full list.

1. **Onboarding `workingHours` ↛ `slots` table.** The free-text working hours never seed the structured weekly schedule that drives bookings. Owners must manually visit `/client/availability` and click Save to make the bot offer any slot at all.
2. **Menu edits don't auto-sync to inventory.** `/api/client/settings` does call `syncProductsFromConfig` after KB updates today, but the inventory page also has a manual "Sync products from form" button — implying owners regularly need to manually refresh. There's no auto-trigger on inventory-page focus, and stale rows can sit unfixed for weeks (we just shipped an auto-detect heuristic for prices < ₹1 to recover from a parsePrice bug).
3. **`slots` table is chain-wide, not outlet-scoped.** Multi-outlet chains can't set per-branch hours. Mumbai branch at 10 pm and Bangalore at 11 pm = not modellable.
4. **`inventory` table is chain-wide, not outlet-scoped.** Branches can't have outlet-specific menus / stock.
5. **`staff` table is chain-wide.** All trainers/staff visible to all outlets. A Mumbai customer could book a Bangalore trainer.
6. **`/client/bookings` and `/client/calendar` are orphan paths.** Listed in `LOCKED_FOR_TRIAL` in the sidebar config but never added to any nav-items array. We just fixed the same pattern for `/client/inventory` and `/client/availability`.
7. **Reservations page is read-only.** Owner can't approve / decline pending bookings from the dashboard; approval flow runs entirely via staff WhatsApp.
8. **Dine-in orders + advance reservations are split across two pages.** Owner needs `/orders` AND `/tables` to see full table occupancy.
9. **Payment screenshots have no dashboard.** Screenshot verification happens server-side; owner only sees "awaiting payment" status, no manual override or screenshot viewer.
10. **No customer profile / loyalty.** Every WhatsApp message logs to `conversations`, but no aggregated customer table — no purchase history surface, no churn detection, no segmentation.
11. **No A/B testing on bot replies.** All customers see identical prompt.
12. **No POS / aggregator integration capture.** `existingSystem` is a free-text label only, used for export filename naming. No API credentials for Petpooja, POSist, UrbanPiper, Zomato/Swiggy partner APIs.
13. **No kitchen capacity / prep-time model.** Bot can accept 50 dosas in a 5-minute window; kitchen has no signal to push back.
14. **No demand forecasting / reorder hints.** Low-stock alerts are hard-threshold only; no trend-based "you'll run out of rice by Friday".
15. **No allergen warnings enforced.** Form captures per-item allergens, but if owner leaves them blank, the bot just defers to kitchen — no required-fields hint.
16. **No conversation priority / escalation.** Angry / refund / complaint keywords aren't flagged; owner must manually scan all chats.
17. **No inventory bulk-update endpoint.** "Reset all bread stock to 20" requires 1 click per item.

---

## 6. Your research mission — what to find on the live web

Use web search, official docs, blog posts, app store listings, Reddit (`r/india`, `r/startups`, `r/RestaurantOwners`), Quora India, and Hacker News. Verify with multiple sources before stating.

### A. The Indian restaurant tech stack — who uses what

For each major Indian restaurant tech category, list the top 3-5 players, their typical pricing, what they actually do, and their integration model (REST API? webhooks? CSV? closed system?):

1. **POS / billing** — Petpooja, POSist (Restroworks), UrbanPiper, Limetray, Posist, Toast (intl. but India-relevant), TallyPrime food edition. Who serves what tier (₹10 lakh single-outlet vs ₹100 cr chain)? What does each integrate with?
2. **Aggregator middleware** — UrbanPiper, Posist Aggregator Hub, Petpooja PetPooja Aggregator, Mealsy. How do Zomato/Swiggy menu pushes work technically (sync API or CSV)?
3. **Inventory / stock** — Petpooja Inventory, POSist Stock, UrbanPiper Stock, separate tools like inResto Inventory. Is real-time decrement standard? Recipe-level depletion?
4. **Table reservation** — Dineout (Times Group), Zomato Easydiner (deprecated?), Eazydiner, OpenTable (India?), Resy (international). Wait-list vs reservation.
5. **Kitchen Display Systems (KDS)** — Posist KDS, Petpooja KDS, OneHubPOS, custom Android tablet solutions. Multi-station routing?
6. **Loyalty / CRM** — Loyalty Plant, EazyDiner Prime, OneHubPOS CRM, Petpooja Loyalty. Stamp cards vs points vs cashback.
7. **Digital menus / QR ordering** — Petpooja's digital menu, Pixel Punch, FavoQR, Posist QR. Tap-and-pay flows.
8. **Payment** — Razorpay, Cashfree, Paytm POS, Pine Labs, PhonePe Business. India-specific UPI deep-links + AutoPay for tiffin subscriptions.

### B. How Zomato and Swiggy actually handle these things at scale

Read the public docs / engineering blogs / business decks:

- **Zomato menu sync.** How does Zomato pull menu data — push from POS via partner API? CSV via Zomato Restaurant Partner App? Manual upload? What's the data shape they accept?
- **Zomato stock-out signal.** Item-level "86" (out of stock) — instant push or batched? How long does it take to reflect in customer app? Same for Swiggy.
- **Zomato bestseller logic.** Is it engagement-based, conversion-based, or revenue-based? How is "20-min prep" computed?
- **Swiggy IPL (Instamart Pickup Limit).** How does Swiggy decide your kitchen is busy and pause new orders?
- **Item-level availability windows.** How do they model "breakfast 7-11 AM" — by category, by item, by time-of-day rule?
- **Variants and add-ons.** How do they model "Half / Full / Quarter chicken" pricing? "Add extra cheese ₹30"?
- **Surge pricing / promotions.** Promo codes, BOGO, happy hour — what's modellable in their menu schema?
- **Reservation flow.** Dineout / EazyDiner — slot logic, deposit, prepayment, no-show penalty.

### C. What Indian SMB restaurant owners actually want

Search Reddit, Quora, X, YouTube for restaurant-owner pain points. Real quotes preferred. What's missing in the current SaaS market? What do owners hack together with Excel + WhatsApp + Google Forms?

- "Excel ke saath kaise inventory manage karte ho" type queries.
- POS migration horror stories.
- Aggregator commission disputes.
- Staff theft / wastage tracking.
- Recipe costing / menu engineering for profitability.
- Festival rush handling.
- Cloud kitchen vs dine-in pain points.
- Tax / GST headaches with E-invoicing (e-invoice mandatory > ₹5 cr turnover).
- FSSAI inspection scares.
- Dark patterns from aggregators (forced promos, last-mile partner conflicts).

### D. Stock management deep-dive

How do Indian restaurants actually do stock today? You will likely find:

1. **No tracking** — most small dhabas / tea stalls. Owner orders by gut.
2. **Excel daily count** — mid-tier. Single owner takes a count at close.
3. **Recipe-level depletion** — chain QSRs. POS subtracts ingredients on every order.
4. **Aggregator-mirrored** — POS subtracts from Zomato/Swiggy + own counter in real time.
5. **Multi-vendor procurement** — chain operations. Vendor portals like FoodLink, BulkMRO.

What's the typical "first 30 days" experience an Indian owner has with stock software — what falls off, what sticks?

### E. Critical research questions to answer specifically

1. **For each gap in section 5 above**, find at least one Indian SaaS competitor that solves it and describe how they model it (data shape + UX).
2. **Slot generation:** the standard 15/30/60-min slot model — does Zomato/Dineout actually use this, or is it "first available within window"?
3. **Capacity model:** how do chains model "8 tables × 4 seats = max 32 covers at a time" + "max 20 orders/hour kitchen throughput"? Per-outlet? Per-kitchen-station?
4. **WhatsApp + restaurant:** are there any existing WhatsApp-first restaurant tools in India (besides AiSensy / Gallabox who are generic WhatsApp BSPs)? AnyTime AI, RestaurantBot.io, etc.?
5. **Open-source menu schemas:** Schema.org Restaurant + MenuItem, GS1 GDSN for food, Zomato Webhook spec, Swiggy Partner API spec, Open Food Facts. Which of these maps cleanly to our `menuCategories[].items[]`?

---

## 7. Deliverables — what you produce

Structure your output as **three sequential documents**. Each must be standalone and self-contained.

### Document 1 — Audit Report (~2000 words)

Sections:
1. **Executive summary** (3 bullets — what we have, what we lack, what the market expects).
2. **What's wired correctly** — by category (menu / orders / bookings / stock / payments / multi-outlet / compliance). For each, name the page + DB table + bot block and confirm the end-to-end path works.
3. **What's wired incorrectly or partially** — same categories, but listing every break. Cite file paths and line numbers where possible (you can grep the codebase if needed).
4. **What's missing entirely** — categories with zero coverage today. For each, name the equivalent Indian SaaS that does it and the data shape they use.
5. **Bot prompt quality** — for each dynamic block (`availabilityContext` / `orderContext` / `stockBlock` / `staffContext` / `dineInContext`), say whether it's actually injected with the data customers care about, and what's missing in the instruction text.
6. **Onboarding form gaps** — which fields are present but never used by the bot, and which fields the bot expects but the form doesn't collect.

### Document 2 — Market Research Report (~1500 words)

Sections:
1. **The Indian restaurant tech market** — POS landscape, aggregator middleware, KDS, loyalty, payments. One paragraph per category, names + tiers + integration shape.
2. **Zomato/Swiggy data model** — how they model menu / stock / variants / availability. Mention API endpoints and data shapes where public.
3. **What real Indian owners complain about** — verbatim Reddit/Quora quotes, grouped by theme.
4. **The "WhatsApp-first restaurant" opportunity** — who's already trying this, why most fail, what ZapText's unfair advantage is or could be.
5. **Compliance landscape 2026** — FSSAI advertising rules, DPDPA, GST e-invoicing, Karnataka calorie labelling, alcohol licensing, FSSAI QR display — what's truly mandatory in 2026 vs aspirational.

### Document 3 — Implementation Prompt (~2500 words)

This is the deliverable the user will paste into a fresh Claude session to actually **build** the fixes. Structure:

1. **Mission statement** — one paragraph defining the scope and quality bar.
2. **Codebase context** — file paths, tech stack, conventions. Repeat just enough of section 1-3 above so the implementing-Claude doesn't need this document.
3. **Sequenced work items**, in order of dependency. For each item:
   - One-line goal.
   - Files to create / edit (with paths).
   - DB schema changes (with full Drizzle migration code).
   - API endpoint changes (path + method + request/response shape).
   - UI changes (component path + what the user sees).
   - Bot wiring changes (which webhook block + what data flows in).
   - Tests to write.
   - Acceptance criteria — exact user-visible verification steps.
4. **Onboarding form additions** — exactly which fields to add, where in the wizard, what validation, where they're stored, how the bot uses them.
5. **Migration plan for existing data** — for every schema change, the backfill script that fixes existing rows.
6. **UX simplification pass** — list every page that should be merged, split, renamed, or hidden behind a feature flag, with reasoning.
7. **Pricing-tier impact** — for each new feature, which plan tier it belongs in (Free / Starter / Growth / Scale / Enterprise) and why.
8. **Out of scope** — explicitly list things the implementing-Claude should NOT touch (e.g. don't refactor the webhook, don't change Clerk auth, don't rename verticals).

The implementation prompt must be **so detailed that an implementing-Claude needs zero clarifying questions**. If you find yourself writing "consider X" or "evaluate Y", you've failed — make the call, justify it in one sentence, and move on.

---

## 8. Style rules for your output

- **No fluff.** No "in today's competitive landscape". No "it's important to note that".
- **Specific over general.** "₹599 / 2k messages / 1 bot" not "affordable starter tier".
- **Indian English / Hinglish welcome.** "Half plate biryani" not "half-serving rice dish".
- **Cite or omit.** If you can't cite a claim, leave it out.
- **Tables for structured data.** Bullet points for flat lists. Prose for argument.
- **No emojis** in section headings. Sparingly in body (the existing codebase uses some — match its tone).
- **Length budget:** stay within the word counts above. Trim before adding.

---

## 9. Starting checklist for you

Before writing a single line of output:

- [ ] Open the codebase if you have access. Read at minimum: `app/api/webhook/route.ts` (focus on lines 200–1300), `lib/prompt-generator.ts` (full), `app/client/restaurant/` (every page), `app/client/inventory/page.tsx`, `app/client/availability/page.tsx`, `lib/types.ts` (RestaurantFields), `lib/db/schema.ts`.
- [ ] Run at least 6 web searches covering: Petpooja API, POSist features, Zomato Partner API menu schema, Swiggy IPL stock management, Indian restaurant POS Reddit thread, FSSAI 2024 menu labelling rules.
- [ ] Spot-check 3 random claims in section 5 above against the actual code (you don't have to verify all 17, but find any that are wrong).
- [ ] Only then start writing Document 1.

Now go.
