# Razorpay Route integration — implementation plan

Based on the design Q&A:
- Live Razorpay account ✅, Route NOT activated ⚠️
- Auto-split: 3% ZapText + 97% restaurant per order
- KYC: hybrid (text fields mandatory + optional URL/file upload)
- KYC verification: hybrid (Razorpay auto + admin review for edge cases)

---

## What you need to do (before deploy)

| # | Action | Where | When |
|---|---|---|---|
| 1 | Apply for **Razorpay Route activation** | Razorpay Dashboard → Apps → Route → Apply | TODAY (takes 3-7 days) |
| 2 | Get **API keys** (live mode, with Route capability) | Razorpay Dashboard → Settings → API Keys | After Route activation |
| 3 | Set up **webhook URL** in Razorpay dashboard | Dashboard → Webhooks → New | When Phase B deploys |
| 4 | Add env vars to Vercel | Vercel → Project → Settings → Env Vars | When keys ready |
| 5 | Submit ZapText's own KYC to Razorpay | Razorpay onboarding | Already done (live account exists) |

**Env vars I'll wire up:**
```
RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=xxx       # for signature verification
RAZORPAY_PLATFORM_COMMISSION=3    # percentage; default 3
```

If any of these are missing the code falls back to a "KYC-only" mode — KYC submissions still work, but Razorpay API calls are stubbed. So you can deploy Phase A even before Route activates.

---

## Data model — new fields on `clients`

| Column | Type | Default | Purpose |
|---|---|---|---|
| `razorpay_account_id` | `text` | `null` | Linked-Account ID returned by Razorpay (`acc_XXX`). Set once after KYC verified. |
| `kyc_status` | `varchar(24)` | `'not_submitted'` | One of: `not_submitted` / `pending_review` / `verified` / `rejected` |
| `kyc_submitted_at` | `timestamptz` | `null` | When restaurant submitted form. |
| `kyc_reviewed_at` | `timestamptz` | `null` | When admin or Razorpay processed it. |
| `kyc_review_notes` | `text` | `''` | Why rejected, or admin notes. |
| `kyc_business_legal_name` | `varchar(200)` | `''` | Legal name (must match PAN). |
| `kyc_business_type` | `varchar(40)` | `''` | `individual` / `proprietorship` / `partnership` / `private_limited` / `llp` |
| `kyc_pan` | `varchar(10)` | `''` | PAN number (format: ABCDE1234F). |
| `kyc_gstin` | `varchar(15)` | `''` | Optional GSTIN. |
| `kyc_fssai_number` | `varchar(14)` | `''` | 14-digit FSSAI licence. |
| `kyc_fssai_expiry` | `varchar(10)` | `''` | YYYY-MM-DD. |
| `kyc_bank_account_holder` | `varchar(200)` | `''` | Must match legal name on PAN. |
| `kyc_bank_account_number` | `varchar(30)` | `''` | |
| `kyc_bank_ifsc` | `varchar(11)` | `''` | IFSC (format: ABCD0123456). |
| `kyc_documents_json` | `text` | `'[]'` | JSON array of `{label, url}` pairs (optional doc URLs). |
| `payments_enabled` | `boolean` | `false` | Owner-toggleable. Gated: only flippable when `kyc_status === 'verified'`. |

Migration file: `drizzle/0010_razorpay_kyc.sql`

---

## Build phases

### Phase A — KYC form + admin review (2 days, no Razorpay API)

**Goal:** Restaurant can submit KYC. Admin can approve / reject. Payments stay off until verified. Razorpay API calls stubbed.

**Files:**

