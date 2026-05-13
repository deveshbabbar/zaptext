// ─── Cron dispatcher ─────────────────────────────────────────────────────
//
// Vercel Hobby tier allows max 2 cron jobs (and only daily schedules).
// We have 4 logical cron tasks — morning-summary, evening-summary,
// reminders, auto-cancel-stale. Solution: this single dispatcher
// endpoint accepts a ?task=morning|evening param, orchestrates the
// underlying tasks via internal HTTP calls (so we don't duplicate any
// existing endpoint logic), and lets vercel.json register just 2
// scheduled entries — one per task bucket.
//
// Schedule (configured in vercel.json):
//   /api/cron/dispatch?task=morning  → 03:30 UTC = 09:00 IST
//   /api/cron/dispatch?task=evening  → 14:30 UTC = 20:00 IST
//
// Auto-cancel-stale runs from BOTH buckets so a booking abandoned
// mid-day gets cleaned up by the evening pass at the latest. The
// webhook also runs an inline stale sweep (via after()) so during
// active hours, cleanups happen within minutes, not hours.

import { NextRequest, NextResponse } from 'next/server';

const TASK_PIPELINES: Record<string, string[]> = {
  morning: [
    '/api/cron/morning-summary',
    '/api/cron/expiry-warning',
    '/api/cron/auto-cancel-stale',
    '/api/cron/grocery-recurring',
    '/api/cron/restaurant-sessions/close-stale',
    '/api/cron/qr-auto-rotate',
  ],
  evening: [
    '/api/cron/evening-summary',
    '/api/cron/reminders',
    '/api/cron/auto-cancel-stale',
    '/api/cron/restaurant-sessions/close-stale',
  ],
};

function pickOrigin(req: NextRequest): string {
  // Prefer NEXT_PUBLIC_APP_URL (always set in prod/local). Fallback to
  // request URL's origin so the dispatcher works even if the env var
  // is missing on a fresh deploy.
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (env) return env.replace(/\/+$/, '');
  return new URL(req.url).origin;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const task = (new URL(request.url).searchParams.get('task') || '').toLowerCase();
  const pipeline = TASK_PIPELINES[task];
  if (!pipeline) {
    return NextResponse.json(
      {
        error: 'BAD_TASK',
        message: `Unknown task "${task}". Use ?task=morning or ?task=evening.`,
      },
      { status: 400 }
    );
  }

  const origin = pickOrigin(request);
  const results: Array<{ path: string; ok: boolean; status?: number; body?: unknown; error?: string }> = [];

  // Sequential — keeps total runtime predictable, avoids hammering
  // Neon with 3 concurrent admin queries from the same deploy. Each
  // sub-call's response is captured so the dispatcher's response
  // shows what fired and what failed.
  for (const path of pipeline) {
    try {
      const res = await fetch(`${origin}${path}`, {
        headers: { authorization: `Bearer ${cronSecret}` },
        // 4 min cap so a wedged downstream call can't strand the
        // dispatcher past Vercel's function timeout.
        signal: AbortSignal.timeout(240_000),
      });
      const body = await res.json().catch(() => ({}));
      results.push({ path, ok: res.ok, status: res.status, body });
    } catch (e) {
      results.push({ path, ok: false, error: String(e).slice(0, 200) });
    }
  }

  const allOk = results.every((r) => r.ok);
  return NextResponse.json(
    { ok: allOk, task, results },
    { status: allOk ? 200 : 207 }
  );
}
