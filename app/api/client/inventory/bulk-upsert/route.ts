import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { upsertItem } from '@/lib/inventory';

const MAX_ITEMS = 500;

export async function POST(req: NextRequest) {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ error: 'No bot selected' }, { status: 400 });

  let body: { items?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) {
    return NextResponse.json({ error: 'No items to import.' }, { status: 400 });
  }
  if (rawItems.length > MAX_ITEMS) {
    return NextResponse.json(
      { error: `Too many items (${rawItems.length}). Max ${MAX_ITEMS} per import — split into smaller batches.` },
      { status: 413 }
    );
  }

  let imported = 0;
  const errors: string[] = [];
  for (const raw of rawItems) {
    if (!raw || typeof raw !== 'object') continue;
    const rec = raw as Record<string, unknown>;
    const name = typeof rec.name === 'string' ? rec.name.trim() : '';
    if (!name) {
      errors.push('(missing name)');
      continue;
    }
    try {
      await upsertItem({
        client_id: bot.client_id,
        name,
        price: typeof rec.price === 'number' ? rec.price : undefined,
        stock: typeof rec.stock === 'number' ? rec.stock : undefined,
        notes: typeof rec.notes === 'string' ? rec.notes : undefined,
        is_active: true,
      });
      imported += 1;
    } catch (e) {
      errors.push(`${name}: ${String(e).slice(0, 120)}`);
    }
  }

  return NextResponse.json({
    success: true,
    imported,
    failed: errors.length,
    errors: errors.slice(0, 20),
    message:
      imported > 0
        ? `${imported} product${imported === 1 ? '' : 's'} imported into inventory.`
        : 'No products imported.',
  });
}