1. `lib/db/schema.ts` — 16 new columns on `clients`.
2. `drizzle/0010_razorpay_kyc.sql` — migration.
3. `lib/types.ts` — `ClientRow` gains KYC fields.
4. `lib/db/clients.ts` — mapper + writers.
5. `lib/razorpay/kyc.ts` (NEW) — validators (PAN regex, IFSC regex, FSSAI 14-digit), helpers (`canEnablePayments(client)`, `formatKycStatus()`).
6. `app/api/client/kyc/submit/route.ts` (NEW) — POST. Restaurant submits form → row marked `pending_review`. If Razorpay keys present + Route active → also POST to Razorpay `/v1/accounts` (stakeholder API); else just save fields.
7. `app/api/admin/kyc/list/route.ts` (NEW) — GET. Returns all clients with `kyc_status = 'pending_review'`.
8. `app/api/admin/kyc/decide/route.ts` (NEW) — PATCH. Admin approves / rejects. On approve: sets `payments_enabled` available; if Razorpay live + Route, calls API to activate linked account.
9. `app/client/settings/page.tsx` — new "Payments & KYC" panel with form (fields above), status pill, "Submit for review" button. Once verified: "Enable payments" toggle (gates ON `payments_enabled`).
10. `app/admin/kyc/page.tsx` (NEW) — admin queue UI. Cards per pending KYC with form fields shown, approve/reject buttons.
11. Onboarding wizard: add KYC step as **optional**. Banner: "Skip for now — you can add this later from Settings. **Payments will stay off until you submit KYC.**"

**Verification:** owner can submit KYC → admin sees in queue → admin approves → "Enable payments" toggle unlocks. Razorpay API not called yet (stubbed).

---

### Phase B — Razorpay Linked Accounts + payment links (2 days)

**Goal:** Approved restaurants get a Razorpay Linked Account (`acc_XXX`). Bot's `[PAY:]` tag emits a Razorpay payment link with auto-split. Webhook auto-confirms order on payment.captured.

**Files:**

1. `lib/razorpay/client.ts` (NEW) — initialised Razorpay SDK client. Returns `null` if keys missing (graceful degrade).
2. `lib/razorpay/linked-account.ts` (NEW) — `createLinkedAccount(client: ClientRow)` calls `/v2/accounts` with stakeholder details + bank, returns `acc_XXX`. Stores in `clients.razorpay_account_id`. Called on admin approve.
3. `lib/razorpay/payment-link.ts` (NEW) — `createPaymentLink({amount, customerPhone, bookingId, linkedAccountId})` — calls `/v1/payment_links` with `transfers` array: `[{account: linkedAccountId, amount: 97%, currency: 'INR'}]`. ZapText keeps the remaining 3% in the master merchant.
4. `app/api/webhook/razorpay/route.ts` (NEW) — verifies `X-Razorpay-Signature` header against `RAZORPAY_WEBHOOK_SECRET`, handles `payment.captured` event:
   - Looks up `bookings` row by `razorpay_payment_link_id`.
   - Marks `status='paid'`, `paid_at=now()`.
   - Sends customer WhatsApp confirmation: "Payment received. Order pakka."
   - Sends owner WhatsApp ping (gated on `notify_whatsapp`).
5. `lib/db/schema.ts` — add `bookings.razorpay_payment_link_id` and `razorpay_payment_id` columns.
6. `app/api/webhook/route.ts` — update existing `[PAY:]` tag handler:
   - If `client.payments_enabled` + `razorpay_account_id` present → emit Razorpay payment link.
   - Else fall back to existing UPI flow.
7. `lib/prompt-generator.ts` — paymentContext block now mentions "I'll send you a secure payment link via Razorpay" (when payments enabled) vs current UPI deep-link.

**Verification:** customer orders → bot emits `[PAY:560:Order #1234]` → Razorpay payment link generated with 3/97 split → customer pays → webhook fires → order auto-confirmed.

---

### Phase C — Storefront integration (1 day)

**Goal:** `<slug>.zaptext.shop` storefront uses Razorpay Checkout instead of UPI screenshot.

**Files:**

1. `app/m/[clientId]/checkout/page.tsx` — replace UPI screenshot UI with Razorpay Checkout button. On success → POST to `/api/storefront/payment-confirm`.
2. `app/api/storefront/payment-confirm/route.ts` (NEW) — verifies payment, marks order paid (same flow as webhook for redundancy).

---

### Phase D — Onboarding form (0.5 day)

**Goal:** New KYC step in onboarding wizard, marked "Optional — skip for now".

**Files:**

