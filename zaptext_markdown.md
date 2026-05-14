# ZapText India: WhatsApp restaurant SaaS compliance and product roadmap

## Section 1 — Executive summary

ZapText can win the Indian restaurant SMB segment **without becoming a Business Solution Provider (BSP)** and without rebuilding its product, but it needs three immediate compliance fixes and a focused 12-month roadmap. The headline finding: Meta's July 1 2025 shift to per-message pricing, combined with **Utility templates becoming free inside the 24-hour customer service window** (April 1 2025), makes ZapText's direct Cloud API path structurally cheaper than every major competitor — Wati (~20% markup), Interakt (~25%), Gallabox (~20%), DoubleTick (~10-15%), with only AiSensy and MSG91 close to zero markup. India marketing templates cost **₹0.8631 per delivered message** as of January 1 2026 (a ~10% rise from ₹0.7846), while utility templates are effectively free for any conversation a customer started in the last 24 hours.

**Three urgent compliance fixes** are required before any new feature work:

First, ZapText currently treats an inbound message as opt-in for sending a 10-row interactive list. Meta's Business Messaging Policy ("[business.whatsapp.com/policy](https://business.whatsapp.com/policy)") and the November 2024 opt-in update permit this *only* for replies inside the 24-hour customer service window — it is **not** sufficient opt-in for proactive marketing templates. ZapText must store explicit opt-in evidence (phone, timestamp, source, business-name disclosure, category permissions) for any future broadcast feature, and the welcome-list flow itself remains compliant because it lives inside the customer-care window.

Second, automated status pings ("preparing", "out for delivery", "ready") are compliant **only** while the customer service window is open. Outside that window — for example, a delivery dispatched 90 minutes after the customer's last message — these messages require pre-approved **Utility templates**. Most are still free under the April 2025 in-window rule, but ZapText must build a window-tracker and template fallback path now, before scale exposes the gap.

Third, India's **Digital Personal Data Protection Act 2023** and the **DPDP Rules 2025** (Gazette G.S.R. 846(E), notified 13 November 2025) require notice, consent records, breach notification within 72 hours, and data-principal rights (access, correction, erasure within 90 days). Substantive obligations are enforceable from **13 May 2027**, giving ZapText a finite runway. The Resend-via-US email pipeline is permitted under DPDPA Section 16's negative-list framework (the US is not blacklisted as of May 2026), but the customer-PII email payload must be minimised and consent-logged.

**The product roadmap**: The top three new features by impact-divided-by-effort are (1) **WhatsApp Catalog + Single/Multi Product Messages**, replacing the `/m/<clientId>` web menu page for restaurants that want native in-chat ordering, (2) **WhatsApp Pay via Razorpay or PayU** for the small fraction of restaurants whose order values justify a payment-gateway contract — implementable on direct Cloud API without changing BSP, and (3) **WhatsApp Flows** for table reservations and feedback, reported to deliver 40–55% no-show reduction in restaurant case studies. These three alone close the largest competitive gaps with Gallabox and Interakt while preserving ZapText's pricing wedge.

**Pricing-tier strategy**: ZapText should bundle aggressive value at ₹599 Starter to defend the price point (catalog ordering, basic Flows, FSSAI display, Hinglish voice), use ₹1,499 Growth as the multi-staff/analytics/broadcast upgrade lever, and reserve ₹3,999 Scale for multi-outlet, advanced Flows, catalog-at-scale, and white-label. The direct Cloud API path remains the structural moat — every BSP-mediated feature ZapText adds erodes its no-markup advantage.

## Section 2 — Compliance audit table

