# DOCUMENT 1 — ZapText Restaurant Audit Report

## 1. Executive summary

ZapText ships a more complete restaurant-vertical surface than any horizontal WhatsApp CRM (AiSensy, Gallabox) and most direct WhatsApp-first food tools (Waayu, OrderInWhats, Chatmeal) — 17 owner-facing pages, sub-type-aware prompt assembly, Cloud API direct integration with no BSP markup. **The product is functionally feature-rich but operationally leaky**: ~7 of 17 pages are wired end-to-end, the rest have known data-flow breaks that an owner hits within week one. **The market expects a Petpooja-equivalent stock model, Zomato-grade item-86 propagation, DotPe-grade table QR flow, and Bikayi-grade onboarding speed** — ZapText today matches none of those exactly but has a real wedge on conversational AI ordering, voice, and Hinglish that none of those four offer natively.

## 2. What is wired correctly

**Menu data path.** The `/client/restaurant/menu` editor mutates `clients.knowledge_base_json → menuCategories[].items[]`, the webhook reads that same blob via `generateSystemPrompt(kb)`, and the LLM gets full item shape (price, isVeg, isBestseller, allergens[], gstSlab, weightVariants[]) on every turn. Item edits are immediately visible to the next inbound message — no cache, no propagation delay. This is the cleanest end-to-end loop in the codebase.

**Today's orders Kanban.** `/client/restaurant/orders` reads from the orders table, status transitions emit WhatsApp updates to the customer, and the bot's `[ORDER:total:items:address:notes]` tag flows through the webhook → order row → Kanban without manual intervention. The state machine is observable and reversible.

**QR + dine-in session.** `/client/restaurant/qr-codes` generates per-table QR codes, scan opens a WhatsApp deep-link, the inbound message creates an entry in `table_sessions`, and `dineInContext` injects the open session into the prompt so the bot recognises the customer's table number. Three pages collaborate on one feature with no broken seam.

**Surge and service-mode rules.** The basePrompt strict-rules block enforces rain/peakHour/festival surcharge percentages, service mode gating (dine_in / takeaway / delivery / cloud_kitchen_only), and FSSAI pure-veg / shared-kitchen disclosure. These are static blocks but they actually fire — the LLM respects them because they are at the top of the system message.

**Payment intent tag.** When `upi_id` is set, `paymentContext` teaches `[PAY:amount:note]` and the bot generates UPI deep-links correctly. Razorpay/Cashfree settlement is out of scope today (Cash on Delivery hardcoded) but the UPI intent path itself is clean.

**Multi-language gate.** Trial bots are hard-locked to English via the trial-language gate in basePrompt; paid bots respect `languages[]` from onboarding. The gate is enforced at the prompt layer, not by client-side validation — owners cannot bypass.

## 3. What is wired incorrectly or partially

**Hours and slots — broken.** Onboarding captures `workingHours` as free text ("Mon-Sun: 11 AM to 11 PM") and never parses it into `slots` rows. The owner finishes the 6-step wizard, sends a booking-intent test message, and the bot answers "no slots available" because `availabilityContext` reads from an empty slots table. **This is the single biggest week-1 churn surface.** Confirmed.

**Menu → inventory sync — partial.** `syncProductsFromConfig` exists but requires a manual button click on `/client/inventory`; owners who edit a menu item's price expect inventory to follow and it does not. The price<₹1 auto-fix that just shipped patches the parsePrice bug but does not fix the underlying "menu is source of truth, inventory drifts" architecture.

**Outlet scope — chain-wide tables.** `slots`, `inventory`, and `staff` are all keyed by client_id, not outlet_id. A chain with two branches in the same city cannot set different hours, different stock, or different staff rosters per branch. Multi-outlet onboarding asks for `outlets[]` and `outletCount` but the operational tables ignore them. Confirmed gaps #3, #4, #5.

**Orphan paths.** `/client/bookings` and `/client/calendar` are referenced in `LOCKED_FOR_TRIAL` but never appear in the nav-items array — same pattern as the recently-fixed `/client/inventory` and `/client/availability`. Owners on Starter or above cannot reach them. Confirmed.

**Reservations approval channel.** `/client/restaurant/tables` displays advance bookings read-only; approve/decline is routed to staff WhatsApp. Owners who do not have a separate staff number, or who want to approve from the laptop while plating, cannot. The dashboard has the data; it just lacks the button.

**Dine-in + advance reservations split.** `tables-live` shows open QR sessions; `tables` shows advance reservations. From the owner's mental model these are one "who's coming/here" view. The split forces tab-switching during a rush.

**Inventory bulk update missing.** "Reset all bread variants to 20" requires N clicks. No bulk endpoint, no CSV import, no "select-all → set quantity" UI. Confirmed gap #17.

**Welcome menu first-contact path.** Works as documented but the 7-day window is hardcoded; owners cannot configure re-display cadence per customer cohort. Minor.

## 4. What is missing entirely

**Customer profile / loyalty.** No aggregated customer table, no repeat-visit tracking, no LTV view. Petpooja's Loyalty Wallet (points + cashback + OTP-gated redemption + biller-side allocation) is the SMB benchmark; Reelo and Waakif layer WhatsApp on top of Petpooja for the messaging side. ZapText has the WhatsApp side natively but no underlying customer record — every conversation starts cold. Data shape needed: `customers` table keyed by phone, with `first_seen_at`, `last_order_at`, `lifetime_value`, `visit_count`, `loyalty_points`, `preferred_language`, `dietary_flags`.

**A/B testing on bot replies.** No prompt variants, no offer variants, no win-rate tracking. Gallabox and AiSensy ship flow-level A/B; LLM-native A/B is rare and is itself a wedge — but ZapText has zero today.

**POS / aggregator integration capture.** `existingSystem` is a free-text field. Petpooja's Apiary docs are public, UrbanPiper's Atlas exposes Store Actions + Item Actions + webhook events, Zomato's developer portal launched in 2024 — all are integrate-able, none are integrated. Even a one-way pull from Petpooja (menu + 86 sync) would slot ZapText into a CRM-of-the-POS position.

**Kitchen capacity / prep-time model.** The bot will accept 50 dosas in 5 minutes because there is no kpt (kitchen prep time) ceiling and no rolling-window order count. Swiggy demotes restaurants on missed KPT, Zomato's auto-toggle-off pattern is industry standard. Data shape needed: per-item `prep_time_min`, per-outlet `concurrent_order_cap`, rolling 15-min queue depth gate.

**Demand forecasting / reorder hints.** Low-stock alerts are hard-threshold (qty ≤ N). No 7-day moving average, no festival multiplier, no "you ran out of paneer on the last three Diwalis" memory.

