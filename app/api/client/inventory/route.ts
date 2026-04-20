import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { getInventory, upsertItem, deleteItem, setStock, adjustStock } from '@/lib/inventory';

export async function GET() {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ error: 'No bot selected' }, { status: 404 });
  const items = await getInventory(bot.client_id);
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ error: 'No bot selected' }, { status: 400 });

  try {
    const body = await req.json();
    const action = typeof body._action === 'string' ? body._action : 'upsert';

    if (action === 'delete') {
      const sku = typeof body.sku === 'string' ? body.sku : '';
      if (!sku) return NextResponse.json({ error: 'sku required' }, { status: 400 });
      await deleteItem(bot.client_id, sku);
      return NextResponse.json({ ok: true });
    }

    if (action === 'set-stock') {
      const sku = typeof body.sku === 'string' ? body.sku : '';
      const qty = typeof body.stock === 'number' ? body.stock : parseInt(body.stock, 10);
      if (!sku || !Number.isFinite(qty)) {
        return NextResponse.json({ error: 'sku + stock required' }, { status: 400 });
      }
      const item = await setStock(bot.client_id, sku, qty);
      if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      return NextResponse.json({ ok: true, item });
    }

    if (action === 'adjust-stock') {
      const sku = typeof body.sku === 'string' ? body.sku : '';
      const delta = typeof body.delta === 'number' ? body.delta : parseInt(body.delta, 10);
      if (!sku || !Number.isFinite(delta)) {
        return NextResponse.json({ error: 'sku + delta required' }, { status: 400 });
      }
      const { item } = await adjustStock(bot.client_id, sku, delta);
      if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      return NextResponse.json({ ok: true, item });
    }

    // default: upsert
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    // Validate time format (HH:MM 24h) — empty string means "always available".
    const validTime = (v: unknown): string | undefined => {
      if (typeof v !== 'string') return undefined;
      const t = v.trim();
      if (!t) return '';
      return /^\d{1,2}:\d{2}$/.test(t) ? t : undefined;
    };
    const fromVal = validTime(body.available_from);
    const toVal = validTime(body.available_to);

    const VALID_DAYS = new Set(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
    const daysVal = Array.isArray(body.available_days)
      ? (body.available_days as unknown[])
          .filter((d): d is string => typeof d === 'string')
          .map((d) => d.trim().toLowerCase())
          .filter((d) => VALID_DAYS.has(d))
      : undefined;

    const item = await upsertItem({
      client_id: bot.client_id,
      name,
      sku: typeof body.sku === 'string' ? body.sku : undefined,
      price: typeof body.price === 'number' ? body.price : undefined,
      stock: typeof body.stock === 'number' ? body.stock : undefined,
      low_stock_threshold:
        typeof body.low_stock_threshold === 'number' ? body.low_stock_threshold : undefined,
      is_active: typeof body.is_active === 'boolean' ? body.is_active : undefined,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
      available_from: fromVal,
      available_to: toVal,
      available_days: daysVal,
    });
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    console.error('inventory POST error:', err);
    return NextResponse.json({ error: String(err).slice(0, 300) }, { status: 500 });
  }
}