1. `app/onboarding/components/KycStep.tsx` (NEW)
2. Wizard updated to include KycStep as second-to-last (before opt-in).
3. Banner UI: "Adding payment details now lets you accept online orders from day one. You can skip and add later from Settings — payments will stay off until you complete KYC."

---

### Phase E — Admin settlement dashboard (1 day, after Phase B)

**Goal:** Admin sees per-restaurant Razorpay settlement / commission breakdown.

**Files:**

1. `app/admin/razorpay-settlements/page.tsx` (NEW) — table view: restaurant, total volume, 3% commission, last settlement date, current balance.
2. Reads from Razorpay API (`/v1/settlements`).

---

## Decisions I've taken (please confirm or push back)

1. **3% is FIXED at platform level**, not per-restaurant. (Future: per-tier commission rates, but Phase A doesn't need this.)
2. **Master merchant = ZapText**. All 100% of payment lands in ZapText's Razorpay account first; the `transfers` array routes 97% to restaurant's Linked Account in the same transaction (Razorpay Route's native split, no manual NEFT).
3. **KYC verification is admin-first**, Razorpay API is invoked silently in the background. Even after admin approves, the Linked Account creation might fail at Razorpay (e.g. PAN-bank-mismatch); status flips to `rejected` with the Razorpay error message in `kyc_review_notes`. Admin sees this and asks restaurant to resubmit.
4. **Payment failure / abandoned cart**: customer doesn't pay → order stays in `pending_payment` status. Bot doesn't auto-cancel. Owner sees it in Today's Orders Kanban and can manually mark cancelled (existing cancel flow).
5. **Refunds**: bot does NOT process refunds. Admin-only via `/admin/razorpay-refunds` page (Phase E or later). Customer asking for refund → escalation flag (already wired in WI7).
6. **Restaurants without Razorpay/payments**: keep current "no online payment" mode. The `payments_enabled` toggle stays OFF; bot's [PAY:] tag in prompt is suppressed. They run cash-only.
7. **Onboarding flow**: KYC step is optional, but a yellow banner shows when status = `not_submitted` reminding the owner. Persistent until they either submit or dismiss.

---

## Concerns / risks

1. **Route activation timeline**: 3-7 business days minimum. If you applied today, code can deploy in dormant mode and switch live when activation comes through.
2. **Razorpay's Linked Account KYC**: requires PAN matching legal name, bank account verification (penny-drop test), business proof. Some restaurants will get rejected — admin needs to communicate clearly.
3. **3% commission rate**: industry standard is 1.99-2.5% transaction fee from gateway. Adding 3% on top = customer pays effective ~5%. For ₹500 order = ₹25 extra. Worth checking competitors — Petpooja takes a flat monthly subscription instead of per-transaction cut.
4. **Webhook reliability**: Razorpay retries failed webhooks 5 times. If our webhook endpoint is down, order stays in `pending_payment` until manual reconciliation.
5. **Customer experience on payment-link**: opens in browser, customer pays, lands on Razorpay's success page — NOT back on WhatsApp. They need to switch back manually. Razorpay's "return URL" can be configured to a deep-link `https://wa.me/<bot-number>?text=paid` but Razorpay Checkout opens in same tab.

---

## Ready to start?

**If yes:** I'll build Phase A right now — schema, types, KYC submission form, admin review queue, payments-enabled toggle. ~2-day scope but I'll keep it incremental (3-4 commits). No Razorpay API calls until Phase B.

**If you want changes to the plan:** point them out, I'll revise.

**Particular questions:**

a. Onboarding KYC step — show a "Skip for now" link OR a "Add KYC details" button (no skip)? You said "optional rakhdena", confirming **skip link**.

b. The 3% — calculated on ORDER subtotal or ORDER total (subtotal + delivery charges + taxes)? Industry default is subtotal.

c. Admin panel for KYC review — do you (the platform owner) want to be the only admin, or can other ZapText team members get admin access? Affects auth scope.

d. Webhook idempotency: Razorpay sends `event_id` per delivery. Should I store these to prevent double-processing on retry? (Yes recommended.)

Answer these 4 + give me "go" → I start Phase A.