**Allergen enforcement.** Onboarding collects `allergens[]` per item but the bot's instruction text defers to the kitchen if fields are blank. Under FSSAI Sub-Regulation 2.4.6 (mandatory since Jan 2022 for Central License holders and 10+ outlet chains), allergen declaration is a compliance requirement, not a nice-to-have. ZapText should refuse the order or insert a disclaimer when allergens[] is empty for an item the customer asked about by allergen keyword.

**Conversation priority / escalation.** Refund, complaint, "I am sick", "food poisoning", "Zomato" (customer threatening to review elsewhere) — none trigger escalation. `/client/conversations` is a flat inbox. A simple keyword classifier + a "needs owner reply" flag would move owner-attention bandwidth to the right places.

**Payment screenshot dashboard.** Customers send UPI screenshots; the bot acknowledges; the owner has to scroll the conversation thread to verify. No dedicated `/client/payments` page. Razorpay and Cashfree both expose webhook-based payment confirmation; ZapText should pivot to those over screenshot-based reconciliation, but in the interim a screenshot inbox is two days of work.

**Equivalents to benchmark against:**

| Missing surface | Indian benchmark | Data shape to mirror |
|---|---|---|
| Customer profile | Petpooja Loyalty Wallet, Reelo | phone-keyed row, points/cashback/expiry, OTP-gated redeem |
| POS connector | UrbanPiper Atlas | brand-level API key, federated item codes, webhook circuit breaker |
| Aggregator-grade stock | Zomato `menu/item/stock` | per-item in-stock flag, push-only, propagates in seconds |
| Reservation cover-charge | District/Zomato Dining | Cover Charge tiers (offer / non-offer / peak hour), 100% retention on no-show |
| WhatsApp loyalty layer | Reelo / Waakif | event-driven WA templates: "you earned X points" |

## 5. Bot prompt quality — block by block

