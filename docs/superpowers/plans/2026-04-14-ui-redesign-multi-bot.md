# UI Redesign + Multi-Bot Architecture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the app with a premium Cream & Forest palette (Stripe/Linear-inspired Modern SaaS) and restructure the data model so one user can own and switch between multiple bots — each bot representing a separate business with its own WhatsApp number.

**Architecture:** Next.js 16 App Router with Clerk auth, Google Sheets as database, TailwindCSS v4 custom properties for theming. Active bot selection via HTTP-only cookie. Per-bot data scoping in all API routes and client pages. Dark/light theme toggle via `next-themes`.

**Tech Stack:** Next.js 16 + Turbopack · React 19 · TailwindCSS v4 · shadcn/ui · Clerk · next-themes · Google Sheets API · Razorpay · TypeScript

---

## File Structure

### New files
- `lib/active-bot.ts` — Cookie read/write helpers for active bot ID + resolution
- `lib/owner-clients.ts` — Helpers: `getBotsByOwner(userId)`, `getBotByIdForOwner(botId, userId)`
- `app/client/bots/page.tsx` — All bots overview page
- `components/client/bot-switcher.tsx` — Sidebar bot switcher client component
- `components/client/theme-styles.ts` — Shared WhatsApp-themed component class strings (to avoid duplication)

### Modified files (major redesigns)
- `app/globals.css` — New Cream & Forest tokens for light/dark
- `app/page.tsx` — Full homepage redesign (landing page)
- `app/admin/layout.tsx` — New sidebar design
- `app/admin/dashboard/page.tsx` — Stats + activity feed
- `app/client/layout.tsx` — Sidebar with bot switcher
- `app/client/dashboard/page.tsx` — Per-bot stats + bot hero + schedule/chats
- `app/client/create-bot/page.tsx` — 2-step wizard with progress bar
- `app/client/bookings/page.tsx` — Re-theme
- `app/client/availability/page.tsx` — Re-theme
- `app/client/calendar/page.tsx` — Re-theme (keep existing visual calendar)
- `app/client/conversations/page.tsx` — Re-theme
- `app/client/settings/page.tsx` — Re-theme
- `app/client/subscription/page.tsx` — Re-theme
- `lib/auth.ts` — Replace single `clientId` with user→bots lookup
- `lib/types.ts` — Add `owner_user_id` field to `ClientRow`
- `lib/google-sheets.ts` — Update `ClientRow` mapping to include `owner_user_id` column (column L)
- `app/api/onboard/route.ts` — Remove admin-only restriction, set owner from Clerk; also allow client role
- `app/api/client/*/route.ts` (6 files) — Resolve active bot instead of user.clientId

---

## Task 1: Add WhatsApp-themed color tokens to globals.css

**Files:**
- Modify: `app/globals.css` (color variables)

- [ ] **Step 1: Read current globals.css**

Read the file to confirm current structure.

- [ ] **Step 2: Replace `:root` and `.dark` CSS variables**

Replace the existing CSS variable blocks with Cream & Forest palette.

```css
/* Cream & Forest — Light Theme (default) */
:root {
  --background: #F3EDE3;
  --foreground: #1a2e1d;
  --card: #FFFFFF;
  --card-foreground: #1a2e1d;
  --popover: #FFFFFF;
  --popover-foreground: #1a2e1d;
  --primary: #1a5d47;
  --primary-foreground: #FAF7F2;
  --secondary: #FAF7F2;
  --secondary-foreground: #1a2e1d;
  --muted: #FAF7F2;
  --muted-foreground: #5a6b5d;
  --accent: #25D366;
  --accent-foreground: #1a2e1d;
  --destructive: #dc2626;
  --border: #e5dcc8;
  --input: #e5dcc8;
  --ring: #1a5d47;
  --chart-1: #25D366;
  --chart-2: #1a5d47;
  --chart-3: #86efac;
  --chart-4: #15803d;
  --chart-5: #5a6b5d;
  --radius: 0.625rem;
  --sidebar: #1a2e1d;
  --sidebar-foreground: #FAF7F2;
  --sidebar-primary: #25D366;
  --sidebar-primary-foreground: #1a2e1d;
  --sidebar-accent: rgba(250, 247, 242, 0.06);
  --sidebar-accent-foreground: #FAF7F2;
  --sidebar-border: rgba(250, 247, 242, 0.1);
  --sidebar-ring: #25D366;
}

/* Cream & Forest — Dark Theme */
.dark {
  --background: #0f1a12;
  --foreground: #E9EDEF;
  --card: #1a2e1d;
  --card-foreground: #E9EDEF;
  --popover: #1a2e1d;
  --popover-foreground: #E9EDEF;
  --primary: #25D366;
  --primary-foreground: #0f1a12;
  --secondary: #1a2e1d;
  --secondary-foreground: #E9EDEF;
  --muted: #1a2e1d;
  --muted-foreground: #8a9b8d;
  --accent: #25D366;
  --accent-foreground: #0f1a12;
  --destructive: #ef4444;
  --border: #2a3d2d;
  --input: #2a3d2d;
  --ring: #25D366;
  --chart-1: #25D366;
  --chart-2: #86efac;
  --chart-3: #1a5d47;
  --chart-4: #15803d;
  --chart-5: #5a6b5d;
  --sidebar: #0b1810;
  --sidebar-foreground: #FAF7F2;
  --sidebar-primary: #25D366;
  --sidebar-primary-foreground: #0f1a12;
  --sidebar-accent: rgba(250, 247, 242, 0.06);
  --sidebar-accent-foreground: #FAF7F2;
  --sidebar-border: rgba(250, 247, 242, 0.08);
  --sidebar-ring: #25D366;
}
```

- [ ] **Step 3: Verify build compiles**

Run: `cd whatsapp-bot-factory && npx next build`
Expected: zero errors, all routes compile.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat(theme): apply Cream & Forest palette to light and dark themes"
```

---

## Task 2: Add `owner_user_id` to data model

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/google-sheets.ts`

- [ ] **Step 1: Add `owner_user_id` to `ClientRow` interface**

