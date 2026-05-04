// ─── Owner-side pause/resume toggle for the active bot ──────────────────
//
// Mirrors the "pause" / "resume" WhatsApp text commands (handled in
// app/api/webhook/route.ts handleOwnerCommand) but exposed as an HTTP POST
// so the bot-context card in the client dashboard can flip status with a
// single tap. Only flips between active ↔ paused; refuses to touch
// pending/rejected/error states (those are admin lifecycle states, not
// owner-controlled).

import { NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { updateClientField } from '@/lib/google-sheets';

export async function POST() {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ error: 'No active bot' }, { status: 400 });

  if (bot.status !== 'active' && bot.status !== 'paused') {
    return NextResponse.json(
      {
        error: 'STATUS_NOT_TOGGLEABLE',
        message: `Bot status "${bot.status}" can't be toggled here. Contact support if you think this is wrong.`,
      },
      { status: 400 }
    );
  }

  const next = bot.status === 'active' ? 'paused' : 'active';
  await updateClientField(bot.client_id, 'status', next);

  return NextResponse.json({ ok: true, status: next });
}
