# UI Redesign + Multi-Bot Architecture — Design Spec

## Context

The current WhatsApp Bot Factory has the backend functionality built, but the UI is plain and assumes 1 business = 1 client. We need to:

1. Redesign all pages with a premium "Cream & Forest" palette (Modern SaaS style, Stripe/Linear inspired)
2. Restructure the data model so that **one user can own multiple bots** (each bot = one business with its own WhatsApp number)
3. Build a bot-switcher so users can manage multiple bots from a single account

The user already approved visual mockups for: Homepage, Admin Dashboard, Create Bot wizard, and Client Dashboard with bot switcher.

---

## Visual Design System

### Color Palette — Cream & Forest

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-main` | `#F3EDE3` | Main page background (cream) |
| `--bg-subtle` | `#FAF7F2` | Secondary surfaces, form inputs |
| `--bg-card` | `#FFFFFF` | Cards, panels, main content surfaces |
| `--sidebar-bg` | `#1a2e1d` | Sidebar (deep forest) |
| `--sidebar-fg` | `#FAF7F2` | Sidebar text |
| `--primary` | `#1a5d47` | Primary buttons, forest green |
| `--primary-fg` | `#FAF7F2` | Text on primary |
| `--accent` | `#25D366` | WhatsApp green — highlights, active states, CTAs on dark |
| `--accent-light` | `#86efac` | Soft green for dark backgrounds |
| `--text-main` | `#1a2e1d` | Primary text on cream |
| `--text-muted` | `#5a6b5d` | Secondary text |
| `--text-subtle` | `#8a9b8d` | Tertiary text, placeholders |
| `--border` | `#e5dcc8` | Card and input borders |
| `--border-subtle` | `#f3ede3` | Row separators |
| `--success-bg` | `#dcfce7` | Success pills/badges |
| `--success-fg` | `#15803d` | Success text |
| `--warning-bg` | `#fef3c7` | Warning pills |
| `--warning-fg` | `#92400e` | Warning text |

### Dark Mode
Dark mode flips main backgrounds to deep forest/near-black variants, keeps green accents, and inverts text colors. Sidebar stays dark in both modes.

### Typography
- Font: `-apple-system, Inter, sans-serif`
- Headings: 700 weight, tight letter-spacing (-0.02em)
- Body: 14px default, 500 weight
- Labels: 11px uppercase, 0.05em letter-spacing

### Component Patterns
- **Cards:** White bg, cream border (`#e5dcc8`), 14-16px radius, subtle shadow
- **Buttons:** 10px radius, 600 weight
  - Primary: forest green bg, cream text
  - Ghost: white bg, cream border, dark text
  - Accent: WhatsApp green bg (for CTAs inside dark sections)
- **Form inputs:** White bg, cream border, 8px radius
- **Status pills:** Rounded full, soft tinted bg + matching dark text
- **Sidebar links:** 8px radius, active state gets green-tinted bg + 3px left border

---

## Data Model Changes (Critical)

### Current (Broken for multi-bot)
- Clerk user has `publicMetadata.clientId` pointing to one client row
- One Clerk user = one business

### New Architecture
- Clerk user has `publicMetadata.userId` (self reference) — no single bot binding
- Google Sheet `clients` table becomes `bots` conceptually — each row represents one bot
- New column added to clients sheet: `owner_user_id` — Clerk user ID of the owner
- A user can have N rows in `clients` sheet (N bots)
- API routes that currently use `user.clientId` must instead:
  - Accept a bot ID from the request (query param or session)
  - Verify the bot's `owner_user_id` matches the current user
  - Return data for that specific bot

### Bot Switching Logic
- Client layout loads ALL bots owned by user (`WHERE owner_user_id = current_user_id`)
- UI stores active bot ID in an **HTTP-only cookie** named `active_bot_id`
- Server reads cookie in layout + API routes to determine which bot is active
- Switching bots = setting cookie + router refresh
- All client API calls read the cookie server-side to scope queries
- Client pages (bookings, availability, conversations, settings) scoped to active bot
- Dashboard can show per-bot stats OR aggregate across all bots (use "View all bots overview")
- If cookie is missing or invalid, default to the first bot owned by user; if user has zero bots, redirect to `/client/create-bot`

---

## Page Designs (Approved)

### 1. Public Homepage (`app/page.tsx`)
- Sticky nav with logo + "Features / Pricing / Docs" + "Sign In / Get Started" buttons
- Hero: gradient-text headline "AI WhatsApp Bots for Every Business", subtitle, 2 CTAs, mockup preview
- Business types grid (7 types + "More coming" card)
- "How it works" — 3 step cards with numbered badges
- Pricing section — 3 cards (Starter / Pro / Business), Pro highlighted as "Most Popular"
- Footer