In `lib/types.ts`, update `ClientRow`:

```typescript
export interface ClientRow {
  client_id: string;
  business_name: string;
  type: BusinessType;
  owner_name: string;
  whatsapp_number: string;
  phone_number_id: string;
  city: string;
  system_prompt: string;
  knowledge_base_json: string;
  status: 'active' | 'paused' | 'error';
  created_at: string;
  owner_user_id: string; // Clerk user ID
}
```

- [ ] **Step 2: Update Google Sheets helpers to read/write column L**

In `lib/google-sheets.ts`, change all `clients!A2:K` to `clients!A2:L`, and all `clients!A:K` to `clients!A:L`. Update the row-to-object mappings:

```typescript
// In getAllClients()
return rows.map((row) => ({
  client_id: row[0] || '',
  business_name: row[1] || '',
  type: (row[2] || '') as BusinessType,
  owner_name: row[3] || '',
  whatsapp_number: row[4] || '',
  phone_number_id: row[5] || '',
  city: row[6] || '',
  system_prompt: row[7] || '',
  knowledge_base_json: row[8] || '',
  status: (row[9] || 'active') as ClientRow['status'],
  created_at: row[10] || '',
  owner_user_id: row[11] || '',
}));

// In addClient(), add client.owner_user_id to the values array:
values: [[
  client.client_id,
  client.business_name,
  client.type,
  client.owner_name,
  client.whatsapp_number,
  client.phone_number_id,
  client.city,
  client.system_prompt,
  client.knowledge_base_json,
  client.status,
  client.created_at,
  client.owner_user_id,
]],
```

- [ ] **Step 3: Add `owner_user_id` header to sheet init**

In `initializeSheets()`, update the clients header row:

```typescript
await sheets.spreadsheets.values.update({
  spreadsheetId: SPREADSHEET_ID,
  range: 'clients!A1:L1',
  valueInputOption: 'RAW',
  requestBody: {
    values: [['client_id', 'business_name', 'type', 'owner_name', 'whatsapp_number', 'phone_number_id', 'city', 'system_prompt', 'knowledge_base_json', 'status', 'created_at', 'owner_user_id']],
  },
});
```

Also check in the `try` block at the top: change `clients!A1:K1` to `clients!A1:L1`.

- [ ] **Step 4: Manually add header to existing sheet**

Run this one-off node script inline (not committed):

```bash
cd whatsapp-bot-factory && node -e "
const { google } = require('googleapis');
const fs = require('fs');
const pk = JSON.parse(fs.readFileSync('C:/Users/OS 11/Downloads/botfactory-493215-32039cbf8bf1.json', 'utf8'));
const auth = new google.auth.GoogleAuth({ credentials: pk, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const sheets = google.sheets({ version: 'v4', auth });
sheets.spreadsheets.values.update({
  spreadsheetId: '1vRiigFod8XLvikRJgefOhxJZI_wIt29A99hqATGkx6Q',
  range: 'clients!L1',
  valueInputOption: 'RAW',
  requestBody: { values: [['owner_user_id']] }
}).then(() => console.log('Header added'));
"
```

Expected output: `Header added`

- [ ] **Step 5: Build and commit**

Run: `npx next build` (expect zero errors)

```bash
git add lib/types.ts lib/google-sheets.ts
git commit -m "feat(data): add owner_user_id column to clients table"
```

---

## Task 3: Create owner→bots lookup helpers

**Files:**
- Create: `lib/owner-clients.ts`

- [ ] **Step 1: Create the file**

```typescript
import { getAllClients } from './google-sheets';
import { ClientRow } from './types';

export async function getBotsByOwner(userId: string): Promise<ClientRow[]> {
  const all = await getAllClients();
  return all.filter((c) => c.owner_user_id === userId);
}

export async function getBotByIdForOwner(
  botId: string,
  userId: string
): Promise<ClientRow | null> {
  const all = await getAllClients();
  return all.find((c) => c.client_id === botId && c.owner_user_id === userId) || null;
}

export async function getFirstBotForOwner(userId: string): Promise<ClientRow | null> {
  const bots = await getBotsByOwner(userId);
  return bots[0] || null;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/owner-clients.ts
git commit -m "feat(data): add owner-scoped bot lookup helpers"
```

---

## Task 4: Active bot cookie + resolution helper

**Files:**
- Create: `lib/active-bot.ts`

- [ ] **Step 1: Create the file**

```typescript
import { cookies } from 'next/headers';
import { getBotByIdForOwner, getFirstBotForOwner } from './owner-clients';
import { ClientRow } from './types';

const COOKIE_NAME = 'active_bot_id';

export async function getActiveBotId(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value || null;
}

export async function setActiveBotId(botId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, botId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
}

export async function resolveActiveBot(userId: string): Promise<ClientRow | null> {
  const botId = await getActiveBotId();
  if (botId) {
    const bot = await getBotByIdForOwner(botId, userId);
    if (bot) return bot;
  }
  // Fallback to first bot
  return getFirstBotForOwner(userId);
}
```

- [ ] **Step 2: Build and commit**

Run: `npx next build`

```bash
git add lib/active-bot.ts
git commit -m "feat(auth): add active bot cookie helpers"
```

---

## Task 5: Update auth.ts to remove single clientId binding

**Files:**
- Modify: `lib/auth.ts`

- [ ] **Step 1: Replace auth.ts content**

