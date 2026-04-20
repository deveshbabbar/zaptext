import { NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { syncProductsFromConfig } from '@/lib/inventory-sync';
import { ClientConfig } from '@/lib/types';

export async function POST() {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ error: 'No bot selected' }, { status: 400 });

  let config: ClientConfig;
  try {
    config = JSON.parse(bot.knowledge_base_json || '{}');
  } catch {
    return NextResponse.json(
      { error: 'Could not parse bot configuration. Re-save your bot onboarding first.' },
      { status: 400 }
    );
  }
  if (!config.type) {
    return NextResponse.json(
      { error: 'Bot configuration has no type — fill the onboarding form first.' },
      { status: 400 }
    );
  }

  try {
    const result = await syncProductsFromConfig(bot.client_id, config);
    return NextResponse.json({
      success: true,
      count: result.count,
      names: result.names,
      skipped: result.skipped,
      message:
        result.count === 0
          ? 'No products found in your bot configuration.'
          : `${result.count} product${result.count === 1 ? '' : 's'} synced into inventory. Existing stock preserved.`,
    });
  } catch (err) {
    console.error('[inventory/sync-from-form] error:', err);
    return NextResponse.json({ error: String(err).slice(0, 300) }, { status: 500 });
  }
}
