import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import {
  getCategories,
  upsertCategory,
  deleteCategory,
} from '@/lib/db/inventory-categories';

// ─── GET — list this bot's inventory categories ─────────────────────────

export async function GET(_req: NextRequest) {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ error: 'No active bot' }, { status: 404 });

  const categories = await getCategories(bot.client_id);
  return NextResponse.json({ categories });
}

// ─── POST — create or update a category ─────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ error: 'No active bot' }, { status: 404 });

  let body: { name?: unknown; tracks_stock?: unknown; display_order?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (name.length > 100) {
    return NextResponse.json({ error: 'name must be 100 characters or fewer' }, { status: 400 });
  }

  const tracksStock = typeof body.tracks_stock === 'boolean' ? body.tracks_stock : undefined;
  const order = typeof body.display_order === 'number' ? body.display_order : undefined;

  const category = await upsertCategory({
    client_id: bot.client_id,
    name,
    tracks_stock: tracksStock,
    display_order: order,
  });

  return NextResponse.json({ category });
}

// ─── DELETE — remove a category by name ─────────────────────────────────
//
// Items still tagged with this category aren't touched — they keep the
// category string in their row. The inventory page will surface them
// under "Other / uncategorised" until the owner re-tags them. We chose
// not to bulk-update items because owner intent on delete is ambiguous
// (could be "drop the label" or "delete everything in it") — surfacing
// orphans is the safer default.

export async function DELETE(req: NextRequest) {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ error: 'No active bot' }, { status: 404 });

  let body: { name?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const removed = await deleteCategory(bot.client_id, name);
  return NextResponse.json({ success: removed });
}