| # | Feature | Status | Policy clause + URL | Required change |
|---|---|---|---|---|
| A1 | 20 restaurant sub-type onboarding | COMPLIANT | DPDPA §7(a) (legitimate use for specified purpose) [meity.gov.in](https://www.meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8fef35e82c42aa5.pdf) | None — business-data only |
| A2 | Compliance fields (FSSAI/GSTIN/halal/alcohol licence) | COMPLIANT but UNDERUSED | FSSAI Labelling & Display Regs 2020, Rule 2.4.6 [fssai.gov.in](https://fssai.gov.in/upload/notifications/2020/08/5f4611c4eca96Gazette_Notification_Information_Display_Food_26_08_2020.pdf); CGST Rule 46(b) | Surface FSSAI number on `/m` menu page and every order confirmation; pull GSTIN onto invoice templates |
| A3 | Pure-veg / Jain / Halal / no-MSG / no-preservatives claims | RISKY | FSSAI Adv & Claims Regs 2018 Reg 3: "Claims must be truthful, unambiguous, meaningful, not misleading"; CPA §2(28); FSS Act §53 (₹10 lakh) [fssai.gov.in](https://fssai.gov.in/upload/uploadfiles/files/Gazette_Notification_Advertising_Claims_27_11_2018.pdf) | Require restaurants to upload certificate proof before claim displays; add disclaimer "Prepared in a shared kitchen handling non-vegetarian items" when `shared_kitchen_with_non_veg = true`; block "100% pure" wording |
| A4 | Surge pricing (rain/peak/festival %) | RISKY | CCPA Dark Patterns Guidelines 2023 — Drip Pricing prohibition [pib.gov.in](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2134765); CP(E-Commerce) Rule 5(3)(b) "total price in single figure...along with the breakup" | Disclose every surcharge **at item-add time** with itemised breakup before checkout; never reveal surge after total shown |
| A5 | Bulk/corporate orders + GST invoice toggle | COMPLIANT | CGST Rule 46; e-invoice ≥₹5 cr aggregate turnover (CBIC 10/2023) [gstcouncil.gov.in](https://gstcouncil.gov.in/node/4365) | Auto-detect restaurant turnover band; trigger e-invoice flow when ≥₹5 cr |
| A6 | Cloud-kitchen multi-brand brand array | COMPLIANT | None | Display correct FSSAI per brand when displaying that brand's menu |
| B1 | Menu editor (manual + paste + OCR) | COMPLIANT | None | None |
| B2 | Gemini multimodal OCR | COMPLIANT | None at platform level | Confirm Gemini's data-residency commitments; document in privacy notice under DPDPA §5 |
| B3 | Size variants auto-parse | COMPLIANT | None | None |
| B4 | Inventory auto-sync | COMPLIANT | None | None |
| C1 | Welcome interactive list on 1st inbound in 7-day window | COMPLIANT inside CSW | Meta Business Messaging Policy ("You may only contact people on WhatsApp if...you have received opt-in permission") [business.whatsapp.com/policy](https://business.whatsapp.com/policy) | Inbound message **opens** the 24-h CSW but is **not** marketing opt-in. Document this distinction. The list itself stays compliant because it replies inside CSW |
| C2 | Menu link (`/m/<clientId>`) | COMPLIANT | DPDPA §5 notice requirement | Add privacy notice + consent checkbox on first menu visit; log timestamp |
| C3 | Order submit → WhatsApp confirmation | COMPLIANT inside CSW | Meta pricing doc: "Utility templates delivered within an open customer service window are free" [developers.facebook.com pricing](https://developers.facebook.com/docs/whatsapp/pricing) | None inside CSW; outside CSW must use pre-approved Utility template |
| C4 | Free-text chat orders ([ORDER:] tag) | COMPLIANT | Business Solution Terms allow task-oriented automation [whatsapp.com/legal/business-solution-terms](https://www.whatsapp.com/legal/business-solution-terms/preview) | None — but bot must remain restaurant-task-scoped (Jan 2026 enforcement bans general-purpose AI) |
| C5 | QR-scan dine-in flow | COMPLIANT | Meta opt-in mechanisms include QR-triggered customer-initiated messages | Pre-filled message must include consent statement; user taps Send (user-initiated) |
| C6 | Reorder shortcut pulling last order | RISKY | DPDPA §6(1) purpose limitation: "limited to such personal data as is necessary for such specified purpose" | Consent notice must state "order history retained for reorder convenience"; offer 1-tap erasure |
| C7 | Live stock awareness in prompt | COMPLIANT | None | None |
| C8 | Language detection (Hindi/Hinglish/English) | COMPLIANT | DPDPA §5(3) requires notice option "in English or any language specified in the Eighth Schedule" | Provide Hindi/regional consent notice option |
| D1 | UPI [PAY:amount] deep-link | COMPLIANT | RBI PA Master Direction 2025 — only fund-handlers need licence; deep-link merchants are not aggregators [fidcindia.org.in](https://www.fidcindia.org.in/wp-content/uploads/2025/09/RBI-PAYMENT-AGGREGATORS-DIRECTIONS-15-09-25.pdf); NPCI UPI Linking Spec v1.6 | None — must never escrow funds. Add `mc` merchant-category param on deep-link |
| D2 | Payment screenshot auto-verify | RISKY | DPDPA §8(5) "reasonable security safeguards"; screenshots may include partial card numbers, addresses | Strip screenshot to amount+VPA only; do not store raw image >7 days; auto-delete after verification |
| D3 | Not yet fired for /m menu-link orders | GAP | n/a | Wire UPI deep-link to /m flow as separate work item |
| E1-E5 | KPIs, charts, retention, peak-hours | COMPLIANT | None — business analytics on owner-side | None |
| E6 | Orders board status auto-pings | COMPLIANT inside CSW | Same Meta CSW rule as C3 | Build Utility templates for "preparing/dispatched/ready" for use after CSW closes; categorise as Utility (free in CSW after Apr 2025) |
| F1 | Owner email on every new order (Resend, US) | RISKY | DPDPA §16 cross-border transfer + §8(2) Data Processor contract requirement | Sign DPA with Resend covering DPDPA; minimise PII in email body (last-4 of phone, no full address); document in privacy notice |
| F2 | Stale-session cron | COMPLIANT | DPDPA §8(7)(a) purpose erasure: "erase personal data...as soon as it is reasonable to assume that the specified purpose is no longer being served" | Document 60-min session-close as purpose-limit signal |
| F3 | Low-stock daily email digest | COMPLIANT | Internal — no customer PII | Audit email body to confirm no customer phone/name leaks |
| F4 | Live-takeover pause | COMPLIANT | None | None |
| G1 | Welcome menu = inbound-as-opt-in | RISKY for any future broadcast | Meta opt-in policy: opt-in is separate from CSW [business.whatsapp.com/policy](https://business.whatsapp.com/policy) | Add explicit "Type YES to receive offers" prompt before classifying as marketing-opt-in; store evidence record |
| G2 | All current outbounds inside CSW | COMPLIANT | Meta pricing doc free CSW utility rule | None |
| G3 | No marketing templates yet | COMPLIANT | n/a | Plan opt-in collection before launching broadcast feature |
| G4 | No card data collection | COMPLIANT | PCI-DSS, RBI tokenisation rules, SPDI Rules 2011 Rule 3 | None |
| G5 | Aggregator price comparison ("Swiggy ₹389, here ₹329") | RISKY | Meta template-rejection patterns for "misleading content" naming competitor brands; no specific verbatim Meta rule located | In **Marketing templates**: avoid naming Swiggy/Zomato — use "vs delivery apps" or "save ₹X by ordering direct"; inside CSW free-form, naming is acceptable |
| G6 | Alcohol promotion | COMPLIANT (bot currently refuses) | Meta Commerce Policy Aug 27 2024 update: "WhatsApp business messages promoting alcohol remain prohibited in India" [haptik.ai](https://www.haptik.ai/blog/whatsapp-business-messaging-regulated-sectors); Cable TV Rule 7(2)(viii); state excise laws | Keep alcohol items suppressed from chatbot display unless restaurant has state-specific online liquor licence (MH, WB) — even then, do **not** include in marketing templates |
| G7 | DPDPA on customer phone+address+orders | RISKY (until rules consolidated) | DPDPA §6 consent: "free, specific, informed, unconditional and unambiguous" [meity.gov.in PDF](https://www.meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8fef35e82c42aa5.pdf); §8(6) breach notification | Build consent log table; publish privacy notice; appoint Grievance Officer (also required under CP E-Commerce Rules 4(5)); breach-response runbook (CERT-In 6h + DPB 72h) |
| G8 | FSSAI menu display | INCOMPLETE | FSSAI Reg 2.4.6 mandates calorie display for FBOs with central licence OR ≥10 outlets; allergen + veg/non-veg symbol mandatory for all | Required on `/m` page: FSSAI number, validity, allergen disclosure (8 allergens), veg/non-veg dot; calorie/serving for ≥10-outlet chains |
| G9 | Surge disclosure timing | RISKY | CCPA Dark Patterns 2023 — Drip Pricing | Move surge disclosure to pre-add-to-cart; itemise on summary screen |

## Section 3 — New feature roadmap (top 25)

Ranked by impact ÷ effort. Effort scale: S (<1 wk), M (1-2 wk), L (2-4 wk), XL (>1 mo). Pricing tags: 🛡️ Defends ₹599 / 🚀 Growth lever / 💎 Scale lever / 🆓 Free always.

| # | Feature | Description | Impact | Effort | Policy implication | India reg implication | Tier | BSP req? |
|---|---|---|---|---|---|---|---|---|
| 1 | **Gemini OCR menu onboarding** | Owner photographs paper menu; AI extracts items, prices, modifiers into editable catalog in 2 mins | XL — removes the #1 SMB onboarding friction | M | None | None — pure UX | 🛡️ Defends ₹599 | No |
| 2 | **WhatsApp Catalog + SPM/MPM** | Replace `/m` web menu with native catalog message; max 30 items per MPM | XL — direct order conversion lift | M | Meta Commerce Policy applies; India mandates `origin_country`, `importer_name`, `importer_address` fields; **no alcohol items** | FSSAI veg/non-veg symbol + allergen on each item | 🛡️ Defends ₹599 | No |
| 3 | **WhatsApp Flows for reservation** | Multi-screen booking flow with live availability check (dynamic endpoint); T-24h Utility reminder + T-2h reply-button confirm | XL — 40-55% no-show reduction | M | Reminder templates must be Utility (free in CSW); free outside CSW once approved | None | 🛡️ Defends ₹599 | No |
| 4 | **Hinglish voice-order via Groq Whisper** | Customer sends voice note "do paneer butter masala, ek butter naan" → structured order | L — opens Tier-2/3 market; vs competitors who don't transcribe | M | Task-scoped AI agent permitted under March 2026 Solution Terms update | None | 🛡️ Defends ₹599 | No |
| 5 | **NPS / CSAT Flow 2h post-bill** | 1-5 star Flow; 5 → Google review link, ≤3 → manager handoff with order context | L — 0.3-0.5 star Google lift in 90 days | S | First message Utility (transactional follow-up); free in CSW | None | 🛡️ Defends ₹599 | No |
| 6 | **Birthday/anniversary auto-greeting** | DOB stored at onboarding (Flow); Marketing template fires on day | L — highest CTR template in F&B | S | Marketing category; counts toward 2-msg/user/day frequency cap; requires explicit opt-in | DPDPA §6 explicit consent for marketing | 🚀 Growth | No |
| 7 | **CTWA "free dessert" coupon entry flow** | Meta Ads Manager campaign → WA chat → coupon code template | L — acquisition engine; 72-h FEP free window | S | CTWA opens 72h free entry-point window — all msgs free in window | None | 🚀 Growth | No |
| 8 | **Coupon-code template (Copy Code button)** | Static or dynamic per-user codes via merge field | M-L — promo conversion | S | Marketing category | None | 🚀 Growth | No |
| 9 | **Smart frequency-aware scheduler** | Distributes Marketing sends to avoid error 131049 user-saturation; prioritises recently-engaged | L — hidden moat | M | Compliance with Meta's ~2 marketing msgs/user/24h frequency cap | None | 🚀 Growth | No |
| 10 | **UPI Lite tip jar** | Sub-₹500 tip/add-on flow with no-PIN UPI Lite | M | S | Plain text/URL; deep-link allowed | RBI UPI Lite limits | 🛡️ Defends ₹599 | No |
| 11 | **WhatsApp Pay native (Razorpay PG)** | order_details message with Pay button; UPI/card/netbanking inside chat | L — 4-6x conversion uplift vs deep-link (Razorpay) | L | Direct Cloud API supported via Meta Business Manager → Payment Configurations → India | RBI PG/PA — Razorpay is licensed; no new burden on restaurant beyond standard MDR | 💎 Scale | Optional-but-faster |
| 12 | **Carousel "Today's specials"** | 2-10 cards swipeable, each with Order CTA | M | S | Marketing template (outbound) or free in CSW | None | 🚀 Growth | No |
| 13 | **Cart-abandonment recovery** | 1 Utility nudge in 24h CSW (free) + 1 Marketing 24h later | M-L | M | Keep once-only; aggressive recovery flagged by Meta misuse reviews | DPDPA consent for marketing portion | 🚀 Growth | No |
| 14 | **Lapsed-customer winback** | 60-day inactivity trigger → 15% off Marketing template | M-L | S | Marketing category; opt-in required | DPDPA §6 | 🚀 Growth | No |
| 15 | **Multi-outlet routing on one WABA** | Single number → branch picker → branch's KOT + catalog | L for chains | L | None | None | 💎 Scale | No |
| 16 | **Captain-app via WhatsApp Web inbox** | Replace ₹3K captain tablets with WA-Web roles | M-L | M | Meta multi-user inbox allowed | None | 🚀 Growth | No |
| 17 | **Cloud-kitchen multi-brand context routing** | Single WABA routes "I want pizza" → Brand B's catalog + KOT | L for cloud-kitchen segment | L | None | None | 💎 Scale | No |
| 18 | **Group-order Flow for offices** | Host shares link, colleagues add, host pays once | L — high-AOV B2B | L | Dynamic Flow endpoint | GST e-invoice if restaurant ≥₹5 cr | 💎 Scale | No |
| 19 | **Allergen-aware ordering Flow** | One-time intake; bot warns at checkout | M | M | None | FSSAI Reg 2.4.6 allergen disclosure | 🛡️ Defends ₹599 | No |
| 20 | **Festival pre-order Flow** (Diwali/Eid/Karva Chauth) | Advance booking with deposit via WA Pay | L — cashflow lift | M | Marketing template for promo; Utility for confirmation | None | 🚀 Growth | No |
| 21 | **Channel for daily specials** | Free organic broadcast; bypasses frequency cap | M-L — free reach | S | Channels exempt from per-user marketing cap; subject to general Meta moderation | None | 🆓 Free always (add channel link in Starter) | No |
| 22 | **WhatsApp Business Calling API for catering desk** | Click-to-call from Marketing template; chat-to-call escalation | L for fine-dine & catering | L | Phased rollout July 2025; **min 1K messaging tier**; max 5 calls/24h after consent; no PSTN bridging | None | 💎 Scale | Yes — BSP-mediated today |
| 23 | **ONDC twin-listing (via SNP partner)** | List on ONDC alongside ZapText direct; ~3-5% commission vs aggregator 25-30% | XL strategic; M near-term revenue | L | None — ONDC is separate channel | ONDC Seller Network Partner agreement | 💎 Scale | No |
| 24 | **UPI AutoPay weekly tiffin subscription** | Recurring mandates for office/student tiffin | L — recurring revenue moat | L | Plain text mandates; UPI deep-link | RBI AutoPay mandate caps ₹15K/txn no-OTP | 💎 Scale | No |
| 25 | **Weather/event-triggered broadcast** | Rain + 6pm + delivery zone → "khichdi combo 20% off" Marketing template | M-L | M | Marketing template; frequency cap aware | DPDPA opt-in | 🚀 Growth | No |

**Excluded by policy / strategy**: open-domain GPT chatbot (banned Jan 2026), alcohol promotion in India (Meta Commerce Policy), "Cheaper than Swiggy/Zomato" templates with competitor names (template rejection risk).

## Section 4 — Policy deep-dives

### C1 — Template categories and per-message India pricing

Meta's pricing doc states verbatim: "*To align with industry-standards, effective July 1, 2025, Meta now charges on a per-message basis: You are only charged when a template message is delivered. Rates vary based on the template's category and the recipient WhatsApp phone number's country calling code*" ([developers.facebook.com pricing](https://developers.facebook.com/docs/whatsapp/pricing)). The four categories are **Marketing, Utility, Authentication, Service**, with definitions from Meta's Template Categorization doc:

- **Marketing**: "*Enable businesses to achieve a wide range of goals, from generating awareness to driving sales and retargeting customers*" — e.g. festival promo, abandoned cart, winback.
- **Utility**: "*Enable businesses to follow up on user actions or requests, since these messages are typically triggered by user actions*" — order confirmation, ETA, booking confirmation, feedback request.
- **Authentication**: "*Enable businesses to verify a user's identity*" — OTPs only; "URLs, media, and emojis are not allowed for authentication template content".
- **Service**: free-form replies inside the 24-h customer service window — free worldwide since November 1 2024.

**India per-delivered-message rates effective January 1 2026** (post 10% marketing hike, cross-verified across Whautomate, Authkey, AiSensy pass-through, MSG91):

| Category | India rate (INR ex-GST) | Free conditions | Volume discount? |
|---|---|---|---|
| Marketing | **₹0.8631** | Free only in 72-h FEP window after CTWA | No (flat) |
| Utility | **₹0.115** | Free inside 24-h CSW; free in 72-h FEP | Yes, up to -30% |
| Authentication (domestic) | **₹0.115** | Free in 72-h FEP only (not free in CSW) | Yes, up to -30% |
| Authentication-International | ~₹2.90+ | Same as auth | Yes |
| Service | **Free** | Inside CSW only | n/a |

All rates incur 18% GST. **Key change**: prior to April 1 2025, Utility templates inside the customer-care window were **paid**; from April 1 2025 they are **free**, formalised in the July 1 2025 conversation-based-pricing → per-message-pricing transition.

**ZapText outbound message classification**:

| ZapText message | Category | Cost (India 2026) |
|---|---|---|
| Welcome list message (1st inbound) | Service (free-form in CSW) | Free |
| Order confirmation (in CSW) | Service free-form OR Utility | Free in CSW |
| Order status: preparing/OFD/ready (in CSW) | Service free-form OR Utility | Free in CSW |
| Order status outside CSW | Utility template (pre-approved) | Free in CSW; ₹0.115 outside |
| Low-stock owner alert | Not WhatsApp — internal email | n/a |
| Reorder prompt (user-initiated) | Service free-form | Free |
| Specials broadcast (not yet built) | Marketing template | ₹0.8631 per delivered |
| Payment received confirmation | Utility | Free in CSW; ₹0.115 outside |
| Table booking confirmation | Utility | Free in CSW; ₹0.115 outside |
| Bill / invoice on dine-in close | Utility | Free in CSW; ₹0.115 outside |

**Mixed-content rule** (Template Categorization doc): "*Templates with mixed content (e.g. order upgrade + promotion) are categorized as marketing*". A "Your order is ready + try our new biryani!" template will be reclassified as Marketing — write Utility templates as transactional-only.

### C2 — The 24-hour customer service window

The CSW is opened (or reset) by **any inbound message from the customer** — text, media, button-tap, list-reply, reply-button selection. Meta's pricing doc gives the canonical example: "*This opens a 24 hour customer service window (CSW)*…*The CSW is still open, and utility templates sent within an open CSW are free*…*once 26 hours pass (window closes), template messages are required again*".

Inside CSW: any free-form message type allowed (text, image, video, interactive list, reply buttons, location request, product messages); Utility templates free; **Marketing templates still charged** (CSW does not give Marketing a free pass); Authentication templates still charged.

Outside CSW: **only pre-approved templates** may be sent; the API blocks free-form messages.

**Free Entry Point window**: when a customer reaches the business via Click-to-WhatsApp ad or Facebook Page CTA button, "*for the following 3 days (72 hours), all of your messages are not charged*" ([whatsappbusiness.com pricing](https://whatsappbusiness.com/products/platform-pricing/)) — including marketing templates. FEP is Android/iOS only. ZapText's CTWA flow inherits FEP for 72 hours.

### C3 — Opt-in requirements

Meta's verbatim policy ([business.whatsapp.com/policy](https://business.whatsapp.com/policy)): "*You may only contact people on WhatsApp if: (a) they have given you their mobile phone number; and (b) you have received opt-in permission from the recipient confirming that they wish to receive subsequent messages or calls from you*".

The **November 2024 relaxation** allowed general (not WhatsApp-channel-specific) opt-in, provided the consent flow satisfies three conditions: (1) the business name is clearly stated, (2) the user is told they will receive messages, (3) a valid mobile number is collected.

**Valid opt-in channels** (each independently accepted by Meta + DPDPA):
- Inbound message from customer — opens CSW for **replies only**, **not** marketing opt-in
- CTWA ad click + first message — opens 72-h FEP; recommended to also collect explicit marketing opt-in for post-FEP
- QR code scan with pre-filled message + user taps Send — equivalent to inbound; pair with consent text
- Website/landing-page form with checkbox
- POS / in-store sign-up
- IVR digit-press

**Evidence ZapText must retain per Meta + DPDPA + onsync.co synthesis**: phone number, customer identifier, collection source (URL, POS, IVR, QR, CTWA campaign ID), timestamp, business-name disclosure text shown, categories opted in to (utility/marketing/call), privacy notice version, opt-out timestamp if any. DPDPA §6(10): "*the Data Fiduciary shall be obliged to prove that a notice was given by her to the Data Principal and consent was given*".

### C4 — Catalog and Single/Multi Product Messages

WhatsApp Catalog is created in Meta Commerce Manager under the same Business Manager that owns the WABA. **Direct Cloud API supports Catalog fully — no BSP gate**.

Specs and limits:
- Max **500 items per catalog** for WhatsApp use
- Up to **10 images per item** (or 1 video); square 1080×1080 recommended; <1MB strongly recommended for mobile delivery
- **MPM caps at 30 items** across multiple sections per message
- Each product reviewed against Meta Commerce Policy; approval typically minutes to hours
- **Mandatory India fields**: `origin_country`, `importer_name`, `importer_address` (Indian Consumer Protection (E-Commerce) Rules 2020 alignment)
- **Customer service info** required: at least one contact number + email + grievance officer

**India restaurant constraints**:
- ✅ Allowed: food (veg, non-veg, desserts), non-alcoholic beverages, gift cards/vouchers
- ❌ Prohibited: alcohol of any kind ("*WhatsApp business messages promoting alcohol remain prohibited in India*"), tobacco/vapes, real-money gambling, prescription drugs
- ⚠️ **Services restriction**: "*Commerce content may not promote the buying, selling, or trading of services, except on the WhatsApp Business app or through Appointments in Facebook or Instagram*" ([facebook.com/policies_center/commerce](https://www.facebook.com/policies_center/commerce)) — restaurant **bookings** should be delivered via Flows, not Catalog.

**Catalog vs ZapText's custom `/m` web menu — recommendation**:
- Catalog wins for: in-chat conversion (no app/browser switch); native cart UX; future WhatsApp Pay rendering (order_details requires catalog SKUs); SPM/MPM frictionless add-to-cart
- Custom web menu wins for: deep customisation (table-session UI, surge breakdown, FSSAI compliance display, calorie disclosure for ≥10-outlet chains); multi-step ordering with cross-sells; image-rich category browsing beyond 30-item MPM limit; languages beyond what catalog templates support

**Strategy**: ship Catalog as Starter feature (defends ₹599) for restaurants who want pure in-chat ordering; keep custom `/m` for Growth/Scale tier customers who need surge, allergen, multi-cart, language richness.

### C5 — WhatsApp Pay India status (May 2026)

**Consumer P2P WhatsApp Pay** is live for all 500M+ Indian WhatsApp users — NPCI fully lifted the 100M user cap on December 31 2024 (TechCrunch, Business Standard). WhatsApp processed ~130M UPI transactions in March 2026 vs PhonePe's 10.5B and GPay's 7.5B — still small but growing fast (TechCrunch April 23 2026).

**Merchant payments inside chat** are delivered via payment-gateway integrations, **not** a native Meta merchant rail. Live partners in India:
- **Razorpay** — fully live; docs at razorpay.com/docs/payments/whatsapp
- **PayU** — fully live; docs at docs.payu.in/docs/integrate-whatsapp-payments
- **BillDesk**, **Zaakpay** — supported per Meta Cloud API payment configuration docs
- **Cashfree** — not yet listed in Meta payment configuration dropdown as of May 2026 (used as separate UPI payment-link)
- **PhonePe**, **BharatPe** — not listed as Meta-approved PGs for WhatsApp Pay native flow

**Direct Cloud API vs BSP for WhatsApp Pay**: PayU's official docs state: "*Self-owned WhatsApp Business Account: Directly link your WhatsApp Business Account with PayU using the Meta Business Manager. This is applicable if you have direct access to your Meta Business Manager*" — meaning ZapText (which owns the WABA per restaurant directly) can enable WhatsApp Pay **without changing BSP**. The path: restaurant signs up with Razorpay/PayU → ZapText's admin creates payment configuration in Meta Business Manager → connects PG → status moves Needs connecting → Needs testing → Active.

Merchant onboarding flow (5-10 days):
1. Restaurant signs with Razorpay or PayU; submits GSTIN, PAN, FSSAI, business proof (1-2 days)
2. Meta Business Manager verification (1-3 days)
3. ZapText creates payment configuration in Meta Business Manager → India → links Razorpay/PayU
4. Catalog products configured in Commerce Manager (line items must come from this catalog)
5. Send `order_details` message via Cloud API

Fees: Meta charges **nothing** for the order_details message itself (it's a regular utility/marketing template depending on context). Razorpay/PayU charge standard PG MDR: **0% UPI** (NPCI mandate), ~2% credit card, ~2% wallets. No new RBI-specific fee.

**Comparison vs ZapText's current `upi://pay` deep-link**:
- Deep-link: zero setup, no BSP, no PG, no MDR, works today, works with any restaurant's VPA
- Native WhatsApp Pay: ~4-6× conversion uplift cited by Razorpay (no app-switch); rich SKU rendering; in-chat refund tracking
- **Verdict**: deep-link remains compliant and cost-optimal for ZapText Starter/Growth restaurants. Native WhatsApp Pay is a Scale-tier feature, justified when a restaurant's monthly GMV exceeds ~₹5L.

### C6 — WhatsApp Flows

WhatsApp Flows ([whatsappbusiness.com/products/whatsapp-flows](https://whatsappbusiness.com/products/whatsapp-flows/)) lets businesses build interactive multi-screen experiences inside chat. Two modes:
- **Static**: predefined screens, no real-time data
- **Dynamic**: real-time data exchange via an HTTPS endpoint owned by the business — needed for reservation availability checks

**Eligibility**: Available to **both direct Cloud API and BSP-hosted businesses**. No India-specific gating. Globally GA since late 2023.

Restaurant use cases:
- **Table reservation**: date, time, party size, special requests; dynamic endpoint checks live availability (Apollo 24/7 case study reports 3x bookings, 50% no-show reduction at restaurants per flowsify.io)
- **Pre-order** with time-slot pickup
- **Feedback survey** with rating + comments in single multi-screen flow
- **Loyalty enrollment** capturing name, email, DOB, preferences
- **Custom cake order** with date, headcount, photo upload
- **Allergen survey** stored on customer profile
- **Group order** for offices (host + colleagues add items)

**Trigger paths**: Flow can be launched from a template (business-initiated), reply button, list selection, or CTWA welcome message (Meta CTWA docs show `customer_action_type: whatsapp_flow` payload).

### C7 — Click-to-WhatsApp Ads (CTWA)

Setup via Meta Ads Manager:
1. Campaign with **Messages** objective
2. Select WhatsApp as messaging destination
3. Connect WABA (must be in same Meta Business Manager as ad account)
4. Build welcome message (auto-greeting + optional Flow)
5. Wire conversion event via Conversions API or Meta Pixel for ROAS optimisation

**Direct Cloud API compatibility**: **Yes — CTWA works direct without BSP**. The WABA + Ads Manager link is the only requirement. Confirmed by Go4whatsup, AiSensy, Botsense guides.

**Opt-in**: CTWA click + first user message **opens the 72-h FEP window** (all messages including marketing templates free). CTWA traffic counts as opt-in **for the conversation duration**; for marketing templates *after* the 72-h FEP expires, collect explicit follow-up opt-in.

India CPM/CPL benchmarks (BSP-reported, directional only): real-estate CPL ₹120-350; conversation rate 8-14%; festive periods compress CPM 10-25%; CTWA conversion typically 2-3× landing-page funnels.

**Strategy for ZapText**: every restaurant should have a CTWA "free dessert with first order" entry flow — the 72-h FEP window means the first 72 hours of every new lead are free messaging. This is the single biggest cost-saver.

### C8 — Account quality, messaging limits, rate tiers

Meta's verbatim definition ([developers.facebook.com messaging-limits](https://developers.facebook.com/docs/whatsapp/cloud-api/overview#messaging-limits)): "*Messaging limits are the maximum number of unique WhatsApp user phone numbers your business can deliver messages to, outside of a customer service window, within a moving 24-hour period. Messaging limits are calculated and set at the business portfolio level and are shared by all business phone numbers within a portfolio*".

**Tier structure** (current docs):
- Newly created portfolios start at **250 unique recipients / 24h**
- Then **2,000** (via business verification OR sending 2K delivered messages over 30 days with high quality)
- Then **10,000** → **100,000** → **Unlimited**, automatic upgrades every 6 hours if quality stays High/Medium and ≥50% of current limit is used daily over 7 days

**October 2025 change**: limits are now **portfolio-level**, not per-phone-number — new numbers inherit the portfolio's highest tier.

**Quality rating**: Green (High) / Yellow (Medium) / Red (Low). Causes of degradation: user blocks, user reports, low engagement (high mute rate), template content violations, frequency-cap saturation. Red rating freezes tier upgrades and may pause templates.

**Frequency capping (2025+)**: users receive ~2 marketing template messages per day total across all brands; error 131049 = "*The user has already received too many marketing messages from businesses today*". Utility and service exempt. CTWA-initiated conversations within FEP exempt.

**Throughput**: standard Cloud API ~80 messages/second base; up to ~500 MPS reported on Cloud API; Unlimited tier accounts upgraded to up to 1,000 MPS.

**ZapText best practices to maintain Green rating**: launch new templates to ~1,000 recipients first; never broadcast without verified opt-in; provide easy opt-out keyword (STOP / RUKO); throttle Marketing pacing to under 1 per user per day even though Meta allows 2; categorise correctly (no Utility templates with promo content).

## Section 5 — Master context prompt

=== MASTER CONTEXT PROMPT BEGIN ===

# ZapText — WhatsApp Restaurant SaaS, India

## Product summary

ZapText is a direct WhatsApp Cloud API SaaS for Indian SMB restaurants — dhabas, cafes, cloud kitchens, sweet shops, bakeries, fine-dine, QSR. Pricing: ₹599 Starter / ₹1,499 Growth / ₹3,999 Scale per month. Customers are non-technical, English+Hindi/Hinglish owners. Geography: India only. The product's structural moat is **no BSP markup** — competitors (Wati ~₹2,900, AiSensy ~₹1,500, Interakt ~₹2,499, Gallabox ~₹7,400) all mark up Meta's per-message rates 10-25%; ZapText passes Meta's wholesale through. This is sacred and non-negotiable.

## Stack context

⚠️ **This is NOT the Next.js you know.** See the repo's `AGENTS.md`. The codebase uses a custom Next.js build with non-standard routing and rendering conventions. Always grep before assuming defaults.

Libraries:
- Next.js (custom build)
- Drizzle ORM
- Neon Postgres
- Clerk auth
- Groq SDK: `llama-3.3-70b-versatile` (chat), `whisper-large-v3` (voice)
- Google Gemini multimodal (menu OCR)
- Resend (transactional email, US-based)
- WhatsApp Cloud API **direct integration** — NOT BSP, NOT WhatsApp Business App

Key directories (verify against current repo):
- `whatsapp-bot-factory/lib/` — bot logic
- `app/api/menu/submit/route.ts` — menu submission handler
- `app/api/client/conversations/send/route.ts` — owner-side manual reply
- `app/(client)/` — owner workspace
- `app/m/[clientId]/` — customer-facing menu page

## Inventory of existing features

**Onboarding & bot config**: 20 restaurant sub-types (multi-select), 4 service modes, 5 service windows, delivery config (radius/charges/min/partners), surge pricing (rain%/peak%/festival%), table booking config, bulk/corporate orders, sub-type extras (cake leadtime/photo-on-cake, ice-cream tubs/scoops, juice fruit-of-day, mithai gift boxes), compliance fields (FSSAI/GSTIN/halal/jain/alcohol licence/pure-veg flag/shared-kitchen disclosure), quality claims gated (no-preservatives, no-MSG), cloud-kitchen multi-brand array.

**Menu management**: manual editor, paste-text bulk import, Gemini OCR photo bulk import, size variants auto-parsing, auto-sync to inventory.

**Customer WhatsApp flow**: Welcome interactive list (max 10 rows) on first inbound in 7-day window, menu link `/m/<clientId>?p=<phone>`, free-text chat orders via `[ORDER:total:items:address:notes]` tag, QR-scan dine-in (`/m/<clientId>/<table>/<session>`), reorder shortcut ("reorder" / "phir wahi"), live stock awareness, language detection (Hindi/English/Hinglish; free-tier forced English).

**Payments**: UPI deep-link via `[PAY:amount:note]` tag when owner has UPI ID + plan allows; payment-screenshot auto-verify (image OCR + amount/VPA detection); NOT yet wired to `/m` menu-link orders.

**Operations workspace**: KPIs (revenue/bookings/confirmed/menu-items), 7-day revenue chart, best-sellers, peak-hours heatmap, retention %, orders board with status flows (dine_in / home_delivery / parcel_takeaway), each status advance auto-pings customer, Tables / Specials / Live Tables / QR codes / Analytics pages.

**Automation**: owner email per new order (Resend), stale-session cron (60min), low-stock daily digest, trial bot caps + paid soft monthly cap with overage logging, live-takeover pause.

<non_negotiable_rules>

1. **Pass Meta's per-message rates through to restaurants without markup.** Any feature that requires a BSP markup is forbidden unless it generates ROI that justifies the markup (currently only WhatsApp Calling API and select WhatsApp Pay configurations qualify).
2. **Never store payment card data.** All payment via UPI deep-links or WhatsApp Pay through Razorpay/PayU (which holds the card). ZapText is not a payment aggregator under RBI Master Direction 2025.
3. **Never escrow customer funds.** Money flows direct from customer's UPI app to restaurant's UPI VPA. ZapText is a tech intermediary, not a PA.
4. **All marketing templates require explicit opt-in evidence** stored with phone, timestamp, source, business-name disclosure, categories. Inbound message ≠ marketing opt-in.
5. **AI is restaurant-task-scoped only.** General-purpose chatbots banned by Meta's Business Solution Terms (enforced Jan 15 2026). Llama-3.3 + Whisper used for ordering, FAQ, reservations, recommendations — not open-ended chat.
6. **Alcohol items are suppressed from chatbot display by default.** Only enabled when restaurant has state-specific online liquor licence (MH, WB) — even then, alcohol items never appear in marketing templates ("WhatsApp business messages promoting alcohol remain prohibited in India" — Meta).
7. **All surge pricing disclosed pre-add-to-cart** with itemised breakup. CCPA Dark Patterns Drip Pricing prohibition.
8. **FSSAI license number must display on `/m` menu page and every order confirmation.** Allergen + veg/non-veg symbol on each item. Calorie disclosure for FBOs with central licence or ≥10 outlets (FSSAI Reg 2.4.6).
9. **DPDPA breach reporting**: dual-clock — CERT-In 6 hours + DPB 72 hours. Build the runbook before substantive obligations enforce (May 13 2027).
10. **Never name competitors (Swiggy/Zomato/Magicpin/Dunzo) in approved Marketing templates.** Use generic phrasing ("save ₹X vs delivery apps"). Inside CSW free-form, naming is acceptable.
11. **Owner email body must minimise customer PII.** No full address; last-4 of phone only. Sign DPA with Resend.
12. **The repo is a custom Next.js build.** Verify routing/rendering conventions via `AGENTS.md` and grep before assuming defaults.

</non_negotiable_rules>

<policy_constraints>

**WhatsApp 24-hour customer service window**:
> "This opens a 24 hour customer service window (CSW)... Utility templates sent within an open CSW are free."
> [source: developers.facebook.com/docs/whatsapp/pricing]

**Per-message pricing transition (July 1 2025)**:
> "To align with industry-standards, effective July 1, 2025, Meta now charges on a per-message basis: You are only charged when a template message is delivered."
> [source: developers.facebook.com/docs/whatsapp/pricing]

**India rate card January 1 2026**:
- Marketing: ₹0.8631 per delivered message (flat, no volume tier)
- Utility: ₹0.115 per delivered (free in CSW; up to -30% volume tier)
- Authentication domestic: ₹0.115 (volume tier eligible)
- Service: free worldwide since Nov 1 2024 (in CSW only)
- All + 18% GST
- INR billing localisation live since Jan 1 2026

**Opt-in**:
> "You may only contact people on WhatsApp if: (a) they have given you their mobile phone number; and (b) you have received opt-in permission from the recipient confirming that they wish to receive subsequent messages or calls from you."
> [source: business.whatsapp.com/policy]

November 2024 relaxation: general opt-in acceptable if (i) business name stated (ii) user told they'll receive messages (iii) valid mobile number collected.

**Alcohol in India (Meta August 27 2024 update)**:
> "WhatsApp business messages promoting alcohol remain prohibited in India."
> [source: haptik.ai/blog/whatsapp-business-messaging-regulated-sectors]

**AI providers (Business Solution Terms March 6 2026 update)**:
> "Providers and developers of artificial intelligence or machine learning technologies... are strictly prohibited from accessing or using the WhatsApp Business Solution... when such technologies are the primary (rather than incidental or ancillary) functionality being made available for use."
> [source: whatsapp.com/legal/business-solution-terms/preview]
Task-scoped restaurant bots (ZapText) are explicitly allowed; general-purpose GPT-style chatbots are not.

**Messaging limits (October 2025 portfolio reform)**:
> "Messaging limits are calculated and set at the business portfolio level and are shared by all business phone numbers within a portfolio."
> [source: developers.facebook.com/docs/whatsapp/messaging-limits]
Tiers: 250 → 2K → 10K → 100K → unlimited; auto-scaling every 6h.

**Frequency cap**: ~2 marketing templates/user/24h across all brands; error 131049 on saturation. Utility/service/CTWA-FEP exempt.

**Catalog India mandatory fields**: origin_country, importer_name, importer_address (Indian CP E-Commerce Rules 2020 alignment).

**DPDPA 2023 §6 consent**:
> "The consent given by the Data Principal shall be free, specific, informed, unconditional and unambiguous with a clear affirmative action, and shall signify an agreement to the processing of her personal data for the specified purpose and be limited to such personal data as is necessary for such specified purpose."
> [source: meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8fef35e82c42aa5.pdf]

**DPDPA §7(a) legitimate use**:
> "For the specified purpose for which the Data Principal has voluntarily provided her personal data to the Data Fiduciary, and in respect of which she has not indicated to the Data Fiduciary that she does not consent to the use of her personal data."

**DPDPA §8(7)(a) erasure**:
> "Erase personal data, upon the Data Principal withdrawing her consent or as soon as it is reasonable to assume that the specified purpose is no longer being served."

**DPDPA breach notification** — Rule 7 DPDP Rules 2025 (G.S.R. 846(E), 13 Nov 2025): initial intimation to DPB + affected principals without delay; detailed report within 72 hours. CERT-In parallel obligation: 6 hours under IT Act §70B(6).

**DPDPA penalties**: failure to implement security safeguards (§8(5)) up to ₹250 crore; failure to notify breach (§8(6)) up to ₹200 crore; other breaches up to ₹50 crore.

**DPDPA enforcement timeline**: Phase II (Consent Managers) Nov 13 2026; Phase III (substantive — notice, consent, rights, breach, security, cross-border) **May 13 2027**.

**FSSAI Reg 2.4.6** (Labelling & Display Regs 2020):
> "Food Service Establishment having central license or outlets at ten or more locations shall mention the calorific value (in kcal per serving and serving size) against the food items displayed on the menu cards or boards or booklets."
> [source: fssai.gov.in gazette notification 21 Aug 2020]
Allergen disclosure (8 allergens: gluten-cereals, crustacean, eggs, fish, peanuts, soybeans, milk, tree-nuts) + veg/non-veg symbol mandatory for all FBOs.

**FSSAI Adv & Claims Regs 2018 Reg 3**:
> "Claims must be truthful, unambiguous, meaningful, not misleading and help consumers to comprehend the information provided."
> [source: fssai.gov.in/upload/uploadfiles/files/Gazette_Notification_Advertising_Claims_27_11_2018.pdf]
"100% pure/natural" claims banned in 2025 unless unequivocally substantiated. "No MSG/no preservatives" only valid if substance is neither added nor naturally present at functional levels. FSS Act §53 penalty up to ₹10 lakh.

**Consumer Protection (E-Commerce) Rules 2020, Rule 5(3)/6(5)**:
> "Total price in single figure of any good or service, along with the breakup price for the good or service, showing all the compulsory and voluntary charges such as delivery charges, postage and handling charges, conveyance charges and the applicable tax."

**CCPA Dark Patterns Guidelines 2023** — 13 patterns prohibited including Drip Pricing, Basket Sneaking, Forced Action, Subscription Trap.

**RBI PA Master Direction 2025**: payment aggregators (fund handlers) require licence, ₹15-25 crore net worth. Payment gateways and tech intermediaries that **never touch funds** are exempt. ZapText falls in the exempt class.

**TRAI TCCCPR DLT**: applies to SMS/voice on telecom networks only; WhatsApp is OTT, regulated by Meta, **not by TRAI**. ZapText does **not** need DLT registration.

</policy_constraints>

<existing_features>

Non-compliant and risky items requiring action:

| Feature | Status | Required fix | File hint |
|---|---|---|---|
| Pure-veg / Jain / Halal claims displayed without proof | RISKY | Require certificate upload pre-display; add shared-kitchen disclaimer when flag set; block "100%" wording | `whatsapp-bot-factory/lib/menu-render.ts`, `app/(client)/restaurant/compliance/` |
| Surge pricing disclosure timing | RISKY | Move to pre-add-to-cart with itemised breakdown | `app/m/[clientId]/checkout/` |
| Inbound-as-marketing-opt-in (future broadcast risk) | RISKY | Add explicit consent prompt + log table | `app/api/whatsapp/webhook/route.ts`, new `db/schema/consent.ts` |
| Reorder shortcut without consent context | RISKY | Add consent statement at first reorder; honour erasure requests | `whatsapp-bot-factory/lib/reorder.ts` |
| Aggregator price-comparison in templates | RISKY | Strip competitor names from approved Marketing templates; allow only in free-form inside CSW | `whatsapp-bot-factory/lib/templates/` |
| Owner email PII (Resend US) | RISKY | Sign Resend DPA; minimise body (last-4 phone, no full address) | `app/api/orders/route.ts`, `lib/email/owner-notification.ts` |
| Payment-screenshot retention | RISKY | Auto-delete after 7 days post-verification; strip non-amount/VPA data | `app/api/payments/verify-screenshot/route.ts` |
| FSSAI compliance display incomplete | NON-COMPLIANT for ≥10-outlet chains | Render FSSAI number, validity, allergen icons, calorie when chain | `app/m/[clientId]/page.tsx`, `whatsapp-bot-factory/lib/compliance-footer.ts` |
| No DPDPA consent log | NON-COMPLIANT pre-May-2027 | Build consent table; capture all opt-in events; expose data-principal rights endpoints | new `db/schema/consent.ts`, new `app/api/dpdpa/` |
| No breach-notification runbook | NON-COMPLIANT pre-May-2027 | Document CERT-In 6h + DPB 72h response | new `docs/incident-response.md` |

</existing_features>

<new_features_roadmap>

Top 10 priorities for next 12 months (full top-25 in Section 3 of the source report):

| # | Feature | Effort | Policy | India reg | Tier | BSP |
|---|---|---|---|---|---|---|
| 1 | Gemini OCR menu onboarding | M | none | none | 🛡️ ₹599 | No |
| 2 | WhatsApp Catalog + SPM/MPM (≤30 items) | M | India mandatory fields; no alcohol | FSSAI allergen + veg/non-veg per item | 🛡️ ₹599 | No |
| 3 | Flows for reservation + reminder cascade | M | Utility templates for reminders | none | 🛡️ ₹599 | No |
| 4 | Hinglish voice order (Whisper) | M | task-scoped AI OK | none | 🛡️ ₹599 | No |
| 5 | NPS/CSAT Flow post-bill | S | Utility (transactional) | none | 🛡️ ₹599 | No |
| 6 | Birthday/anniversary auto-greeting | S | Marketing category; frequency cap; opt-in required | DPDPA §6 | 🚀 ₹1,499 | No |
| 7 | CTWA "free dessert" entry flow | S | 72h FEP free window | none | 🚀 ₹1,499 | No |
| 8 | Coupon-code template (Copy Code button) | S | Marketing category | none | 🚀 ₹1,499 | No |
| 9 | Frequency-aware Marketing scheduler | M | Meta ~2 mkt/user/24h cap | none | 🚀 ₹1,499 | No |
| 10 | UPI Lite tip jar | S | text/URL allowed | RBI UPI Lite limits | 🛡️ ₹599 | No |

Deferred to year-2 unless customer demand pulls forward:
- WhatsApp Pay native via Razorpay (💎 Scale, optional-but-faster with BSP)
- Multi-outlet routing (💎 Scale)
- Cloud-kitchen multi-brand context (💎 Scale)
- WhatsApp Calling API (💎 Scale, **Yes BSP required**)
- ONDC twin-listing (💎 Scale)
- UPI AutoPay tiffin subscriptions (💎 Scale)

</new_features_roadmap>

## Build order recommendation

**Phase 0 (week 1-2) — Compliance hardening, blocking**:
1. Add DPDPA consent log table; wire all opt-in events
2. Build privacy notice page in English + Hindi; link from `/m` first-visit and bot welcome
3. Sign Resend DPA; minimise PII in owner email
4. Move surge disclosure to pre-add-to-cart with itemised breakdown
5. Strip competitor names from any aggregator-comparison templates; keep comparisons in free-form CSW only
6. Render FSSAI number + allergen + veg/non-veg symbol on `/m` menu and order confirmations
7. Document CERT-In/DPB breach runbook

**Phase 1 (week 3-6) — Defend ₹599 (Starter wedge)**:
8. Gemini OCR menu onboarding magic
9. WhatsApp Catalog + SPM/MPM as alternative to `/m` menu
10. Reservation Flow + reminder cascade
11. Hinglish voice order via Whisper
12. NPS/CSAT Flow post-bill
13. Allergen-aware ordering Flow

**Phase 2 (week 7-10) — Growth tier pull (₹1,499)**:
14. Explicit marketing opt-in collection (DOB Flow)
15. Birthday/anniversary auto-greeting Marketing template
16. CTWA entry-flow library + Status Ads guidance
17. Coupon-code templates (Copy Code button)
18. Cart-abandonment recovery (Utility + 1 Marketing follow-up)
19. Lapsed-customer winback (60-day)
20. Carousel templates for "today's specials"
21. Frequency-aware Marketing scheduler

**Phase 3 (week 11-16) — Scale tier (₹3,999)**:
22. Multi-outlet routing on single WABA
23. Cloud-kitchen multi-brand context routing
24. WhatsApp Pay native (Razorpay or PayU; opt-in per restaurant)
25. Group-order Flow for offices
26. Festival pre-order with deposit
27. Channel for daily specials (free organic broadcast)

**Phase 4 (year-2) — only if customer pull justifies**:
28. WhatsApp Calling API (requires BSP partnership; minimum 1K tier)
29. ONDC twin-listing via SNP partner
30. UPI AutoPay tiffin subscriptions

**Rationale**: compliance fixes are non-optional and block defensibility against the May 13 2027 DPDPA enforcement date plus FSSAI/CCPA action that can hit any day. Phase 1 features defend the ₹599 wedge against Gallabox (whose Petpooja connector is "in development") and the BSP generalists (Wati/Interakt/AiSensy) who have no restaurant vertical. Phase 2 features create the natural Starter→Growth upgrade pull. Phase 3 unlocks multi-outlet and cloud-kitchen segments where ZapText currently has no competition. Phase 4 features require BSP partnerships or new commercial relationships that should only be entered when a paying customer has signed.

## Final checklist

- [ ] Build DPDPA consent log table (`db/schema/consent.ts`) with phone, timestamp, source, business-name disclosure text, categories opted-in, privacy-notice-version, opt-out timestamp
- [ ] Publish bilingual privacy notice (English + Hindi) and link from `/m` first-visit + bot welcome
- [ ] Sign Resend Data Processing Addendum covering DPDPA §8(2) Data Processor obligations
- [ ] Minimise owner-email PII (last-4 of phone only, no full address) in `lib/email/owner-notification.ts`
- [ ] Move surge pricing disclosure to pre-add-to-cart with itemised breakdown in `app/m/[clientId]/checkout/`
- [ ] Strip competitor names (Swiggy/Zomato/Magicpin/Dunzo) from all approved Marketing templates; allow naming only in free-form CSW replies
- [ ] Render FSSAI licence number + validity on `/m` menu page footer + every order confirmation
- [ ] Display allergen disclosure (8 allergens) per menu item; veg/non-veg symbol per item
- [ ] Display calorie/serving information for restaurants with central licence or ≥10 outlets (FSSAI Reg 2.4.6)
- [ ] Add shared-kitchen disclaimer when `shared_kitchen_with_non_veg = true` on pure-veg / Jain claims
- [ ] Require certificate proof upload before halal/jain/pure-veg claim displays
- [ ] Block "100% pure" or "100% natural" wording in bot replies per FSSAI 2025 guidance
- [ ] Build CERT-In 6h + DPB 72h breach-notification runbook (`docs/incident-response.md`)
- [ ] Appoint Grievance Officer; display contact on `/m` page per CP E-Commerce Rule 4(5)
- [ ] Build window-tracker for 24h customer service window per conversation; route status-pings through Utility template fallback when CSW closed
- [ ] Create Meta-approved Utility templates: order_confirmed, order_preparing, order_dispatched, order_ready, table_booking_confirmed, payment_received, bill_summary
- [ ] Auto-delete payment-screenshot uploads 7 days post-verification; strip to amount + VPA only
- [ ] Ship Gemini OCR menu onboarding flow ("photograph your menu, we'll build your catalog")
- [ ] Implement WhatsApp Catalog (≤500 items, India fields populated) + SPM/MPM as Starter-tier alternative to `/m` web menu
- [ ] Build reservation Flow (dynamic endpoint for availability) + T-24h Utility reminder + T-2h reply-button confirm
- [ ] Ship Hinglish voice-order pipeline (WhatsApp voice → Whisper transcript → Llama-3.3 menu match → confirmation Flow)
- [ ] Build NPS/CSAT Flow firing 2h post-bill; 5-star → Google review deep-link; ≤3 → manager handoff with order context
- [ ] Build allergen-aware ordering Flow (one-time intake stored on customer profile; bot warns at checkout)
- [ ] Build explicit marketing opt-in collection (DOB + categories Flow with consent text and business name)
- [ ] Ship birthday/anniversary auto-greeting Marketing template (only for opted-in customers)
- [ ] Build CTWA entry-flow library: "free dessert with first order" coupon flow
- [ ] Document Status Ads guidance for restaurants (1080×1920 spec, "Send Message" CTA)
- [ ] Ship coupon-code Marketing templates with Copy Code button (static + dynamic merge field)
- [ ] Build cart-abandonment recovery: Utility nudge inside 24h CSW (free) + 1 Marketing template 24h later (opt-in required)
- [ ] Build lapsed-customer winback (60-day inactivity → 15% off Marketing template)
- [ ] Ship Carousel templates (2-10 cards) for "Today's specials"
- [ ] Build frequency-aware Marketing scheduler to avoid error 131049 user-saturation
- [ ] Build multi-outlet routing on single WABA (branch picker → branch KOT + catalog)
- [ ] Build cloud-kitchen multi-brand context routing ("I want pizza" → Brand B catalog + KOT printer)
- [ ] Ship WhatsApp Pay native via Razorpay (or PayU) using `order_details` message; opt-in per restaurant; require Razorpay account
- [ ] Build group-order Flow for offices (host shares link, colleagues add items, host pays once)
- [ ] Build festival pre-order Flow (Diwali/Eid/Karva Chauth) with deposit via WA Pay
- [ ] Set up WhatsApp Channel template for daily specials (free organic broadcast)
- [ ] Wire data-principal rights endpoints (DPDPA §11 access + §12 correction/erasure within 90 days)
- [ ] Quarterly: audit template categorisation (no Utility templates with promo content); verify opt-in records; review quality rating; review messaging-limit tier
- [ ] Audit ahead of May 13 2027: full DPDPA substantive compliance review

=== MASTER CONTEXT PROMPT END ===

## Section 6 — Sources / citations

**Meta WhatsApp Business Platform**
- Pricing doc + per-message transition: https://developers.facebook.com/docs/whatsapp/pricing
- Template categorization: https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates
- Messaging limits: https://developers.facebook.com/docs/whatsapp/cloud-api/overview
- Business Messaging Policy: https://business.whatsapp.com/policy
- Commerce Policy: https://www.facebook.com/policies_center/commerce
- WhatsApp Business product policy: https://whatsappbusiness.com/policy/
- WhatsApp Business Solution Terms: https://www.whatsapp.com/legal/business-solution-terms/preview
- Cloud API interactive list messages: https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-list-messages/
- WhatsApp Flows: https://whatsappbusiness.com/products/whatsapp-flows/
- WhatsApp Payments (India): https://developers.facebook.com/docs/whatsapp/cloud-api/messages/payments
- Click-to-WhatsApp Ads: https://developers.facebook.com/docs/marketing-api/ad-creative/messaging-ads/click-to-whatsapp/
- BSP / Tech Provider partners: https://business.whatsapp.com/partners

**India regulators — primary sources**
- DPDPA 2023 official text: https://www.meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8fef35e82c42aa5.pdf
- DPDP Rules 2025 (final, G.S.R. 846(E)): https://ssrana.in/articles/meity-notifies-final-digital-personal-data-protection-rules-2025/ (PIB summary at pib.gov.in)
- FSSAI Menu Labelling gazette (21 Aug 2020): https://fssai.gov.in/upload/notifications/2020/08/5f4611c4eca96Gazette_Notification_Information_Display_Food_26_08_2020.pdf
- FSSAI Adv & Claims Regs 2018: https://fssai.gov.in/upload/uploadfiles/files/Gazette_Notification_Advertising_Claims_27_11_2018.pdf
- FSSAI Labelling & Display Regs 2020: https://fssai.gov.in/cms/gazettenotificationviewall.php
- Consumer Protection (E-Commerce) Rules 2020: https://thc.nic.in/Central%20Governmental%20Rules/Consumer%20Protection%20(E-Commerce)%20Rules,%202020.pdf
- CCPA Dark Patterns Guidelines 2023: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2134765
- RBI PA Master Direction 2025: https://www.fidcindia.org.in/wp-content/uploads/2025/09/RBI-PAYMENT-AGGREGATORS-DIRECTIONS-15-09-25.pdf
- NPCI UPI Linking Specifications v1.6: https://www.labnol.org/files/linking.pdf
- CBIC e-invoice Notification 10/2023: https://gstcouncil.gov.in/node/4365
- TRAI TCCCPR 2025 amendment: https://www.trai.gov.in/sites/default/files/2025-02/Regulation_12022025.pdf
- IT SPDI Rules 2011: https://www.dataguidance.com/sites/default/files/in098en.pdf
- Cable TV Programme & Advertising Codes (MIB 2 Jan 2025): https://mib.gov.in/sites/default/files/2025-01/programme-and-advertising-code-as-on-02.01.2025.pdf
- MoCI Halal Export Notification 25/2022-23: https://content.dgft.gov.in/Website/dgftprod/108d0e49-1d1f-4959-ba59-bffec030ac94/Trade%20Notice%20No%2025.pdf

**Competitor pricing pages (verified 12-14 May 2026)**
- Wati: https://wati.io/pricing
- AiSensy: https://aisensy.com/pricing
- Interakt: https://interakt.shop (techjockey.com, gokwik.co/blog/interakt-pricing)
- Gallabox: https://gallabox.com/pricing
- DoubleTick: https://doubletick.io/pricing
- Petpooja: triangulated from techjockey.com, G2, capterra, softwaresuggest
- LimeTray, UrbanPiper, Posist/Restroworks, Dotpe: SelectHub, GetApp, SaaSworthy

**BSP / payment partner docs**
- PayU WhatsApp Payments India: https://docs.payu.in/docs/integrate-whatsapp-payments
- Razorpay on WhatsApp: https://razorpay.com/docs/payments/whatsapp
- 360dialog Payments: 360dialog.com docs
- Infobip WhatsApp Payments India: infobip.com/docs/whatsapp/whatsapp-payments/india
- Kaleyra (Tata Comms) WhatsApp Pay: developers.kaleyra.io/docs/whatsapp-pay
- MSG91 pricing: msg91.com/guide
- Whautomate India pricing: https://whautomate.com/whatsapp-business-api-pricing-india
- AuthKey 2026 update: https://authkey.io/blogs/whatsapp-pricing-update-2026/
- Happilee volume tiers: https://happilee.io/whatsapp-business-api-volume-tier-pricing-india/

**Industry analyses cited**
- TechCrunch (WhatsApp Pay India usage April 23 2026; Razorpay/PayU partnership Sep 19 2023)
- BusinessStandard, India TV News (NPCI lifting WhatsApp Pay cap, Dec 2024)
- Haptik (Aug 2024 alcohol carve-out India)
- Chatarmin (frequency-cap mechanics, messaging-limit reform)
- Sleekflow help docs (utility-in-CSW free rule)
- Asia Tech Review (WhatsApp Pay approval, NPCI 30% cap deferral)
- Onsync, Insider Academy, Wuseller (opt-in policy + evidence requirements)

**Note on source quality**: All Meta policy verbatim quotes and Indian primary regulatory texts were cross-verified against the official source URLs above. Competitor pricing is verified via the live pricing pages or, where pages were paywalled (Petpooja, UrbanPiper, Posist, Dotpe), triangulated across at least three third-party listings (techjockey, G2, capterra, softwaresuggest, SaaSworthy). BSP markup percentages are derived from publicly published rate cards plus third-party audit blogs (Heltar, QuickReply, Codingclave, Unique Digital Outreach) — these are flagged where they cannot be independently verified against the BSP's own published rate card.