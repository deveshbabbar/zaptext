// Welcome menu builder + per-client config.
//
// When a customer sends their first message to a bot in a 7-day window,
// the bot replies with an interactive list message: a greeting, a body
// prompt, and up to 10 tappable options. The customer's tap becomes their
// effective intent and the AI takes over from there.
//
// Two modes per client (see lib/db/schema.ts welcome_menus table):
//   - use_auto_generated=true   build the menu live from real data:
//                               services from inventory, trainers from
//                               staff, plus per-vertical defaults.
//   - use_auto_generated=false  honour the items the owner saved via
//                               /client/welcome-menu verbatim.
//
// Menu items have an `id` (used internally to route AI context) and a
// `label` (what the customer sees). Tapping an item sends the LABEL back
// to our webhook as if the customer had typed it; the webhook also gets
// the id via interactive.list_reply.id and uses it to inject intent
// context into the AI's system prompt.

import { db } from '@/lib/db';
import { welcome_menus } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getActiveStaff } from '@/lib/staff';
import { getActiveInventory } from '@/lib/inventory';
import type { ClientRow } from '@/lib/types';

// Hard cap from Meta — list messages allow at most 10 rows total across
// all sections. We use a single section for simplicity.
export const MAX_MENU_ITEMS = 10;

export interface MenuItem {
  id: string;          // routing id e.g. 'talk_to_trainer'
  label: string;       // <= 24 chars, shown as the row title
  description?: string;// <= 72 chars, shown as the row subtitle
}

export interface WelcomeMenu {
  header: string;      // <= 60 chars
  body: string;        // <= 1024 chars
  footer: string;      // <= 60 chars
  buttonText: string;  // <= 20 chars, label on the "open menu" button
  items: MenuItem[];
}

// Per-vertical defaults — these are added on top of any auto-discovered
// items (staff/inventory). Order matters: most-likely intents first.
const VERTICAL_DEFAULTS: Record<string, MenuItem[]> = {
  gym: [
    { id: 'book_class', label: 'Book a class', description: 'Reserve a slot' },
    { id: 'membership', label: 'Membership plans', description: 'Pricing & duration' },
    { id: 'timings', label: 'Timings & schedule', description: 'See open hours' },
    { id: 'diet', label: 'Diet consultation', description: 'Talk about nutrition' },
    { id: 'human', label: 'Speak to manager', description: 'Talk to a real person' },
  ],
  salon: [
    { id: 'book_appt', label: 'Book appointment', description: 'Pick a time slot' },
    { id: 'services', label: 'Services & pricing', description: 'See the menu' },
    { id: 'stylists', label: 'Our stylists', description: 'Meet the team' },
    { id: 'offers', label: 'Current offers', description: 'See what is on' },
    { id: 'human', label: 'Speak to receptionist', description: 'Talk to a real person' },
  ],
  realestate: [
    { id: 'listings', label: 'Browse listings', description: 'See available properties' },
    { id: 'site_visit', label: 'Schedule a visit', description: 'Pick a date' },
    { id: 'pricing', label: 'Pricing & EMI', description: 'Get budget info' },
    { id: 'human', label: 'Talk to an agent', description: 'Speak to a real person' },
  ],
  d2c: [
    { id: 'shop', label: 'Browse products', description: 'See what we sell' },
    { id: 'order_status', label: 'Track an order', description: 'Find your delivery' },
    { id: 'returns', label: 'Returns & refunds', description: 'Start a return' },
    { id: 'human', label: 'Customer support', description: 'Talk to a real person' },
  ],
  coaching: [
    { id: 'book_demo', label: 'Book a free demo', description: 'Try a class' },
    { id: 'courses', label: 'Course catalog', description: 'See what we teach' },
    { id: 'fees', label: 'Fees & schedule', description: 'See pricing & timings' },
    { id: 'faculty', label: 'Meet the faculty', description: 'Our teachers' },
    { id: 'human', label: 'Talk to admissions', description: 'Speak to a real person' },
  ],
  restaurant: [
    { id: 'menu', label: 'See the menu', description: 'Browse food options' },
    { id: 'order', label: 'Place an order', description: 'Order for delivery' },
    { id: 'reservation', label: 'Book a table', description: 'Reserve for dine-in' },
    { id: 'specials', label: "Today's specials", description: "What's fresh today" },
    { id: 'human', label: 'Speak to manager', description: 'Talk to a real person' },
  ],
};

