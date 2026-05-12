// POST /api/client/restaurant/sessions/close
//
// Manager-initiated table-session close. Authenticated; only the owner
// of the matching restaurant bot can close their own sessions.

import { NextRequest, NextResponse } from 'next/server';
import { requireClientWithBots } from '@/lib/auth';
import { closeSession, getSessionById } from '@/lib/db/restaurant-dine-in';

export async function POST(request: NextRequest) {
  const user = await requireClientWithBots().catch(() => null);
  if (!user || !user.activeBot || user.activeBot.type !== 'restaurant') {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: { sessionId?: string };
  try {
    body = (await request.json()) as { sessionId?: string };
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const sessionId = String(body.sessionId || '').trim();
  if (!sessionId) return NextResponse.json({ ok: false, error: 'Missing sessionId' }, { status: 400 });

  const session = await getSessionById(sessionId).catch(() => null);
  if (!session || session.client_id !== user.activeBot.client_id) {
    return NextResponse.json({ ok: false, error: 'Session not found' }, { status: 404 });
  }
  if (session.status !== 'open') {
    return NextResponse.json({ ok: true, alreadyClosed: true });
  }

  await closeSession(sessionId, 'manager');
  return NextResponse.json({ ok: true });
}