**availabilityContext.** Triggered on booking keywords ("table", "book", "reservation", "kitne baje"). Reads `slots` + `bookings` tables, teaches `[BOOK:...]` and `[CANCEL:...]` tags. **Real problem:** when slots table is empty (gap #1), the block injects "no slots configured" which the LLM converts into "we don't take reservations" — wrong message, blocks a paying customer. **Fix:** inject hours from `workingHours` free-text as a fallback even when slots are empty, with a soft "approval needed" caveat.

**orderContext + stockBlock.** Non-trial restaurant bots only. Reads active inventory, teaches `[ORDER:...]` tag, Zomato-style availability vocabulary (SOLD OUT / ONLY N LEFT / UNAVAILABLE NOW / available with hidden count). Strong block — the Zomato-style copy directly mimics what Indian customers already read on the Zomato app. **Missing:** no kitchen-capacity gate, so the block cheerfully accepts 50 dosas. ASSUMPTION: the block currently has no awareness of order count in the last 15 min for the same outlet.

**stockBlock — allergen leak.** When an item has `allergens[]` empty, the LLM falls back to "I will check with the kitchen". This is the FSSAI exposure cited in §4. The block needs an instruction: "If the customer asks about an allergen and the item has no declared allergen data, refuse to confirm and route to staff."

**staffContext.** Reads staff table; emitted even when empty to suppress LLM hallucination from chat history. This is well-engineered — the empty-but-emitted pattern is rare and correct.

**dineInContext.** When `table_sessions` has an open row, injects table number, party size, time-since-seated. Solid block. **Missing:** no link to the order summary so the bot cannot say "your fourth round of drinks" without the LLM hallucinating from chat history.

**Welcome menu.** First-message in 7-day window, WhatsApp interactive list, skips AI. Works. **Missing:** no analytics on which list item the customer tapped; cannot answer "did the offer button get tapped" without parsing raw webhook payloads.

## 6. Onboarding form gaps

**Fields collected but never used by the bot.** `panNumber`, `gstin` are captured but never surface in the prompt — the bot will not auto-include GST in a `[PAY:...]` amount even when `gstin` exists. `aggregatorPriceOverride{swiggy,zomato}` is captured per item and used nowhere (no aggregator sync ships today). `noPreservativesClaim` and `noMsgClaim` are captured but the FSSAI 2018 Advertising Regulations restrict these claims unless scientifically substantiated — the bot will repeat them as fact, creating compliance exposure. `exportFormat` (csv|json) is captured but no export endpoint exists for restaurant data.

**Fields the bot expects but the form does not collect.** Per-item `prep_time_min` (for kitchen capacity gate). Per-outlet `concurrent_order_cap`. Customer-facing `cancellation_policy` text (the bot improvises). Per-day `special_close_dates[]` (the bot does not know about Diwali closure unless the owner manually toggles availability). Cover-charge for advance bookings (deposit_amount captured but never injected into the booking template). `language_preference_priority` — when `languages[]` has multiple, the bot picks deterministically off the first; no fallback rule for Hinglish customers.

**Free-text traps.** `workingHours` (free text → never parsed → gap #1). `existingSystem` (free text → never integrated → gap #12). `additionalInfo` (free text → injected blindly into prompt → owners have written multi-paragraph essays that bloat token count). Replace each with structured inputs in the next onboarding revision; this is one of the cleanest UX-debt cleanups available.

---

# DOCUMENT 2 — Market Research Report

## 1. The Indian restaurant tech market

**POS** is dominated by **Petpooja** (100,000+ outlets across India/UAE/MENA, ₹10K–₹40K per outlet/year, public Apiary docs, 200+ third-party integrations) and **Restroworks/Posist** (20,000+ outlets, enterprise-tilt, 400–500+ integrations, no public API spec, ISO/SOC certified — Taco Bell, Subway, Nando's logos). **Limetray** survives with ~12 employees and no funding since 2017 — effectively niche. **OneHubPOS** entered India 2024–25 with US-DNA tooling and a $1/month first-3-month promo.

**Aggregator middleware** has two real players: **UrbanPiper Atlas** (federated item codes, 14+ platforms — Zomato/Swiggy/Dunzo/Magicpin/EazyDiner/Talabat/Deliveroo/Jahez/DotPe/Foodpanda, configuration APIs + Order Relay/Status Change webhooks, 20-req/min throttle, 3-attempt exponential retry, dropped-order risk if all retries fail, brand-level `x-upr-biz-id` key) and **Petpooja Aggregator Hub** (built into Petpooja POS, no separate SKU). UrbanPiper is the better integration target if ZapText wants aggregator parity in one shot.

**KDS** is a feature inside POS suites — Petpooja KDS, Restroworks KDS (bump bar, station routing, ticket-age colour, expo view), OneHubPOS KDS. No standalone India KDS player worth naming.

**Loyalty** splits into in-POS (Petpooja Loyalty Wallet — points + cashback + OTP-gated redeem, no native tier engine; Limetray's auto-rewards engine) and consumer-side (**EazyDiner Prime** — ₹2,395–₹3,550/year, guaranteed 25–50% off at 2,000+ premium restaurants, EazyPoints 6-month redemption cap). Reelo and Waakif sit as WhatsApp overlays atop Petpooja — directly competitive with ZapText's natural roadmap.

**Payments** is a four-way war: **Razorpay** (Magic Checkout, RazorpayX Payouts T+0 to T+3, Reserve Pay UPI authorize-hold for no-show prevention), **Cashfree** (T+2 default, instant 15-min cycles for a fee, structured dispute flow with arbitration), **Paytm POS** (card + UPI tap + 95-currency acceptance, split settlement), **Pine Labs** (Plutus terminals + Paper POS), **PhonePe for Business** (POS hardware push). All five offer UPI Autopay and webhook-driven confirmation — none are integrated into ZapText today.

**Reservations** is hollow: **Dineout** folded into Zomato Dining / District (Cover Charge tiers, 100% retention on no-show by default); **EazyDiner** runs concierge-style with 10,000+ partners; **OpenTable India** has only 8 restaurants total per its own metro page as of March 2026 — not a real market.

## 2. Zomato and Swiggy data model

**Zomato launched a public developer platform in 2024** at zomato.com/developer/integration — REST + JSON + webhooks, three API families: Menu Management, Order Management, Outlet Management. Contact `posintegarations@zomato.com`.

Menu sync is **push, full snapshot, not delta**. POS pushes `add menu` API with the entire current state; anything not sent is deleted. Zomato auto-toggles the restaurant OFF from search until moderation processes the menu, then fires a Menu Moderation Callback webhook. Hierarchy: category → subCategory → catalogue → variant → modifierGroup → variant. Mandatory fields per catalogue: name, description (4–500 chars, blocked phrases enforced), price, dietary tag (veg/egg/non-veg, single), GST tag (goods/services, single).

**Item-86 has a dedicated endpoint** — `menu/item/stock` — and is the only way to flip availability post-creation. The `inStock` field on catalogue create is ignored after creation. This is the canonical pattern to mirror in ZapText.

Variants and add-ons follow strict anti-spam pricing: items under ₹30 cannot have non-mandatory modifier groups; ₹30–₹50 modifier min price ≤ root; >₹50 modifier min ≤ 4× root. Bestseller is **algorithmic**, derived from top-N ordered items in last N days — not writable from POS, though manual override exists in the dashboard.

**Swiggy has no public developer portal** — integration is invite-based, gated to certified POS vendors (UrbanPiper, Petpooja, Restroworks, Rista). Item availability windows ("Manage Item Timings") exist in the Partner App but have no public API. The "kitchen busy" mechanism is **KPT** (Kitchen Preparation Time) + the "Food Ready" 5-minute hand-off SLA. **There is no public "IPL" (Item Pickup Limit / Instamart Pickup Limit) primitive** — that phrase appears only as Swiggy's IPL cricket marketing tie-ups. The actual demote-on-laggard signal is KPT + ranking, plus manual outlet pause.

**Reservation/no-show** at District (Zomato Dining): Cover Charge tiers (Offer-Based / Non-Offer / Peak Hour / Experiences), 100% retained on no-show by default. Restaurant cannot adjust manually on the printed bill; refund is gated to platform transaction. This is the schema ZapText's reservation deposit feature should mirror.

## 3. What Indian owners actually complain about

Verbatim, May 2025 – April 2026:

**Aggregator commissions** dominate. Gagandeep Singh Sapra (Tadka Rani, GK1) on X, 24 Nov 2025: *"it's all a game of increase our commission, from the current 52+% that they take on sales… The Greed is not ending, and Goyal Babu is unable to control the loose canons in his team who are rigging the system."* Manish (@maniyakiduniya, 31 May 2025): *"I'm finally pulling my restaurant off your platform. Congrats! Your mystery service charges, surprise ad placements (without consent), and a POC who ghosts like it's a talent show — truly inspiring."* An anonymous owner via MediaNama, June 2025: *"A single click can cost around Rs. 6. Even if a customer just views the restaurant by clicking on it and doesn't buy, that money is deducted… They exhaust our daily limit by 12 PM."*

**Unauthorised deductions** — MediaNama, April 2026 summarising Reddit reports: Swiggy deducted ad charges without consent ranging ₹10,000 to ₹20 lakh per outlet; one South Indian restaurant owner asked his account manager repeatedly to stop, deductions restarted next month, restaurant shut its Swiggy outlet in protest.

**POS reliability** — Petpooja Google Play, pawan parihar, 19 April 2026: *"I reported a critical issue regarding Swiggy & Zomato integration more than 5 days ago, but there has been no response. Orders are getting missed due to system errors, causing continuous business loss."* Prayosha Food Services: *"If as resturant owner you are using Android system and not windows then don't ever purchase Petpooja… Kitchen Display, Captain App, etc. are not available in Android."* G2 reviewer on peak hours: *"mobile performance could be smoother… slightly slow, especially during peak hours."*

**Cloud kitchen squeeze** — Aditya on X, Postoast: *"35% Comission, 34% Discount 100% funded by Restaurant, 38% Ad campaigns else no Visibility. Customer Support unresponsive? 6 wk Payout not Settled."*

**Themes I could not source verbatim** within budget: staff theft, recipe costing, festival rush POS crashes, GST e-invoicing pain, FSSAI inspection horror, "Excel ke saath inventory". Reddit-domain queries were blocked at search time. Vendor blog content was excluded.

## 4. The WhatsApp-first restaurant opportunity

Who is trying it: **Waayu** (Mumbai, launched Dec 15 2025 — full WhatsApp ordering, zero-commission positioning), **uEngage WhatsApp Ordering** (visual menu with variants, abandoned-cart claims), **AeroChat** (unified inbox), **QuickReply.ai** (Hinglish flows, ~$30/month), **OrderOnWhats.app**, **OrderInWhats**, **Make My Menu**, **Chatmeal** (Bali-built but India-relevant, Bubble-built, 0% commission). **DotPe** is the senior competitor — NRAI partner since 2020, used by Haldiram's / Social / Smoke House Deli — but its WhatsApp commerce is **link-out from WhatsApp to web storefront**, not in-chat conversational. **KFC India's WhatsApp chatbot** scaled in 2024–25 as the canonical case study. **Bikayi** has serious brand-trust issues (Trustpilot 1-star floods, Scamadviser 1.6/5) and zero restaurant vertical, but its **<90-second onboarding** is the gold standard to beat.

Why most fail: they treat WhatsApp as a thin notification channel atop a web storefront, not as the ordering surface itself. Customer flow is "scan QR → open web menu → cart → pay → get WhatsApp confirmation" — a worse experience than Zomato.

**ZapText's unfair advantage** is three-fold: LLM-native conversational ordering (the customer types "ek biryani aur do naan, half plate paneer" and the bot resolves the order); voice via Groq whisper-large-v3 (Tier-2/3 owners can voice-message back to the bot, customers can voice-order); Meta Cloud API direct with no BSP markup (₹1.09 marketing / ₹0.145 utility / free service is wholesale, not the AiSensy/Gallabox markup of 8–20%).

## 5. Compliance landscape 2026 — what is actually mandatory

| Rule | Status May 2026 | Applies to ZapText? |
|---|---|---|
| FSSAI Menu Labelling (calorie + allergen + veg/non-veg) | **Mandatory since 1 Jan 2022** for Central License OR 10+ outlets | Yes for chains; design the bot to surface allergens regardless |
| FSSAI QR display (Food Safety Connect) | **Mandatory since 30 July 2025**, all FBO premises and digital assets | Yes — onboarding already collects `fssaiQrCodeUrl`; surface in storefront |
| FSSAI Advertising Claims Regulations 2018 | Mandatory; "100% natural / no MSG / no preservatives" restricted unless substantiated | Yes — strip `noMsgClaim`/`noPreservativesClaim` from bot output unless owner uploads substantiation |
| DPDPA 2023 substantive obligations | **NOT yet enforceable**; in force 13 May 2027 (consent / breach / retention) | Build for 2027 now — consent capture, retention purpose-bound, easy withdraw |
| GST e-invoicing (₹5 cr aggregate turnover, B2B only) | Mandatory since 1 Aug 2023, threshold unchanged for 2026; 30-day reporting SLA from 1 Apr 2025 (≥₹10 cr) | Mostly B2C dine-in is out of scope; flag for bulk-order/B2B catering only |
| Karnataka calorie labelling (BBMP) | **Could not verify a standalone BBMP rule** — appears to be FSSAI central rule enforced via BBMP | Not aspirational — just ship the FSSAI rule |
| Alcohol licensing | State subject; L-17/L-16 in Delhi; varies elsewhere | Capture license + state in onboarding for `servesAlcohol=true` |

## Competitor benchmarks woven through

**AiSensy:** ₹1,500–₹3,200/month plans + ₹2,500/month chatbot add-on + ₹750 per extra agent. **No restaurant industry page**; food delivery is a blog post only; voice calling launched, AI ads manager added Lead Form ads, auto-pause on Meta re-categorisation shipped Nov 2025. Trustpilot complaints: "rigid templated responses cannot genuinely be considered AI-driven", "28+ bug reports". 210,000+ businesses, FY25 revenue ₹79.6 Cr. Wedge: ZapText's LLM-native conversational ordering beats their webhook-bolted bot.

**Gallabox:** ₹5,999 / ₹12,999 / ₹24,999 plans (Heltar Sept 2025), 3–6 user caps, 100-card limit per bot flow, Pro tier gets 5% off Meta template charges. **No restaurant templates**; no Petpooja/UrbanPiper/Posist integration; appointment booking framed for clinics. $3.5M seed Jan 2025 led by FUSE. G2 reviewer: *"pricing structure could be more transparent, especially regarding API usage and add-ons."* Wedge: ZapText is restaurant-vertical with native menu/modifier/table, Gallabox is horizontal CRM.

**DotPe:** Commission-based pricing (1–3% per online order per Bill Feeds), no fixed subscription publicly. 2-way Zomato/Swiggy/Amazon Foods menu sync. NRAI partner. Table QR flow is the strongest in market — used by Haldiram's, Social, Smoke House Deli. **WhatsApp commerce is link-out to web storefront** — no native conversational AI in WhatsApp. Wedge: ZapText is in-chat, DotPe is link-out.

**Bikayi:** Free + paid tiers (digital marketing packages ₹7K–₹50K driving most consumer complaints). 0.99% txn fee. **<90-second onboarding** is the speed benchmark. Trustpilot/Scamadviser flooded with 1-star reviews; ConsumerComplaints.in has 38+ filings about non-delivery of premium-plan promises. Restaurant vertical: none. Wedge: ZapText steals the <90-second flow and applies it to restaurants.

**Petpooja API:** Apiary docs public at onlineorderingapisv210.docs.apiary.io — App Key + App Secret + Access Token + Restaurant ID (no OAuth, no self-serve). Gaps: add-ons and taxes not exposed in menu sync; ~23–40% field coverage vs aggregator schemas per third-party analysis. Loyalty Wallet has no native tier engine. Good first POS to integrate.

**Restroworks:** No public API spec, partner-program-gated, 400–500+ integrations marketed, ISO/SOC certified. Enterprise tilt — not the right first integration.

**UrbanPiper Atlas:** REST + webhooks, federated item codes, 20 req/min throttle, brand-level keys, 14+ aggregator surfaces in one integration. The right second integration after Petpooja — gets ZapText aggregator parity in one shot.

---

# DOCUMENT 3 — Implementation Prompt for Building the Top 7 Fixes

## Mission statement

Ship seven owner-visible fixes to ZapText's restaurant vertical that together cut Free-trial-to-Starter drop-off, eliminate the highest-frequency week-1 owner complaints, and close one FSSAI compliance gap. Build sequentially; ship each behind a feature flag if it touches the webhook. Zero auth refactor, zero Clerk changes, zero rename of verticals or sub-types. Total estimated effort: 5–8 engineering days for one full-stack engineer.

## Codebase context (for implementing Claude)

Stack: Next.js 16 App Router + TypeScript + Tailwind v4. Auth: Clerk (multi-domain — www, clerk subdomain, per-slug subdomains). DB: Postgres on Neon, accessed via Drizzle ORM (schema files at `db/schema/`). LLM: Groq llama-3.3-70b for text replies, Groq whisper-large-v3 for voice transcription, Gemini for image understanding. WhatsApp: Meta Cloud API direct (no BSP), webhook at `app/api/webhook/route.ts`. Storage for `clients.knowledge_base_json` blob holds ~90 fields. Per-restaurant operational tables: `slots`, `bookings`, `inventory`, `inventory_categories`, `staff`, `orders`, `table_sessions`, `outlets`, `conversations`. Restaurant sidebar lives under `app/(client)/client/restaurant/*` (ASSUMPTION: route grouping). Bot prompt assembly: `lib/bot/generateSystemPrompt.ts` for static, individual dynamic blocks under `lib/bot/contexts/*` (ASSUMPTION: directory layout).

Convention: API routes under `app/api/{resource}/{action}/route.ts`, return `Response.json({ ok: true, ... })`. UI uses server components by default; client components opt-in with `"use client"`. Drizzle migrations live at `db/migrations/`. New columns: nullable + default first, backfill, then optional NOT NULL pass.

## Pick rationale and ordering

Picked seven gaps using the four tie-breakers in priority order:

1. **Onboarding workingHours → slots auto-seed** — gap #1; first booking ever blocked
2. **Reservations approve from dashboard** — gap #7; owner cannot leave WhatsApp
3. **Inventory bulk update** — gap #17; "reset all bread to 20" in one click
4. **Allergen enforcement in bot** — gap #15; FSSAI compliance + safety
5. **Kitchen capacity gate** — gap #13; bot stops accepting 50 dosas in 5 min
6. **Menu → inventory sync on save** — gap #2; eliminate manual sync button
7. **Conversation priority/escalation** — gap #16; refund/complaint keywords

Deferred: chain-wide tables to outlet-scoped (gap #3/#4/#5 — needs migration of three production tables, blast radius too big); orphan paths (#6 — five-minute fix, ship in same PR as #1); customer profile/loyalty (#10 — Phase 2); A/B testing (#11); POS integration (#12); reorder hints (#14); payment screenshot dashboard (#9 — Razorpay webhook supersedes); dine-in + advance unification (#8 — UX merge, Phase 2).

## Work item 1 — workingHours auto-seeds slots

**Goal.** When the owner completes onboarding step "Hours", parse `workingHours` free text and insert default slots into the `slots` table so the bot can quote bookable times from message one.

**Files.**
- Create `lib/onboarding/seedSlotsFromHours.ts`
- Edit `app/api/onboarding/complete/route.ts` (ASSUMPTION: completion endpoint exists at this path)
- Edit `app/(client)/onboarding/components/HoursStep.tsx` to add a "Preview generated slots" panel

**DB schema.** No new tables. `slots` table already has `(id, client_id, outlet_id, day_of_week, start_time, end_time, slot_duration_min, max_party_size)`. Add `seeded_from_onboarding` boolean column for audit:

```typescript
// db/migrations/0042_slots_seed_audit.ts
import { sql } from "drizzle-orm";
export async function up(db) {
  await db.execute(sql`
    ALTER TABLE slots
    ADD COLUMN seeded_from_onboarding boolean NOT NULL DEFAULT false
  `);
}
export async function down(db) {
  await db.execute(sql`ALTER TABLE slots DROP COLUMN seeded_from_onboarding`);
}
```

**Parser.** Build a regex-first parser in `seedSlotsFromHours.ts` accepting common Indian formats: "Mon-Sun: 11 AM to 11 PM", "Mon-Sat 10 am - 10:30 pm; Sun closed", "Daily 12-3 PM, 7-11 PM". Fall back to LLM-extraction (Groq llama-3.3-70b, JSON-mode) only when regex fails. Emit `Slot[]` with `slot_duration_min = 30` default and `max_party_size = onboarding.tableBooking.maxPartySize ?? 8`.

**API.** No new endpoint — fold into existing completion handler. After insert, return `{ ok: true, slotsSeeded: n }`.

**UI.** Below the workingHours textarea, render a "Preview generated slots" disclosure that calls a `POST /api/onboarding/preview-slots` (new, body `{ workingHours, slotDurationMin }`, returns `Slot[]`). Owner sees a Mon-Sun grid of 30-min chunks. Manual override link routes to `/client/availability`.

**Bot wiring.** `availabilityContext` already reads slots — no change needed if rows exist. Verify the block does not short-circuit when `slots.length === 0`; if it does, change short-circuit to inject "approval-needed" hours from `workingHours` raw text instead.

**Tests.** Unit: parser handles 12 input variants. Integration: completing onboarding with "Mon-Sun: 11 AM to 11 PM" inserts 7 days × 24 chunks across the open hours.

**Acceptance.** Owner completes onboarding, opens WhatsApp test number, sends "kya aaj 8pm available hai", bot answers with a specific yes/no plus alternative slot. No manual `/client/availability` visit required.

## Work item 2 — Reservations approve from dashboard

**Goal.** Owner can approve or decline a pending advance booking from `/client/restaurant/tables` with one click; bot fires a WhatsApp template to the customer.

**Files.**
- Edit `app/(client)/client/restaurant/tables/page.tsx` — add Approve/Decline buttons per row
- Create `app/api/bookings/[id]/decision/route.ts`
- Edit `lib/whatsapp/sendTemplate.ts` (ASSUMPTION: helper exists) to support `booking_approved` and `booking_declined` templates

**DB schema.** `bookings` table needs `decision_made_by_user_id`, `decision_made_at`, `decision_reason` (decline only):

```typescript
// db/migrations/0043_bookings_decision_audit.ts
import { sql } from "drizzle-orm";
export async function up(db) {
  await db.execute(sql`
    ALTER TABLE bookings
    ADD COLUMN decision_made_by_user_id text,
    ADD COLUMN decision_made_at timestamptz,
    ADD COLUMN decision_reason text
  `);
}
export async function down(db) {
  await db.execute(sql`
    ALTER TABLE bookings
    DROP COLUMN decision_made_by_user_id,
    DROP COLUMN decision_made_at,
    DROP COLUMN decision_reason
  `);
}
```

**API.** `PATCH /api/bookings/[id]/decision`, body `{ decision: "approved" | "declined", reason?: string }`, response `{ ok: true, booking, whatsappMessageId }`. Updates `bookings.status`, writes audit columns, fires Cloud API template to customer phone.

**UI.** Two buttons per pending row, modal on Decline asking for reason (free text, 200-char limit). Show "Approved by Owner • 14:23" badge on history rows.

**Bot wiring.** When the bot generates a `[BOOK:...]` tag, set `bookings.status = "pending"` and emit a WhatsApp notification to the owner's `contactNumber`. The dashboard PATCH closes the loop.

**Templates needed at Meta.** `booking_approved` (params: name, date, time, party_size), `booking_declined` (params: name, reason). Submit for approval pre-ship.

**Tests.** Integration: pending booking → PATCH approved → status=approved, customer template fired, audit columns populated.

**Acceptance.** Owner sees pending booking in dashboard, clicks Approve, customer receives "Your booking is confirmed for 14 June 8pm, party of 4" within 5 seconds. Decline path triggers a "Sorry, we are fully booked at that time — please try 9pm" template.

## Work item 3 — Inventory bulk update

**Goal.** Owner can multi-select inventory rows and set quantity / reorder threshold / availability in one save. Fixes "reset all bread to 20".

**Files.**
- Edit `app/(client)/client/inventory/page.tsx` — add row checkboxes, bulk action bar
- Create `app/api/inventory/bulk-update/route.ts`
- ASSUMPTION: existing `inventory` mutation helper at `lib/db/inventory.ts`

**DB schema.** No changes.

**API.** `POST /api/inventory/bulk-update`, body `{ ids: string[], patch: { quantity?: number, reorderThreshold?: number, isAvailable?: boolean } }`, response `{ ok: true, updatedCount }`. Validate `ids` belong to caller's client_id. Wrap in a single Drizzle transaction.

**UI.** Multi-select checkbox in row 1 of inventory table (replaces the column header), sticky bulk action bar appears when ≥1 row selected. Bar has: quantity input, reorder threshold input, availability toggle, "Apply to N selected" button. Show optimistic UI; rollback on error.

**Bot wiring.** None — `stockBlock` already reads fresh inventory per turn.

**Tests.** Integration: select 12 items, set quantity 20, all 12 rows updated, audit log captures bulk op. Permission test: cannot update another client's rows.

**Acceptance.** Owner with 40 bread variants resets all to quantity 20 in under 10 seconds. Stock block in next inbound message reflects new counts.

## Work item 4 — Allergen enforcement in bot

**Goal.** When a customer mentions an allergen by name and the matching menu item has empty `allergens[]`, the bot refuses to confirm and routes to staff instead of bluffing.

**Files.**
- Edit `lib/bot/contexts/stockBlock.ts` (ASSUMPTION: file exists) — append allergen-uncertainty instructions
- Edit `lib/bot/generateSystemPrompt.ts` — add `allergenStrictMode` flag injection

**DB schema.** Add `allergen_strict_mode` boolean on clients for owner opt-in (default true for chains with ≥10 outlets per FSSAI rule):

```typescript
// db/migrations/0044_allergen_strict_mode.ts
import { sql } from "drizzle-orm";
export async function up(db) {
  await db.execute(sql`
    ALTER TABLE clients
    ADD COLUMN allergen_strict_mode boolean NOT NULL DEFAULT true
  `);
}
export async function down(db) {
  await db.execute(sql`ALTER TABLE clients DROP COLUMN allergen_strict_mode`);
}
```

**API.** No new endpoint. Surface toggle in `/client/bot-settings`.

**UI.** Bot Settings page: new "Allergen safety" section with toggle. Copy: "When a customer asks about allergens for items that don't have declared allergen data, refuse to confirm safety and route to staff. Required for FSSAI compliance on chains with 10+ outlets."

**Bot wiring.** Append to system prompt when `allergen_strict_mode = true`:

> "If a customer asks whether an item contains a specific allergen (nuts, gluten, dairy, eggs, soy, fish, shellfish, peanuts) and the item's declared allergen list is empty or missing, refuse to confirm safety. Reply: 'I cannot confirm allergen information for [item] — please call the kitchen on [contact_number] before ordering.' Do not invent allergen safety claims."

Inject `contact_number` from onboarding `contactNumber`.

**Tests.** Prompt regression: feed "is the paneer tikka safe for nut allergy" with empty allergens[] → reply contains refusal phrase. With `allergens=["dairy"]` populated → reply states dairy presence, asks customer to confirm.

**Acceptance.** Owner with allergen data blank gets the refuse-and-route reply. Owner with allergen data populated gets specific allergen disclosure. FSSAI Sub-Reg 2.4.6 exposure closed for in-bot confirmations.

## Work item 5 — Kitchen capacity gate

**Goal.** Bot stops accepting orders that exceed a rolling 15-minute concurrent-order ceiling per outlet. Replaces today's "yes ji, 50 dosas no problem" failure mode.

**Files.**
- Edit onboarding `OperationsStep.tsx` — add `concurrentOrderCap` (default 8) and per-item `prepTimeMin` (default 12)
- Edit `lib/bot/contexts/orderContext.ts` (ASSUMPTION: file exists)
- Create `lib/bot/kitchenCapacity.ts` — function `getCurrentLoad(outletId): { queuedItems: number, capacityRemaining: number }`

**DB schema.** Add columns:

```typescript
// db/migrations/0045_kitchen_capacity.ts
import { sql } from "drizzle-orm";
export async function up(db) {
  await db.execute(sql`
    ALTER TABLE outlets
    ADD COLUMN concurrent_order_cap integer NOT NULL DEFAULT 8;

    ALTER TABLE inventory
    ADD COLUMN prep_time_min integer NOT NULL DEFAULT 12;
  `);
}
export async function down(db) {
  await db.execute(sql`
    ALTER TABLE outlets DROP COLUMN concurrent_order_cap;
    ALTER TABLE inventory DROP COLUMN prep_time_min;
  `);
}
```

**API.** No new endpoint. Read in `orderContext` per turn.

**UI.** OperationsStep adds `concurrentOrderCap` slider 2–30. Inventory table adds a `prepTimeMin` column inline editor (also bulk-updateable via Work item 3 patch).

**Bot wiring.** `orderContext` queries `orders` where `created_at > now() - interval '15 min' AND status IN ('confirmed','preparing') AND outlet_id = ?`, sums `items.length`. If sum ≥ `concurrent_order_cap`, append instruction:

> "Kitchen is at capacity. For any new order request reply: 'Bahut zyaada orders chal rahe hain — abhi 10-15 min wait hoga. Schedule kar dein for [now+20min]?' Do NOT emit [ORDER:...] tag until customer confirms scheduled time."

ASSUMPTION: orders rows have `outlet_id` and item-count derivable from JSON column `items`.

**Tests.** Integration: seed 8 concurrent orders, send "ek biryani", bot returns wait-message, no ORDER tag. Reduce to 7 orders, send same message, bot accepts.

**Acceptance.** During a real Diwali rush, owner does not see the "50 dosas in 5 min" scenario. Customers get honest wait quotes.

## Work item 6 — Menu → inventory sync on save

**Goal.** Owner edits a menu item, save triggers `syncProductsFromConfig` automatically. The manual button disappears.

**Files.**
- Edit `app/(client)/client/restaurant/menu/page.tsx` — call sync inside the existing save handler
- Edit `lib/inventory/syncProductsFromConfig.ts` (ASSUMPTION: file exists) — guard against duplicate-call race (debounce 500ms server-side)

**DB schema.** No changes.

**API.** Existing `PUT /api/menu` (ASSUMPTION) handler: after writing `knowledge_base_json`, await `syncProductsFromConfig(clientId)`. Return `{ ok: true, syncedItems: n }`.

**UI.** Remove "Sync to inventory" button. Show toast: "Menu saved. N inventory rows synced." Keep a "Sync now" link in inventory page settings for recovery scenarios.

**Bot wiring.** None — already reads inventory per turn.

**Tests.** Integration: edit menu item price ₹250 → ₹275, save, query inventory, row reflects new price. Add new menu item, save, inventory has new row. Delete menu item, inventory row marked `is_archived = true` not hard-deleted (preserves order history).

**Migration for existing data.** Run `syncProductsFromConfig` for all clients in a one-time script. Audit price<₹1 rows (the parsePrice bug) and apply the auto-fix that already shipped:

```typescript
// scripts/backfill-menu-inventory-sync.ts
const clients = await db.select().from(clientsTable);
for (const c of clients) {
  try {
    await syncProductsFromConfig(c.id);
  } catch (e) {
    console.error(`Failed for client ${c.id}:`, e);
  }
}
```

**Acceptance.** Owner edits a price, refreshes inventory page, sees new price. No second click required. Bot's next reply quotes new price.

## Work item 7 — Conversation priority and escalation

**Goal.** Refund / complaint / health / aggregator-threat keywords flag the conversation as "needs owner reply" and surface it at the top of `/client/conversations`.

**Files.**
- Edit `app/api/webhook/route.ts` — add classifier call before LLM reply
- Edit `app/(client)/client/conversations/page.tsx` — add priority sort + red-dot badge
- Create `lib/bot/classifyPriority.ts`

**DB schema.** Add columns to `conversations`:

```typescript
// db/migrations/0046_conversation_priority.ts
import { sql } from "drizzle-orm";
export async function up(db) {
  await db.execute(sql`
    ALTER TABLE conversations
    ADD COLUMN priority_level text NOT NULL DEFAULT 'normal',
    ADD COLUMN priority_keywords text[],
    ADD COLUMN priority_flagged_at timestamptz,
    ADD COLUMN priority_acknowledged_at timestamptz
  `);
  await db.execute(sql`
    CREATE INDEX conversations_priority_idx
    ON conversations(client_id, priority_level, priority_flagged_at DESC)
  `);
}
export async function down(db) {
  await db.execute(sql`
    DROP INDEX conversations_priority_idx;
    ALTER TABLE conversations
    DROP COLUMN priority_level,
    DROP COLUMN priority_keywords,
    DROP COLUMN priority_flagged_at,
    DROP COLUMN priority_acknowledged_at
  `);
}
```

`priority_level` values: `normal`, `attention`, `urgent`.

**Classifier.** Keyword-first (cheap, deterministic), LLM-fallback only when ambiguous. Keywords by tier:

- `urgent`: "food poisoning", "ill", "vomit", "hospital", "lawyer", "FSSAI", "consumer court", "complaint to police"
- `attention`: "refund", "wrong order", "missing", "cold", "late", "Zomato review", "Swiggy complaint", "bad experience", "manager", "speak to owner"

Hinglish variants: "paisa wapas", "galat order", "thanda khaana", "shikayat", "khaakar bimaar". Match case-insensitive, word-boundary.

**API.** Webhook flow: parse inbound text → run `classifyPriority(text)` → if `urgent`, set `priority_level='urgent'`, do NOT auto-reply for sensitive subset (food poisoning); inject `escalationContext` block telling LLM to acknowledge, apologise, promise owner callback in 1 hour. Owner gets WhatsApp ping on their `contactNumber`.

**UI.** Conversations list defaults to sort by `priority_level DESC, last_message_at DESC`. Red dot on rows with `priority_level !== 'normal' AND priority_acknowledged_at IS NULL`. Click → conversation thread → "Mark acknowledged" button writes `priority_acknowledged_at`.

**Bot wiring.** New `escalationContext` block, injected only when `priority_level !== 'normal'`. Content:

> "This customer has flagged a potentially serious complaint. Do not minimise. Acknowledge specifically what they said. Apologise. Promise the owner will personally call within 1 hour. Do NOT emit [ORDER:...] or [PAY:...] tags. Do NOT offer discounts without owner approval."

**Tests.** Send "I got food poisoning from the biryani last night" → conversation marked urgent, owner notified, bot replies with empathy template not auto-order. Send "kab milega order yaar" → normal priority, business as usual.

**Acceptance.** Owner opens `/client/conversations` after lunch rush, sees three red-dotted urgent conversations at top. Each one has bot's holding reply already sent. Owner replies from dashboard, marks acknowledged.

## Onboarding form additions — exact spec

Add four fields to the existing wizard:

| Step | Field | Type | Validation | Storage | Bot usage |
|---|---|---|---|---|---|
| Hours | `slotPreview` (computed display, not stored) | derived | n/a | n/a | preview only |
| Hours | `slotDurationMin` | int | 15–120 | `clients.knowledge_base_json.slotDurationMin` | seeds slots table |
| Operations | `concurrentOrderCap` | int | 2–30, default 8 | `outlets.concurrent_order_cap` (or chain default in kb if multi-outlet not enabled) | orderContext capacity gate |
| Operations | `defaultPrepTimeMin` | int | 3–60, default 12 | `clients.knowledge_base_json.defaultPrepTimeMin`, applied to all inventory rows on first sync | orderContext per-item prep |
| Compliance | `allergenStrictMode` | bool | default true | `clients.allergen_strict_mode` | allergen refuse-and-route |

Move `workingHours` from free-text textarea to a structured weekday-grid component but keep the free-text fallback for sub-types `dhaba`, `food-truck`, `chai-tapri` where 24-hour days and irregular hours are common.

## Migration plan for existing data

Run in this order, each as a separate idempotent script:

1. **`backfill-slots-from-hours.ts`** — for every client where `slots.count = 0` and `workingHours` is non-empty, run the new parser and insert slots with `seeded_from_onboarding = true`. Skip clients who have manually edited `/client/availability`.
2. **`backfill-allergen-strict-mode.ts`** — set `allergen_strict_mode = true` for all clients with `outletCount >= 10` (FSSAI threshold), otherwise default false but show banner in Bot Settings.
3. **`backfill-prep-time.ts`** — for every inventory row where `prep_time_min IS NULL`, set to 12.
4. **`backfill-menu-inventory-sync.ts`** — see Work item 6.
5. **`backfill-conversation-priority.ts`** — leave existing rows at `normal`; do not retroactively classify history (would surface stale "urgent" rows the owner has already handled).

All scripts log per-client success/failure to a Postgres table `migration_runs(id, script_name, client_id, success, error, ran_at)`. Re-run is safe.

## UX simplification pass

| Page | Action | Reason |
|---|---|---|
| `/client/restaurant/tables` and `/client/restaurant/tables-live` | **Merge** into `/client/restaurant/guests` with tabs "Right now" and "Upcoming" | One mental model: "who's coming and who's here" |
| `/client/bookings` and `/client/calendar` | **Hide** until Phase 2 or wire into nav under guests | Orphan paths today |
| `/client/restaurant/specials` and `/client/welcome-menu` | **Keep separate but cross-link** | Specials feed welcome menu; current UI hides this dependency |
| `/client/restaurant/qr-codes` | **Rename** to "Table QR" | Owners say "table QR" not "QR codes"; matches DotPe naming |
| `/client/restaurant/overview` | **Keep** as restaurant home but move "create bot" out — that belongs only under Account | Duplicates Account section today |
| `/client/restaurant/team` | **Rename** to "Staff" | Matches the underlying table and onboarding language |
| `/client/bot-settings` | **Split** into Bot Settings (prompts, tags, escalation) and Welcome menu (existing page) — already split but cross-link in sidebar group | Two surfaces both edit bot behaviour |

Sidebar groups: Operations (Dashboard, Today's orders, Guests, Conversations), Catalog (Menu, Inventory, Specials), Setup (Storefront, Table QR, Availability, Outlets, Staff, Bot Settings, Welcome menu), Account (Subscription, All bots, Create bot).

## Pricing-tier impact

| Feature | Tier | Reason |
|---|---|---|
| Slots auto-seed | Free | Removes single biggest churn blocker; everyone gets it |
| Reservations approve from dashboard | Starter (₹599) | Operationally needed once bookings start; Free trial is 50 lifetime messages so unlikely to hit |
| Inventory bulk update | Growth (₹1,499) | Power-user feature, owners with ≥40 SKUs are paying anyway |
| Allergen enforcement | Free | Compliance — never gate FSSAI behind a paywall |
| Kitchen capacity gate | Starter | Operationally meaningful only when orders >5/hour, by which point owner is paying |
| Menu → inventory auto-sync | Free | Fixes a bug, not a feature; ship to all |
| Conversation priority/escalation | Growth | The "I run a real restaurant" tier; complaint volume justifies the surface |

This ordering pushes Free trial owners toward Starter (₹599) at first booking volume, then Starter toward Growth (₹1,499) at first complaint or inventory-pain volume. Aligns with the Free → Starter → Growth conversion funnel rather than scaring trial owners off with compliance friction.

## Out of scope

Do not refactor the webhook signature or response shape. Do not change Clerk auth flows, satellite domain config, or session token validation. Do not rename verticals or sub-types — restaurant sub-types (fine-dine, dhaba, chai-tapri, etc.) stay exactly as enumerated. Do not migrate `slots`, `inventory`, or `staff` to outlet-scoped — that is a Phase 2 effort with its own rollback plan. Do not introduce a new LLM provider; Groq llama-3.3-70b stays primary. Do not integrate Petpooja, UrbanPiper, Zomato Partner API, or Razorpay webhook in this pass — all are Phase 2. Do not add a customer-profile or loyalty schema. Do not change the trial-language English gate. Do not touch the storefront subdomain routing or `<slug>.zaptext.shop` DNS.

## Backlog — Phase 2 stubs

**Outlet-scoping migration** (gaps #3, #4, #5). Migrate `slots`, `inventory`, `staff` to add `outlet_id NOT NULL` after a backfill that maps existing rows to the chain's primary outlet. Add outlet-switcher in sidebar. Update every read path. Estimated 4–5 days, behind a `multi_outlet_v2` feature flag.

**Customer profile and loyalty** (gap #10). New `customers` table keyed by phone, with `first_seen_at`, `last_order_at`, `lifetime_value`, `visit_count`, `loyalty_points`, `preferred_language`. Webhook upserts on every inbound. Owner sees a `/client/customers` page with cohorts. Loyalty points earned per order, OTP-gated redemption, expiry rules (mirror Petpooja Loyalty Wallet shape). Wedge: WhatsApp-native template fires "you earned 50 points, 100 more for free dessert".

**Petpooja POS connector** (gap #12 — first integration). One-way pull: every 6 hours, fetch Petpooja menu + stock via the four-credential API (App Key + App Secret + Access Token + Restaurant ID), diff against ZapText menu, surface conflicts in `/client/integrations/petpooja`. Bidirectional sync is Phase 3.

**UrbanPiper Atlas connector** (gap #12 — second integration). Get aggregator parity in one shot — Zomato, Swiggy, Dunzo, Magicpin order ingestion. Respect 20 req/min throttle, 3-retry exponential, webhook circuit breaker. Federated item codes required.

**Zomato Partner API direct** (gap #12 — third integration). For chains that want Zomato sync without UrbanPiper markup. Implement `menu/item/stock` for item-86 propagation; full-snapshot `add menu` push; handle Menu Moderation Callback.

**Razorpay UPI Autopay / Reserve Pay** (gap #9). Replace screenshot reconciliation with webhook-confirmed payments. Reserve Pay's authorize-hold pattern is the right shape for advance booking deposits.

**A/B testing on bot replies** (gap #11). Two-arm split at the prompt level, win metric = order conversion or booking confirmation rate. Stripe-style admin UI for prompt variants. Hardest part is statistical-power calc on low-volume bots.

**Demand forecasting / reorder hints** (gap #14). 7-day moving average per inventory row, festival multiplier from a `special_dates` table, predicted-stock-out date in inventory UI. Run as a nightly cron.

**Dine-in + advance reservations unification** (gap #8). Merge the two pages into `/client/restaurant/guests` (also called out in UX simplification — Phase 2 is the implementation, not just the rename).

**Payment screenshot dashboard** (gap #9 stop-gap). If Razorpay direct lands first, skip this. Otherwise build a `/client/payments` page that aggregates inbound media messages tagged as payment screenshots.

**Outlet-scoped onboarding flow** (sequel to outlet migration). Per-outlet hours, per-outlet menu overrides, per-outlet staff. Today the wizard is single-outlet implicitly.

**Welcome menu analytics** (low priority). Track which list item the customer tapped — needed to A/B the welcome offer.

**Compliance hooks for DPDPA 2027** (forward-looking). Build consent-capture, retention-purpose tagging, easy-withdraw link now so the May 2027 enforcement date is a non-event.