// ─── public entrypoint ───────────────────────────────────────────────────

// Returns the menu to send when this customer messages for the first time
// (in the 7-day window). When the menu is disabled, returns null and the
// caller falls back to ordinary AI reply behaviour.
export async function getWelcomeMenu(client: ClientRow): Promise<WelcomeMenu | null> {
  const cfg = await loadConfig(client.client_id);
  if (!cfg.is_enabled) return null;

  const header = cfg.header_text || defaultHeader(client);
  const body = cfg.body_text || 'What can I help you with today?';
  const footer = cfg.footer_text || '';
  const buttonText = 'Choose an option';

  let items: MenuItem[] = [];

  if (cfg.use_auto_generated) {
    items = await buildAutoMenu(client);
  } else {
    items = parseItemsJson(cfg.items_json);
    // If owner enabled override but never saved any items, fall back to
    // auto so the menu doesn't ghost as empty.
    if (items.length === 0) items = await buildAutoMenu(client);
  }

  // Meta caps at 10 rows; trim defensively. Truncate fields too.
  items = items.slice(0, MAX_MENU_ITEMS).map((i) => ({
    id: i.id.slice(0, 200),
    label: i.label.slice(0, 24),
    description: i.description?.slice(0, 72),
  }));

  if (items.length === 0) return null;

  return {
    header: header.slice(0, 60),
    body: body.slice(0, 1024),
    footer: footer.slice(0, 60),
    buttonText,
    items,
  };
}

// Loads (or lazily synthesizes) the per-client config row. New clients
// default to auto-generated mode with empty header/body so the helpers
// above produce sensible defaults using the client's business name.
export async function loadConfig(clientId: string) {
  const rows = await db
    .select()
    .from(welcome_menus)
    .where(eq(welcome_menus.client_id, clientId))
    .limit(1);
  if (rows.length > 0) return rows[0];
  return {
    client_id: clientId,
    is_enabled: true,
    use_auto_generated: true,
    header_text: '',
    body_text: '',
    footer_text: '',
    items_json: '[]',
    created_at: new Date(),
    updated_at: new Date(),
  };
}

export async function saveConfig(
  clientId: string,
  patch: Partial<{
    is_enabled: boolean;
    use_auto_generated: boolean;
    header_text: string;
    body_text: string;
    footer_text: string;
    items: MenuItem[];
  }>
) {
  const existing = await db
    .select()
    .from(welcome_menus)
    .where(eq(welcome_menus.client_id, clientId))
    .limit(1);

  const items_json =
    patch.items !== undefined ? JSON.stringify(patch.items) : undefined;

  const fields: Record<string, unknown> = {
    updated_at: new Date(),
  };
  if (patch.is_enabled !== undefined) fields.is_enabled = patch.is_enabled;
  if (patch.use_auto_generated !== undefined) fields.use_auto_generated = patch.use_auto_generated;
  if (patch.header_text !== undefined) fields.header_text = patch.header_text.slice(0, 60);
  if (patch.body_text !== undefined) fields.body_text = patch.body_text.slice(0, 1024);
  if (patch.footer_text !== undefined) fields.footer_text = patch.footer_text.slice(0, 60);
  if (items_json !== undefined) fields.items_json = items_json;

  if (existing.length === 0) {
    await db.insert(welcome_menus).values({
      client_id: clientId,
      ...fields,
    });
  } else {
    await db.update(welcome_menus).set(fields).where(eq(welcome_menus.client_id, clientId));
  }
}

