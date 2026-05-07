// ─── Public demo-bot endpoint ───
//
// GET /api/public/demo-bot
//
// Returns the WhatsApp number of the live demo bot so the floating
// "Try the live demo" widget on the landing page can deep-link to it
// via wa.me/<number>. No auth required — the bot's WhatsApp number is
// already public (anyone messaging it can see it). We deliberately
// return ONLY the number, not name/owner/config, to keep the public
// surface minimal.
//
// Selection strategy (in priority order):
//   1. process.env.DEMO_BOT_CLIENT_ID  — explicit bot lock (recommended
//      for prod; immune to DB churn)
//   2. First 'active' bot of type 'gym' — current operator preference
//      (the founder's gym bot is the showcase demo while we ship)
//   3. Any 'active' bot — last-resort so the widget never returns null
//      while there is at least one live bot in the system
//   4. null — widget hides itself client-side

import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';

export async function GET() {
  try {
    // 1. Explicit lock via env — operator-controlled, cheapest lookup.
    const lockedId = (process.env.DEMO_BOT_CLIENT_ID || '').trim();
    if (lockedId) {
      const rows = await db
        .select({ whatsapp_number: clients.whatsapp_number, status: clients.status })
        .from(clients)
        .where(eq(clients.client_id, lockedId))
        .limit(1);
      const row = rows[0];
      if (row && row.status === 'active' && row.whatsapp_number) {
        return ok(row.whatsapp_number);
      }
    }

    // 2. First active gym bot (matches founder's setup right now).
    const gym = await db
      .select({ whatsapp_number: clients.whatsapp_number })
      .from(clients)
      .where(and(eq(clients.type, 'gym'), eq(clients.status, 'active')))
      .limit(1);
    if (gym[0]?.whatsapp_number) return ok(gym[0].whatsapp_number);

    // 3. Any active bot at all — keeps the widget alive even if the gym
    // bot status changes mid-day.
    const any = await db
      .select({ whatsapp_number: clients.whatsapp_number })
      .from(clients)
      .where(eq(clients.status, 'active'))
      .limit(1);
    if (any[0]?.whatsapp_number) return ok(any[0].whatsapp_number);

    // 4. Nothing live — widget will hide itself client-side.
    return NextResponse.json({ number: null }, { status: 200 });
  } catch (err) {
    console.error('[demo-bot] lookup failed:', err);
    return NextResponse.json({ number: null }, { status: 200 });
  }
}

function ok(rawNumber: string) {
  // Strip non-digits for wa.me/<digits> compatibility. Keep response tiny.
  const digits = rawNumber.replace(/\D/g, '');
  return NextResponse.json(
    { number: digits || null },
    {
      status: 200,
      headers: {
        // Cache for 5 minutes at the edge — number is stable across page
        // loads, no need to hit DB on every visitor refresh.
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
      },
    }
  );
}