```typescript
import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { resolveActiveBot } from './active-bot';
import { getBotsByOwner } from './owner-clients';
import { ClientRow } from './types';

export interface UserInfo {
  userId: string;
  role: 'admin' | 'client';
  email: string;
  name: string;
}

export interface ClientUserInfo extends UserInfo {
  role: 'client' | 'admin';
  activeBot: ClientRow | null;
  allBots: ClientRow[];
}

export async function getUserRole(): Promise<UserInfo | null> {
  const user = await currentUser();
  if (!user) return null;
  const meta = user.publicMetadata as Record<string, string>;
  const role = (meta.role as 'admin' | 'client') || 'client';
  return {
    userId: user.id,
    role,
    email: user.emailAddresses[0]?.emailAddress || '',
    name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
  };
}

export async function requireAdmin(): Promise<UserInfo> {
  const user = await getUserRole();
  if (!user || user.role !== 'admin') {
    redirect('/sign-in');
  }
  return user;
}

export async function requireClientWithBots(): Promise<ClientUserInfo> {
  const user = await getUserRole();
  if (!user) redirect('/sign-in');
  if (user.role !== 'client' && user.role !== 'admin') redirect('/sign-in');

  const allBots = await getBotsByOwner(user.userId);
  const activeBot = await resolveActiveBot(user.userId);
  return { ...user, activeBot, allBots };
}

// Legacy compatibility — returns just the user, used where bot scoping not needed
export async function requireClient(): Promise<UserInfo> {
  const user = await getUserRole();
  if (!user) redirect('/sign-in');
  if (user.role !== 'client' && user.role !== 'admin') redirect('/sign-in');
  return user;
}
```

- [ ] **Step 2: Build and commit**

Run: `npx next build`

```bash
git add lib/auth.ts
git commit -m "feat(auth): add multi-bot auth helpers (requireClientWithBots)"
```

---

## Task 6: Update onboard API to set owner_user_id

**Files:**
- Modify: `app/api/onboard/route.ts`

- [ ] **Step 1: Replace file content**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { addClient } from '@/lib/google-sheets';
import { generateSystemPrompt } from '@/lib/prompt-generator';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { ClientConfig, ClientRow } from '@/lib/types';
import { generateId, getISTTimestamp, formatPhoneNumber } from '@/lib/utils';
import { getUserRole } from '@/lib/auth';
import { setActiveBotId } from '@/lib/active-bot';