// ─── auto-generation ─────────────────────────────────────────────────────

// Builds a menu using the client's actual data plus vertical defaults.
// Strategy:
//   1. Surface "talk to staff" if active staff exist.
//   2. Surface "services" if active inventory exists.
//   3. Layer in the per-vertical default items.
// We dedupe by id so a manual override later doesn't get clashing rows.
export async function buildAutoMenu(client: ClientRow): Promise<MenuItem[]> {
  const vertical = (client.type || '').toLowerCase();
  const defaults = VERTICAL_DEFAULTS[vertical] || VERTICAL_DEFAULTS.salon;

  const out: MenuItem[] = [];
  const seen = new Set<string>();
  const push = (item: MenuItem) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    out.push(item);
  };

  // Pull live data — but be tolerant of missing tables / errors. The menu
  // should NEVER break the bot just because inventory is empty.
  let staff: Awaited<ReturnType<typeof getActiveStaff>> = [];
  let inventory: Awaited<ReturnType<typeof getActiveInventory>> = [];
  try {
    staff = await getActiveStaff(client.client_id);
  } catch { /* tolerate */ }
  try {
    inventory = await getActiveInventory(client.client_id);
  } catch { /* tolerate */ }

  // Surface a "talk to <role>" if at least one staff is active. We don't
  // list every staff member here — the customer picks the category, and
  // the AI walks them through choosing a specific person in chat.
  //
  // IMPORTANT: descriptions are static. The auto-menu is sent once at
  // first contact and stays in the customer's WhatsApp chat for days.
  // Embedding the live count (e.g. "3 available") goes stale the moment
  // staff or inventory changes; the customer would still see "3
  // available" after we removed everyone. Generic copy stays accurate.
  if (staff && staff.length > 0) {
    const roleLabel = staffRoleLabel(vertical);
    push({
      id: 'talk_to_staff',
      label: `Talk to a ${roleLabel}`,
      description: 'Book or ask a question',
    });
  }

  // Surface a "services" entry if inventory exists.
  if (inventory && inventory.length > 0) {
    push({
      id: 'services',
      label: servicesLabel(vertical),
      description: 'See what we offer',
    });
  }

  // Layer in vertical defaults, deduped against what we just added.
  for (const d of defaults) push(d);

  return out.slice(0, MAX_MENU_ITEMS);
}

function defaultHeader(client: ClientRow): string {
  const name = (client.business_name || 'our business').slice(0, 50);
  return `Welcome to ${name}!`;
}

function staffRoleLabel(vertical: string): string {
  switch (vertical) {
    case 'gym': return 'trainer';
    case 'salon': return 'stylist';
    case 'realestate': return 'agent';
    case 'coaching': return 'teacher';
    case 'restaurant': return 'host';
    default: return 'team member';
  }
}

function servicesLabel(vertical: string): string {
  switch (vertical) {
    case 'gym': return 'Classes & plans';
    case 'salon': return 'Services';
    case 'realestate': return 'Browse listings';
    case 'coaching': return 'Course catalog';
    case 'restaurant': return 'See the menu';
    case 'd2c': return 'Browse products';
    default: return 'Services';
  }
}

function parseItemsJson(json: string): MenuItem[] {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is MenuItem =>
        typeof x === 'object' && x !== null &&
        typeof (x as Record<string, unknown>).id === 'string' &&
        typeof (x as Record<string, unknown>).label === 'string'
    );
  } catch {
    return [];
  }
}

// Look up the human-readable label of a tapped menu item id, so the
// webhook can echo it back into conversation history when the inbound
// message is just an interactive.list_reply.id we sent earlier.
export async function lookupMenuItemLabel(client: ClientRow, id: string): Promise<string | null> {
  const menu = await getWelcomeMenu(client);
  if (!menu) return null;
  return menu.items.find((i) => i.id === id)?.label || null;
}
