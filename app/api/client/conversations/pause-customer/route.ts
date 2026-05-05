// ─── Live takeover: pause/resume AI for a single customer ──────────────
//
// POST /api/client/conversations/pause-customer
//   body: { customer_phone: string, paused: boolean, reason?: string }
//
// Owner clicks "Take over" in the conversations UI -> we insert a row in
// paused_customers, webhook then stays silent for that customer until the
// owner clicks "Resume" (paused: false) which deletes the row.

import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { pauseCustomer, resumeCustomer, isCustomerPaused } from '@/lib/db/paused-customers';

export async function POST(req: NextRequest) {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ error: 'No active bot' }, { status: 400 });

  let body: { customer_phone?: string; paused?: boolean; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const phone = (body.customer_phone || '').trim();
  if (!phone) return NextResponse.json({ error: 'customer_phone required' }, { status: 400 });
  if (typeof body.paused !== 'boolean') {
    return NextResponse.json({ error: 'paused must be boolean' }, { status: 400 });
  }

  if (body.paused) {
    await pauseCustomer(bot.client_id, phone, user.userId, (body.reason || '').slice(0, 500));
  } else {
    await resumeCustomer(bot.client_id, phone);
  }

  const nowPaused = await isCustomerPaused(bot.client_id, phone);
  return NextResponse.json({ ok: true, paused: nowPaused });
}
