// ─── Owner-side welcome-menu configuration ──────────────────────────────
//
// GET  → returns current config + a preview of the auto-generated menu so
//        the owner can see what customers will receive without opening
//        WhatsApp.
// PUT  → saves a partial patch. Only fields actually present in the
//        request body are updated; absent fields are untouched.
//
// Owner is identified via Clerk → resolveActiveBot. We never trust a
// client-supplied client_id.

import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import {
  loadConfig,
  saveConfig,
  buildAutoMenu,
  MAX_MENU_ITEMS,
  type MenuItem,
} from '@/lib/welcome-menu';

interface PutBody {
  is_enabled?: boolean;
  use_auto_generated?: boolean;
  header_text?: string;
  body_text?: string;
  footer_text?: string;
  items?: MenuItem[];
}

export async function GET() {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ error: 'No active bot' }, { status: 400 });

  const cfg = await loadConfig(bot.client_id);
  const autoPreview = await buildAutoMenu(bot);

  let savedItems: MenuItem[] = [];
  try {
    const parsed = JSON.parse(cfg.items_json);
    if (Array.isArray(parsed)) savedItems = parsed;
  } catch { /* tolerate */ }

  return NextResponse.json({
    is_enabled: cfg.is_enabled,
    use_auto_generated: cfg.use_auto_generated,
    header_text: cfg.header_text,
    body_text: cfg.body_text,
    footer_text: cfg.footer_text,
    items: savedItems,
    auto_preview: autoPreview,
    business_name: bot.business_name,
    vertical: bot.type,
    max_items: MAX_MENU_ITEMS,
  });
}

export async function PUT(req: NextRequest) {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ error: 'No active bot' }, { status: 400 });

  let body: PutBody;
  try {
    body = (await req.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (body.items !== undefined) {
    if (!Array.isArray(body.items)) {
      return NextResponse.json({ error: 'items must be an array' }, { status: 400 });
    }
    if (body.items.length > MAX_MENU_ITEMS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_MENU_ITEMS} items allowed (Meta list-message limit).` },
        { status: 400 }
      );
    }
    for (const it of body.items) {
      if (!it || typeof it !== 'object') {
        return NextResponse.json({ error: 'each item must be an object' }, { status: 400 });
      }
      if (typeof it.id !== 'string' || typeof it.label !== 'string') {
        return NextResponse.json({ error: 'each item needs string id and label' }, { status: 400 });
      }
    }
  }

  await saveConfig(bot.client_id, body);
  return NextResponse.json({ ok: true });
}