### 2. Admin Dashboard (`app/admin/dashboard/page.tsx`)
- Dark forest sidebar (260px) with logo + nav sections (Overview / Manage / Settings)
- User avatar at bottom
- Main area: Welcome header, search bar, "+ New Client" button
- 4 stat cards (Total Clients, Active Bots, Messages Today, Monthly Revenue) with green "↑" indicators
- Two-column layout: Recent Clients list (left, 2fr) + Live Activity feed (right, 1fr)

### 3. Create Bot Wizard (`app/client/create-bot/page.tsx`)
- **Step 1:** Progress bar + Grid of 8 business type cards (7 types + Custom), selected state has green border + checkmark
- **Step 2:** Same progress bar with step 1 marked done
  - Auto-fill card at top: dashed green border, "Paste Zomato/Swiggy link" input + "Extract" button
  - "or fill manually" divider
  - Form fields (Business Name, Owner, WhatsApp, City, Hours)
  - Language selector tags (clickable to toggle)
  - Live test chat preview at bottom (shows WhatsApp-style bubbles)
  - "Back" + "Create My Bot 🚀" buttons

### 4. Client Dashboard with Bot Switcher (`app/client/dashboard/page.tsx`)
- **Sidebar top:** User avatar + name + email (not business name)
- **Bot Switcher section:** "My Bots · 3 of 3"
  - Each bot: colored icon (by type) + bot name + live/paused dot + WhatsApp number
  - Active bot has green-tinted background + green border
  - "+ Add New Bot" dashed green button
- **Plan badge:** "Pro Plan" + progress bar + message usage
- **"Current Bot" nav section:** Dashboard / Conversations / Bookings / Availability / Calendar / Bot Settings (all scoped to active bot)
- **Account section:** Subscription / Notifications
- **Footer:** Theme toggle + help + settings + sign-out icons
- **Main area top:** Context banner showing currently selected bot with "Switch bot ⇅" button
- **Welcome:** "Namaste, {userName} 👋 · X bookings today across your bots"
- **Multi-bot summary note:** Green-tinted card with aggregate info + "View all bots overview" link
- **Bot Hero:** Gradient forest/green card with "{Bot Name} — LIVE" badge, messaging stats, WhatsApp number with Copy button
- **4 stat cards** (per selected bot): Bookings / Messages / Customers / Response Time
- **Two-column** below: Today's Schedule + Recent Conversations

### 5. Other Client Pages (scoped to active bot)
- **Bookings, Availability, Calendar, Conversations, Settings** — all read/write scoped to `?bot=<id>` query param
- Calendar already redesigned with visual month grid — keep that, just apply new palette
- Availability manager — keep weekly time-block editor, apply new palette

### 6. Subscription Page (`app/client/subscription/page.tsx`)
- Current plan card at top with usage stats
- 3 pricing cards with "Subscribe" / "Current plan" buttons
- Payment history table at bottom
- Razorpay checkout integration stays the same

---

## Implementation Scope

This spec covers:
1. **CSS / Theme tokens:** Update `globals.css` with Cream & Forest palette
2. **Data model:** Add `owner_user_id` column to clients sheet; update onboarding to set it; update auth helpers to fetch bots by owner
3. **Active bot selection:** Cookie or query param, URL middleware to inject active bot into API calls
4. **Redesign:** Homepage, Admin layout/dashboard, Client layout/dashboard (with bot switcher), Create Bot wizard
5. **Scoped pages:** Bookings, Availability, Calendar, Conversations, Settings, Subscription — update to use active bot
6. **Dark mode:** Keep existing toggle; update dark mode CSS variables to match new palette

### Out of Scope (keep existing)
- Razorpay integration logic (design unchanged)
- WhatsApp webhook handler (no UI)
- Gemini prompt generation (no UI)
- Google Sheets helper functions (small additions only)

---

## Verification Checklist

1. `npx next build` — zero errors
2. Homepage loads in both light and dark mode with Cream & Forest palette
3. Sign in as admin → admin dashboard renders with dark sidebar + cream main
4. Sign in as client (new account) → prompted to create first bot → wizard flow
5. Client with 2+ bots → sees bot switcher, can click between bots
6. All pages (Bookings / Availability / etc.) show data for active bot only
7. Theme toggle works on all pages
8. Razorpay subscription still works end-to-end
