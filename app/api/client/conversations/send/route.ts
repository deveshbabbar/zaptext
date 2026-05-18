// ─── Live takeover: owner sends a manual reply to a customer ────────────
//
// POST /api/client/conversations/send
//   body: { customer_phone: string, message: string }
//
// Used by the conversations UI's send-box when the owner has taken over
// from the AI. Server enforces:
//   - owner must own the active bot (via resolveActiveBot)
//   - latest inbound must be within 24hr (Meta's free-form window)
//     -> outside the window we refuse and tell the owner to wire a
//        template send instead

import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { isWithinCustomerServiceWindow } from '@/lib/whatsapp-templates';
import { getConversationHistory, addConversationMessage } from '@/lib/google-sheets';
import { canUse } from '@/lib/feature-gates';
import { getActiveSubscription } from '@/lib/subscription';
import { getISTTimestamp, formatPhoneNumber } from '@/lib/utils';

export async function POST(req: NextRequest) {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ error: 'No active bot' }, { status: 400 });
  if (!bot.phone_number_id) {
    return NextResponse.json({ error: 'Bot has no phone_number_id wired' }, { status: 400 });
  }

  // Live takeover is gated to Starter+ — free tier doesn't get it.
  const sub = await getActiveSubscription(user.userId).catch(() => null);
  const gate = canUse(sub?.plan, 'live_takeover');
  if (!gate.allowed) {
    return NextResponse.json(
      { error: 'PLAN_LIMIT', message: gate.reason, upgradeTo: gate.upgradeTo },
      { status: 403 }
    );
  }

  let body: { customer_phone?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  // Normalise to E.164 (+91XXXXXXXXXX) before any downstream use. The
  // webhook path always stores phones in E.164; this manual-send path
  // previously trusted whatever the caller typed, so a stored number
  // like '+91-9876-543-210' would hit the WhatsApp API with garbage
  // and surface to the owner as SEND_FAILED with no clear reason.
  const rawPhone = (body.customer_phone || '').trim();
  const phone = rawPhone ? formatPhoneNumber(rawPhone) : '';
  const message = (body.message || '').trim();
  if (!phone) return NextResponse.json({ error: 'customer_phone required' }, { status: 400 });
  if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 });
  if (message.length > 4096) {
    return NextResponse.json({ error: 'message too long (max 4096 chars)' }, { status: 400 });
  }

  // Find the most recent inbound timestamp to check the 24hr free-form
  // window. If we have no inbound at all the owner can't initiate via
  // free-form text — they'd have to send an approved template instead.
  const history = await getConversationHistory(bot.client_id, phone, 50);
  const lastInbound = [...history].reverse().find((m) => m.direction === 'incoming');
  const lastInboundMs = lastInbound ? new Date(lastInbound.timestamp).getTime() : null;

  if (!isWithinCustomerServiceWindow(lastInboundMs)) {
    return NextResponse.json(
      {
        error: 'OUTSIDE_24HR_WINDOW',
        message:
          'This customer has not messaged in the last 24 hours. ' +
          'WhatsApp only allows pre-approved templates outside the 24hr window. ' +
          'Use a template campaign instead, or wait for the customer to message first.',
      },
      { status: 409 }
    );
  }

  const result = await sendWhatsAppMessage(bot.phone_number_id, phone, message);
  if (!result.success) {
    return NextResponse.json({ error: 'SEND_FAILED', message: result.error }, { status: 502 });
  }

  await addConversationMessage({
    timestamp: getISTTimestamp(),
    client_id: bot.client_id,
    customer_phone: phone,
    direction: 'outgoing',
    // Marked so analytics / audit can distinguish AI replies from owner replies.
    message: `[owner] ${message}`,
    message_type: 'text',
  });

  return NextResponse.json({ ok: true });
}