export async function POST(request: NextRequest) {
  const user = await getUserRole();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { config, phoneNumberId } = body as { config: ClientConfig; phoneNumberId: string };

    if (!config || !config.type || !config.businessName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const systemPrompt = generateSystemPrompt(config);
    const clientId = generateId();
    const client: ClientRow = {
      client_id: clientId,
      business_name: config.businessName,
      type: config.type,
      owner_name: config.ownerName,
      whatsapp_number: formatPhoneNumber(config.whatsappNumber),
      phone_number_id: phoneNumberId || '',
      city: config.city,
      system_prompt: systemPrompt,
      knowledge_base_json: JSON.stringify(config),
      status: 'active',
      created_at: getISTTimestamp(),
      owner_user_id: user.userId,
    };

    await addClient(client);

    // Set as active bot for the creator
    await setActiveBotId(clientId);

    if (phoneNumberId && config.whatsappNumber) {
      await sendWhatsAppMessage(
        phoneNumberId,
        formatPhoneNumber(config.whatsappNumber),
        `🎉 Your WhatsApp AI bot for ${config.businessName} is now active!`
      );
    }

    return NextResponse.json({ success: true, clientId });
  } catch (error) {
    console.error('Onboard error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

- [ ] **Step 2: Build and commit**

Run: `npx next build`

```bash
git add app/api/onboard/route.ts
git commit -m "feat(api): scope onboard to current user + set active bot cookie"
```

---

## Task 7: Update all /api/client/* routes to use active bot

**Files:**
- Modify: `app/api/client/stats/route.ts`
- Modify: `app/api/client/bookings/route.ts`
- Modify: `app/api/client/conversations/route.ts`
- Modify: `app/api/client/schedule/route.ts`
- Modify: `app/api/client/settings/route.ts`
- Modify: `app/api/client/date-overrides/route.ts`

- [ ] **Step 1: Update `app/api/client/bookings/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { getBookingsByClient } from '@/lib/booking';

export async function GET() {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ bookings: [] });

  try {
    const bookings = await getBookingsByClient(bot.client_id);
    return NextResponse.json({ bookings });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

- [ ] **Step 2: Update `app/api/client/conversations/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { getClientConversations } from '@/lib/google-sheets';

export async function GET() {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ conversations: {} });

  try {
    const messages = await getClientConversations(bot.client_id);
    const grouped: Record<string, typeof messages> = {};
    for (const msg of messages) {
      if (!grouped[msg.customer_phone]) grouped[msg.customer_phone] = [];
      grouped[msg.customer_phone].push(msg);
    }
    return NextResponse.json({ conversations: grouped });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

- [ ] **Step 3: Update `app/api/client/schedule/route.ts`**

Replace both GET and POST handlers to use `resolveActiveBot`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { getWeeklySchedule, setWeeklySchedule, calculateEndTime, WeeklySlot } from '@/lib/booking';

export async function GET() {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ schedule: {}, slotDuration: 30 });

  try {
    const slots = await getWeeklySchedule(bot.client_id);
    const schedule: Record<string, { enabled: boolean; blocks: Array<{ start: string; end: string }> }> = {};
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    for (const day of days) {
      const daySlots = slots.filter((s) => s.day_of_week === day);
      if (daySlots.length === 0) {
        schedule[day] = { enabled: false, blocks: [] };
      } else {
        const blocks: Array<{ start: string; end: string }> = [];
        let currentBlock = { start: daySlots[0].start_time, end: daySlots[0].end_time };
        for (let i = 1; i < daySlots.length; i++) {
          if (daySlots[i].start_time === currentBlock.end) {
            currentBlock.end = daySlots[i].end_time;
          } else {
            blocks.push(currentBlock);
            currentBlock = { start: daySlots[i].start_time, end: daySlots[i].end_time };
          }
        }
        blocks.push(currentBlock);
        schedule[day] = { enabled: true, blocks };
      }
    }

    const slotDuration = slots.length > 0 ? slots[0].slot_duration_minutes : 30;
    return NextResponse.json({ schedule, slotDuration });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ error: 'No bot selected' }, { status: 400 });

  try {
    const { schedule, slotDuration } = await request.json();
    const slots: WeeklySlot[] = [];

    for (const [day, daySchedule] of Object.entries(schedule as Record<string, { enabled: boolean; blocks: Array<{ start: string; end: string }> }>)) {
      if (!daySchedule.enabled) continue;
      for (const block of daySchedule.blocks) {
        let currentTime = block.start;
        while (currentTime < block.end) {
          const endTime = calculateEndTime(currentTime, slotDuration);
          if (endTime > block.end) break;
          slots.push({
            client_id: bot.client_id,
            day_of_week: day,
            start_time: currentTime,
            end_time: endTime,
            slot_duration_minutes: slotDuration,
            is_active: true,
            service_type: 'general',
          });
          currentTime = endTime;
        }
      }
    }

    await setWeeklySchedule(bot.client_id, slots);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

- [ ] **Step 4: Update `app/api/client/settings/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { updateClientField } from '@/lib/google-sheets';

export async function GET() {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ error: 'No bot selected' }, { status: 404 });

  return NextResponse.json({
    systemPrompt: bot.system_prompt,
    knowledgeBase: bot.knowledge_base_json,
  });
}

export async function POST(request: NextRequest) {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ error: 'No bot selected' }, { status: 400 });

  try {
    const { field, value } = await request.json();
    await updateClientField(bot.client_id, field, value);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

- [ ] **Step 5: Update `app/api/client/date-overrides/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { getDateOverrides, addDateOverride } from '@/lib/booking';

export async function GET() {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ overrides: [] });

  try {
    const overrides = await getDateOverrides(bot.client_id);
    return NextResponse.json({ overrides });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ error: 'No bot selected' }, { status: 400 });

  try {
    const { date, override_type, custom_start, custom_end, reason } = await request.json();
    await addDateOverride({
      client_id: bot.client_id,
      date,
      override_type: override_type || 'blocked',
      custom_start: custom_start || '',
      custom_end: custom_end || '',
      reason: reason || '',
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

- [ ] **Step 6: Update `app/api/client/stats/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { getBookingsByClient, getBookingsForDate, getTodayIST } from '@/lib/booking';
import { getClientAnalytics, getClientConversations } from '@/lib/google-sheets';

export async function GET() {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ stats: { totalBookings: 0, todayBookings: 0, totalMessages: 0, uniqueCustomers: 0 }, todayBookings: [] });

  try {
    const today = getTodayIST();
    const [allBookings, todayBookings, analytics, conversations] = await Promise.all([
      getBookingsByClient(bot.client_id, 'confirmed'),
      getBookingsForDate(bot.client_id, today),
      getClientAnalytics(bot.client_id),
      getClientConversations(bot.client_id),
    ]);

    const uniqueCustomers = new Set(conversations.map((c) => c.customer_phone)).size;
    const totalMessages = analytics.reduce((sum, a) => sum + a.total_messages, 0);

    return NextResponse.json({
      stats: {
        totalBookings: allBookings.length,
        todayBookings: todayBookings.filter((b) => b.status === 'confirmed').length,
        totalMessages,
        uniqueCustomers,
      },
      todayBookings: todayBookings.filter((b) => b.status === 'confirmed'),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

- [ ] **Step 7: Build and commit**

Run: `npx next build`

```bash
git add app/api/client/
git commit -m "feat(api): scope all client API routes to active bot"
```

---

## Task 8: Add bot switcher + switch endpoint

**Files:**
- Create: `app/api/client/switch-bot/route.ts`
- Create: `components/client/bot-switcher.tsx`

- [ ] **Step 1: Create switch-bot endpoint**

```typescript
// app/api/client/switch-bot/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { getBotByIdForOwner } from '@/lib/owner-clients';
import { setActiveBotId } from '@/lib/active-bot';

export async function POST(request: NextRequest) {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { botId } = await request.json();
  if (!botId) return NextResponse.json({ error: 'botId required' }, { status: 400 });

  const bot = await getBotByIdForOwner(botId, user.userId);
  if (!bot) return NextResponse.json({ error: 'Bot not found or not owned' }, { status: 404 });

  await setActiveBotId(botId);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Create bot switcher component**

```tsx
// components/client/bot-switcher.tsx
'use client';

import { useRouter } from 'next/navigation';
import { ClientRow, BusinessType } from '@/lib/types';

const TYPE_ICONS: Record<BusinessType, string> = {
  clinic: '🏥',
  restaurant: '🍽️',
  coaching: '📚',
  realestate: '🏠',
  salon: '💇',
  d2c: '🛍️',
  gym: '💪',
};

const TYPE_BG: Record<BusinessType, string> = {
  clinic: 'bg-blue-100',
  restaurant: 'bg-amber-100',
  coaching: 'bg-purple-100',
  realestate: 'bg-green-100',
  salon: 'bg-pink-100',
  d2c: 'bg-teal-100',
  gym: 'bg-red-100',
};

interface Props {
  bots: ClientRow[];
  activeBotId: string | null;
}

export function BotSwitcher({ bots, activeBotId }: Props) {
  const router = useRouter();

  const switchTo = async (botId: string) => {
    if (botId === activeBotId) return;
    await fetch('/api/client/switch-bot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botId }),
    });
    router.refresh();
  };

  return (
    <div className="px-2">
      <div className="flex items-center justify-between px-2 mb-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
        <span>My Bots</span>
        <span className="bg-primary/15 text-primary-foreground/90 px-1.5 py-0.5 rounded-md text-[9px]">{bots.length} of {bots.length}</span>
      </div>
      <div className="bg-sidebar-accent/40 border border-sidebar-border rounded-xl p-1 mb-2">
        {bots.map((bot) => {
          const active = bot.client_id === activeBotId;
          return (
            <button
              key={bot.client_id}
              onClick={() => switchTo(bot.client_id)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left ${
                active
                  ? 'bg-primary/12 border border-primary/25'
                  : 'hover:bg-sidebar-accent'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0 ${TYPE_BG[bot.type]}`}>
                {TYPE_ICONS[bot.type]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-sidebar-foreground truncate">{bot.business_name}</div>
                <div className="text-[10px] text-sidebar-foreground/50 flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${bot.status === 'active' ? 'bg-primary shadow-[0_0_6px_var(--primary)]' : 'bg-yellow-400'}`} />
                  {bot.whatsapp_number || 'No number yet'}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <a
        href="/client/create-bot"
        className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-dashed border-primary/30 text-primary text-xs font-semibold hover:bg-primary/5 transition-colors"
      >
        + Add New Bot
      </a>
    </div>
  );
}
```

- [ ] **Step 3: Build and commit**

Run: `npx next build`

```bash
git add app/api/client/switch-bot/ components/client/bot-switcher.tsx
git commit -m "feat(client): add bot switcher component and switch API"
```

---

## Task 9: Redesign client layout with bot switcher

**Files:**
- Modify: `app/client/layout.tsx`

- [ ] **Step 1: Replace client layout**

```tsx
import { requireClientWithBots } from '@/lib/auth';
import { UserButton } from '@clerk/nextjs';
import { BotSwitcher } from '@/components/client/bot-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { redirect } from 'next/navigation';

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const user = await requireClientWithBots();

  // New user with zero bots — redirect to create
  if (user.allBots.length === 0) {
    redirect('/client/create-bot');
  }

  const initials = (user.name || user.email)
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex h-screen">
      <aside className="w-[280px] bg-sidebar text-sidebar-foreground p-4 flex flex-col">
        {/* User at top */}
        <div className="flex items-center gap-2.5 px-2 pb-4 border-b border-sidebar-border mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold text-sm">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm truncate">{user.name || 'User'}</div>
            <div className="text-[11px] text-sidebar-foreground/50 truncate">{user.email}</div>
          </div>
        </div>

        {/* Bot Switcher */}
        <BotSwitcher bots={user.allBots} activeBotId={user.activeBot?.client_id || null} />

        {/* Plan badge (placeholder — wire to real plan data later) */}
        <div className="mx-2 mt-2 bg-primary/8 border border-primary/15 rounded-lg p-2 text-[11px]">
          <div className="flex justify-between text-sidebar-foreground">
            <span className="font-bold">Pro Plan</span>
            <a href="/client/subscription" className="text-primary font-semibold hover:underline">Upgrade</a>
          </div>
          <div className="h-[3px] bg-sidebar-foreground/10 rounded-full mt-1.5 overflow-hidden">
            <div className="h-full w-1/4 bg-gradient-to-r from-primary to-primary/70 rounded-full" />
          </div>
          <div className="text-[10px] text-sidebar-foreground/50 mt-1">Active</div>
        </div>

        {/* Nav */}
        <div className="mt-4 mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
          Current Bot
        </div>
        <nav className="space-y-0.5">
          <NavLink href="/client/dashboard" icon="📊" label="Dashboard" />
          <NavLink href="/client/conversations" icon="💬" label="Conversations" />
          <NavLink href="/client/bookings" icon="📅" label="Bookings" />
          <NavLink href="/client/availability" icon="⏰" label="Availability" />
          <NavLink href="/client/calendar" icon="📆" label="Calendar" />
          <NavLink href="/client/settings" icon="⚙️" label="Bot Settings" />
        </nav>

        <div className="mt-4 mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
          Account
        </div>
        <nav className="space-y-0.5">
          <NavLink href="/client/subscription" icon="💳" label="Subscription" />
          <NavLink href="/client/bots" icon="🤖" label="All Bots" />
        </nav>

        {/* Footer */}
        <div className="mt-auto pt-3 border-t border-sidebar-border flex gap-1.5 items-center">
          <ThemeToggle />
          <div className="ml-auto">
            <UserButton />
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-background">{children}</main>
    </div>
  );
}

function NavLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground text-[13px] transition-colors"
    >
      <span className="w-[18px] text-center text-sm">{icon}</span>
      {label}
    </a>
  );
}
```

- [ ] **Step 2: Build and commit**

Run: `npx next build`

```bash
git add app/client/layout.tsx
git commit -m "feat(client): redesign layout with bot switcher and forest sidebar"
```

---

## Task 10: Redesign client dashboard

**Files:**
- Modify: `app/client/dashboard/page.tsx`

- [ ] **Step 1: Replace dashboard page**

```tsx
import { requireClientWithBots } from '@/lib/auth';
import { ClientDashboard } from '@/components/client/dashboard-view';
import { BUSINESS_TYPES } from '@/lib/constants';

export default async function DashboardPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot) return null;

  const meta = BUSINESS_TYPES.find((bt) => bt.type === user.activeBot!.type);

  return (
    <ClientDashboard
      userName={user.name || 'there'}
      activeBot={user.activeBot}
      allBotsCount={user.allBots.length}
      icon={meta?.icon || '🤖'}
    />
  );
}
```

- [ ] **Step 2: Create the client dashboard view component**

```tsx
// components/client/dashboard-view.tsx
'use client';

import { useEffect, useState } from 'react';
import { ClientRow } from '@/lib/types';

interface Stats {
  totalBookings: number;
  todayBookings: number;
  totalMessages: number;
  uniqueCustomers: number;
}

interface BookingItem {
  customer_name: string;
  customer_phone: string;
  time_slot: string;
  end_time: string;
  service: string;
}

export function ClientDashboard({
  userName,
  activeBot,
  allBotsCount,
  icon,
}: {
  userName: string;
  activeBot: ClientRow;
  allBotsCount: number;
  icon: string;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [todayBookings, setTodayBookings] = useState<BookingItem[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/client/stats')
      .then((r) => r.json())
      .then((d) => {
        setStats(d.stats);
        setTodayBookings(d.todayBookings || []);
      });
  }, [activeBot.client_id]);

  const copyNumber = () => {
    navigator.clipboard.writeText(activeBot.whatsapp_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <div className="p-8">
      {/* Welcome */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">
            Namaste, {userName} 👋
          </h1>
          <div className="text-muted-foreground text-sm mt-1">
            {today} · {stats?.todayBookings ?? 0} bookings today
          </div>
        </div>
        <div className="flex gap-2.5">
          <button className="bg-card border border-border px-3.5 py-2.5 rounded-xl text-[13px] font-semibold flex items-center gap-1.5">
            🔗 Share Bot Link
          </button>
          <a
            href="/client/create-bot"
            className="bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-[13px] font-semibold flex items-center gap-1.5"
          >
            + New Bot
          </a>
        </div>
      </div>

      {/* Multi-bot note */}
      {allBotsCount > 1 && (
        <div className="bg-gradient-to-br from-accent/10 to-background border border-dashed border-accent/30 rounded-xl p-3.5 flex items-center gap-3 mb-5">
          <div className="text-2xl">✨</div>
          <div className="flex-1 text-xs text-foreground">
            <strong>Managing {allBotsCount} bots</strong> — currently viewing <strong>{activeBot.business_name}</strong>.
          </div>
          <a href="/client/bots" className="text-primary font-semibold text-xs hover:underline">View all bots →</a>
        </div>
      )}

      {/* Bot Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-sidebar to-primary rounded-2xl p-6 mb-5 text-sidebar-foreground grid grid-cols-[1fr_auto] gap-5 items-center">
        <div className="absolute text-[180px] -right-8 -top-5 opacity-[0.08] select-none pointer-events-none">{icon}</div>
        <div className="relative">
          <div className="text-[11px] uppercase tracking-wider text-accent mb-2 font-semibold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-accent rounded-full shadow-[0_0_8px_var(--accent)]" />
            {icon} {activeBot.business_name.toUpperCase()} — LIVE
          </div>
          <h2 className="text-[22px] font-bold mb-1">Customers can chat 24/7</h2>
          <p className="text-sidebar-foreground/70 text-[13px]">
            Your AI has handled {stats?.totalMessages ?? 0} messages total.
          </p>
        </div>
        <div className="bg-sidebar-foreground/10 px-[18px] py-3.5 rounded-xl font-mono text-sm flex items-center gap-2.5 relative">
          <span>📱</span>
          <span>{activeBot.whatsapp_number || 'Pending setup'}</span>
          <button onClick={copyNumber} className="text-accent text-xs font-semibold ml-1">
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3.5 mb-5">
        <StatCard label="Today's Bookings" value={stats?.todayBookings ?? 0} icon="📅" />
        <StatCard label="Total Messages" value={stats?.totalMessages ?? 0} icon="💬" />
        <StatCard label="Unique Customers" value={stats?.uniqueCustomers ?? 0} icon="👥" />
        <StatCard label="Avg Response" value="2.1s" icon="⚡" subtitle="Instant replies" />
      </div>

      {/* Two col */}
      <div className="grid grid-cols-[1.4fr_1fr] gap-4">
        <Panel title="Today's Schedule" link="/client/calendar" linkText="View calendar →">
          {todayBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bookings today</p>
          ) : (
            <div className="space-y-2">
              {todayBookings.map((b, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <div className="text-[12px] font-bold text-primary w-14">{b.time_slot}</div>
                  <div className="flex-1 text-[13px]">
                    <div className="font-semibold">{b.customer_name}</div>
                    <div className="text-[11px] text-muted-foreground">{b.service || 'General'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Recent Conversations" link="/client/conversations" linkText="View all →">
          <p className="text-sm text-muted-foreground">Click "View all" to see all conversations.</p>
        </Panel>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, subtitle }: { label: string; value: string | number; icon: string; subtitle?: string }) {
  return (
    <div className="relative bg-card border border-border rounded-2xl p-[18px]">
      <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-2.5">{label}</div>
      <div className="text-[28px] font-bold tracking-tight text-foreground">{value}</div>
      {subtitle && <div className="text-[11px] font-semibold text-primary mt-1">{subtitle}</div>}
      <div className="absolute top-[18px] right-[18px] w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-sm">{icon}</div>
    </div>
  );
}

function Panel({ title, link, linkText, children }: { title: string; link?: string; linkText?: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[15px] font-bold text-foreground">{title}</div>
        {link && linkText && (
          <a href={link} className="text-xs text-primary font-semibold hover:underline">{linkText}</a>
        )}
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Build and commit**

Run: `npx next build`

```bash
git add app/client/dashboard/page.tsx components/client/dashboard-view.tsx
git commit -m "feat(client): redesign dashboard with bot hero, stats, multi-bot context"
```

---

## Task 11: Add "All Bots" overview page

**Files:**
- Create: `app/client/bots/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { requireClientWithBots } from '@/lib/auth';
import { BUSINESS_TYPES } from '@/lib/constants';

export default async function AllBotsPage() {
  const user = await requireClientWithBots();

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">All My Bots</h1>
          <p className="text-muted-foreground text-sm mt-1">{user.allBots.length} bot{user.allBots.length !== 1 ? 's' : ''}</p>
        </div>
        <a href="/client/create-bot" className="bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-[13px] font-semibold">
          + Create New Bot
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {user.allBots.map((bot) => {
          const meta = BUSINESS_TYPES.find((bt) => bt.type === bot.type);
          return (
            <div key={bot.client_id} className="bg-card border border-border rounded-2xl p-5 hover:border-primary/40 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center text-xl">
                    {meta?.icon || '🤖'}
                  </div>
                  <div>
                    <div className="font-bold text-[15px]">{bot.business_name}</div>
                    <div className="text-[12px] text-muted-foreground">{meta?.label}</div>
                  </div>
                </div>
                <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                  bot.status === 'active' ? 'bg-primary/15 text-primary' : 'bg-yellow-500/15 text-yellow-600'
                }`}>
                  {bot.status}
                </span>
              </div>
              <div className="text-[12px] text-muted-foreground mb-3">
                {bot.whatsapp_number || 'No number yet'}
              </div>
              <div className="text-[11px] text-muted-foreground">{bot.city} · Created {bot.created_at}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build and commit**

Run: `npx next build`

```bash
git add app/client/bots/
git commit -m "feat(client): add all bots overview page"
```

---

## Task 12: Redesign create-bot wizard

**Files:**
- Modify: `app/client/create-bot/page.tsx`

- [ ] **Step 1: Replace with wizard design**

Keep the existing form logic, but refactor visual structure to match the approved mockup. Full replacement:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CommonFieldsForm } from '@/components/forms/common-fields';
import { TypeFieldsForm } from '@/components/forms/type-fields';
import { BUSINESS_TYPES } from '@/lib/constants';
import { BusinessType } from '@/lib/types';
import { toast } from 'sonner';

export default function CreateBotPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<BusinessType | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({ languages: ['Hindi', 'English', 'Hinglish'] });
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onChange = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const selectType = (t: BusinessType) => {
    setSelectedType(t);
    setFormData((prev) => ({ ...prev, type: t }));
  };

  const goToStep2 = () => {
    if (!selectedType) { toast.error('Please select a business type'); return; }
    setStep(2);
  };

  const handleAutoFill = async () => {
    if (!websiteUrl.trim()) { toast.error('Enter a URL'); return; }
    setScraping(true);
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: websiteUrl, businessType: selectedType }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setFormData((prev) => {
          const merged: Record<string, unknown> = { ...prev };
          for (const [key, value] of Object.entries(data.data)) {
            if (value && (!(key in prev) || prev[key] === '' || prev[key] === undefined)) merged[key] = value;
          }
          merged.type = selectedType;
          return merged;
        });
        toast.success('Data extracted! Review below.');
      } else {
        toast.error(data.error || 'Could not extract');
      }
    } catch {
      toast.error('Failed to fetch');
    } finally {
      setScraping(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.businessName || !formData.ownerName || !formData.whatsappNumber) {
      toast.error('Fill Business Name, Owner Name, and WhatsApp Number');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: formData, phoneNumberId: '' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Bot created!');
        router.push('/client/dashboard');
      } else {
        toast.error(data.error || 'Failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <StepCircle num={1} state={step > 1 ? 'done' : 'active'} />
          <div className={`flex-1 h-0.5 ${step > 1 ? 'bg-accent' : 'bg-border'}`} />
          <StepCircle num={2} state={step === 2 ? 'active' : 'pending'} />
          <div className="flex-1 h-0.5 bg-border" />
          <StepCircle num={3} state="pending" />
        </div>
        <div className="flex justify-between px-[14px] text-[11px] text-muted-foreground">
          <span>Type</span>
          <span>Details</span>
          <span>Go Live</span>
        </div>
      </div>

      {step === 1 && (
        <>
          <h1 className="text-[26px] font-bold tracking-tight mb-1.5">What kind of business?</h1>
          <p className="text-sm text-muted-foreground mb-6">We'll tailor the bot's personality to match.</p>

          <div className="grid grid-cols-2 gap-2.5 mb-6">
            {BUSINESS_TYPES.map((bt) => {
              const active = selectedType === bt.type;
              return (
                <button
                  key={bt.type}
                  type="button"
                  onClick={() => selectType(bt.type)}
                  className={`text-left rounded-xl p-3.5 border-2 transition-all ${
                    active
                      ? 'border-primary bg-gradient-to-br from-accent/10 to-secondary'
                      : 'border-border bg-secondary hover:border-primary/60 hover:-translate-y-0.5'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-lg">
                      {bt.icon}
                    </div>
                    {active && <span className="text-accent font-bold">✓</span>}
                  </div>
                  <div className="font-semibold text-sm">{bt.label}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{bt.description}</div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end">
            <Button onClick={goToStep2} className="bg-primary text-primary-foreground">
              Continue →
            </Button>
          </div>
        </>
      )}

      {step === 2 && selectedType && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h1 className="text-[26px] font-bold tracking-tight mb-1.5">
              Tell us about {BUSINESS_TYPES.find((bt) => bt.type === selectedType)?.icon}{' '}
              {BUSINESS_TYPES.find((bt) => bt.type === selectedType)?.label}
            </h1>
            <p className="text-sm text-muted-foreground">The AI learns from this to answer customers.</p>
          </div>

          {/* Auto-fill */}
          <div className="relative overflow-hidden rounded-xl border border-dashed border-accent/50 bg-gradient-to-br from-accent/10 to-background p-5">
            <div className="text-sm font-bold flex items-center gap-1.5 mb-1">✨ Auto-fill with AI</div>
            <p className="text-xs text-muted-foreground mb-3">Paste your Zomato/Swiggy/Instagram link — we'll extract everything</p>
            <div className="flex gap-2">
              <Input
                placeholder="https://zomato.com/your-restaurant"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
              />
              <Button type="button" onClick={handleAutoFill} disabled={scraping} className="bg-primary">
                {scraping ? 'Extracting...' : '🔍 Extract'}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] text-muted-foreground uppercase tracking-widest">or fill manually</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Card>
            <CardContent className="pt-6">
              <CommonFieldsForm data={formData} onChange={onChange} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <TypeFieldsForm type={selectedType} data={formData} onChange={onChange} />
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>← Back</Button>
            <Button type="submit" disabled={submitting} className="bg-primary text-primary-foreground">
              {submitting ? 'Creating...' : 'Create My Bot 🚀'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function StepCircle({ num, state }: { num: number; state: 'active' | 'done' | 'pending' }) {
  return (
    <div
      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
        state === 'active'
          ? 'bg-primary text-primary-foreground'
          : state === 'done'
          ? 'bg-accent text-accent-foreground'
          : 'bg-secondary text-muted-foreground'
      }`}
    >
      {state === 'done' ? '✓' : num}
    </div>
  );
}
```

- [ ] **Step 2: Build and commit**

Run: `npx next build`

```bash
git add app/client/create-bot/page.tsx
git commit -m "feat(client): redesign create-bot wizard with progress bar"
```

---

## Task 13: Redesign admin layout + dashboard

**Files:**
- Modify: `app/admin/layout.tsx`
- Modify: `app/admin/dashboard/page.tsx`

- [ ] **Step 1: Replace admin layout**

```tsx
import { requireAdmin } from '@/lib/auth';
import { UserButton } from '@clerk/nextjs';
import { ThemeToggle } from '@/components/theme-toggle';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const initials = (admin.name || admin.email).split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="flex h-screen">
      <aside className="w-[260px] bg-sidebar text-sidebar-foreground p-4 flex flex-col">
        <div className="flex items-center gap-2.5 px-2 pb-5 border-b border-sidebar-border mb-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center text-base">🤖</div>
          <div>
            <div className="font-bold text-base">BotFactory</div>
            <div className="text-[11px] text-sidebar-foreground/50">Admin Workspace</div>
          </div>
        </div>

        <div className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">Overview</div>
        <AdminLink href="/admin/dashboard" icon="📊" label="Dashboard" />
        <AdminLink href="/admin/revenue" icon="💰" label="Revenue" />
        <AdminLink href="/admin/analytics" icon="📈" label="Analytics" />

        <div className="px-2 mt-4 mb-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">Manage</div>
        <AdminLink href="/admin/onboard" icon="➕" label="Onboard Client" />
        <AdminLink href="/admin/clients" icon="👥" label="All Clients" />

        <div className="mt-auto pt-3 border-t border-sidebar-border flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold text-xs">{initials}</div>
          <div className="flex-1">
            <div className="text-[13px] font-semibold">{admin.name || 'Admin'}</div>
            <div className="text-[11px] text-sidebar-foreground/50">Admin</div>
          </div>
          <ThemeToggle />
          <UserButton />
        </div>
      </aside>
      <main className="flex-1 overflow-auto bg-background">{children}</main>
    </div>
  );
}

function AdminLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground text-sm transition-colors"
    >
      <span className="w-[18px] text-center">{icon}</span>
      {label}
    </a>
  );
}
```

- [ ] **Step 2: Update admin dashboard to match design**

Keep existing fetch logic but update the visual structure to match the approved mockup — stats cards with cream/green accents, client cards with new palette. The existing file already works; only ensure it uses the new CSS tokens (bg-card, border-border, text-foreground, etc.) instead of hardcoded colors.

Review `app/admin/dashboard/page.tsx` and replace any hardcoded colors (e.g., `bg-[#25D366]`) with theme tokens (`bg-primary`, `text-primary-foreground`). This is a find-replace task:

- `bg-[#25D366]` → `bg-primary`
- `text-white` on primary buttons → `text-primary-foreground`
- `text-[#25D366]` → `text-primary`
- `border-[#25D366]/50` → `border-primary/50`

- [ ] **Step 3: Build and commit**

Run: `npx next build`

```bash
git add app/admin/
git commit -m "feat(admin): redesign admin layout with Cream & Forest theme"
```

---

## Task 14: Redesign public homepage

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace homepage**

The full homepage code is the one built earlier but using theme tokens. Replace hardcoded colors with theme tokens:

- Background: use `bg-background`
- Cards: `bg-card border-border`
- Primary: `bg-primary text-primary-foreground`
- Accent/WhatsApp green: `bg-accent text-accent-foreground`

Keep existing structure: Hero, Business Types grid, How It Works, Pricing, Footer. Update all hardcoded `#25D366`, `#111B21`, etc., to use theme CSS variables via Tailwind tokens.

Pattern: Replace any `style={{ background: '#25D366' }}` with `className="bg-primary"`. Replace `style={{ color: '#25D366' }}` with `className="text-primary"`. Replace `bg-[#111B21]` with `bg-background`.

- [ ] **Step 2: Build and commit**

Run: `npx next build`

```bash
git add app/page.tsx
git commit -m "feat(home): apply Cream & Forest theme tokens to homepage"
```

---

## Task 15: Re-theme remaining client pages

**Files:**
- Modify: `app/client/bookings/page.tsx`
- Modify: `app/client/availability/page.tsx`
- Modify: `app/client/calendar/page.tsx`
- Modify: `app/client/conversations/page.tsx`
- Modify: `app/client/settings/page.tsx`
- Modify: `app/client/subscription/page.tsx`

- [ ] **Step 1: Replace hardcoded colors with theme tokens**

In each file, use find-replace to convert:

| Hardcoded | Theme token |
|-----------|-------------|
| `bg-[#25D366]` | `bg-primary` |
| `text-[#25D366]` | `text-primary` |
| `border-[#25D366]/30` | `border-primary/30` |
| `bg-[#25D366]/10` | `bg-primary/10` |
| `text-[#25D366]/` → keep opacity | `text-primary/` |
| `hover:bg-[#1da851]` | `hover:bg-primary/90` |
| `text-white` (on primary bg) | `text-primary-foreground` |

- [ ] **Step 2: Build and commit**

Run: `npx next build`

```bash
git add app/client/
git commit -m "feat(client): migrate hardcoded colors to theme tokens"
```

---

## Task 16: End-to-end verification

**Files:** None (verification only)

- [ ] **Step 1: Start dev server**

```bash
cd whatsapp-bot-factory && npm run dev
```

- [ ] **Step 2: Verify homepage**

Open `http://localhost:3000` in browser. Check:
- Cream background, NOT black
- Green/forest accents, not generic gray
- Gradient headline
- Pricing cards render

- [ ] **Step 3: Verify admin dashboard**

Sign in as admin (role=admin in Clerk publicMetadata). Go to `/admin/dashboard`. Verify:
- Dark forest sidebar
- Cream main area
- Client cards link to `/admin/clients/<id>`

- [ ] **Step 4: Verify client flow — new user**

Sign in as new user (no bots yet). Verify:
- Redirects to `/client/create-bot`
- Step 1 shows 7 business types
- Step 2 shows form + auto-fill

- [ ] **Step 5: Verify client flow — create bot**

Create a bot. Verify:
- Redirects to `/client/dashboard`
- Bot switcher in sidebar shows the new bot
- Bot Hero displays in main area
- Active bot cookie is set

- [ ] **Step 6: Verify multi-bot switching**

Create a second bot. Verify:
- Both bots appear in sidebar switcher
- Clicking switches active bot
- Dashboard data changes to match
- All pages (Bookings, Availability, Calendar, Conversations, Settings) show data for active bot only

- [ ] **Step 7: Verify theme toggle**

Click moon/sun icon in sidebar. Verify:
- Page switches between light cream and dark forest
- All components render correctly in both modes

- [ ] **Step 8: Final commit**

If any fixes were needed during verification:

```bash
git add -A
git commit -m "fix: polish after e2e verification"
```
