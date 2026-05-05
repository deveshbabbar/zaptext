// ─── Cron run idempotency + observability ───
//
// Vercel Cron has retry semantics: if a cron handler times out the next
// scheduled tick can fire on a fresh lambda WHILE the prior one is still
// running, leading to duplicate sends (digests, reminders, auto-cancels).
//
// Two-step lifecycle per run:
//   1. claimCronRun(task, lockoutSec)
//      - Returns { runId, claimed: true } when the caller may proceed.
//      - Returns { claimed: false, reason } when a successful run within
//        the lockout window already exists, or another run is in flight.
//      - Inserts a `cron_runs` row with ok=false on claim.
//   2. finishCronRun(runId, ok, result)
//      - Marks the row's finished_at + ok + result_json.
//
// Skipping finishCronRun() leaves the row with finished_at=null, which
// the next claim treats as "in flight" — fine for short outages, and
// trivially recoverable by manually setting `ok=true` if the run did
// actually complete.

import { v4 as uuid } from 'uuid';
import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';
import { db } from './index';
import { cron_runs } from './schema';

export interface ClaimResult {
  claimed: boolean;
  runId?: string;
  reason?: string;
  lastSuccess?: { id: string; finishedAt: string };
}

export async function claimCronRun(task: string, lockoutSec: number): Promise<ClaimResult> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - lockoutSec * 1000);

  // Look for any recent successful run OR any in-flight run for this task.
  const recent = await db
    .select()
    .from(cron_runs)
    .where(
      and(
        eq(cron_runs.task, task),
        or(
          // Successful inside lockout window
          and(eq(cron_runs.ok, true), gt(cron_runs.finished_at, cutoff)),
          // In-flight (no finished_at yet) — treat as locked
          isNull(cron_runs.finished_at)
        )
      )
    )
    .orderBy(desc(cron_runs.started_at))
    .limit(1);

  if (recent[0]) {
    const r = recent[0];
    return {
      claimed: false,
      reason: r.ok ? 'recent-success' : 'in-flight',
      lastSuccess: r.ok && r.finished_at
        ? { id: r.id, finishedAt: r.finished_at.toISOString() }
        : undefined,
    };
  }

  // No active or recently-finished run — claim a new one.
  const runId = uuid();
  await db.insert(cron_runs).values({
    id: runId,
    task,
    started_at: now,
    ok: false,
    result_json: '',
  });
  return { claimed: true, runId };
}

export async function finishCronRun(
  runId: string,
  ok: boolean,
  result?: Record<string, unknown>
): Promise<void> {
  await db
    .update(cron_runs)
    .set({
      finished_at: new Date(),
      ok,
      result_json: result ? JSON.stringify(result).slice(0, 4000) : '',
    })
    .where(eq(cron_runs.id, runId));
}

export interface CronRunRow {
  id: string;
  task: string;
  startedAt: string;
  finishedAt: string | null;
  ok: boolean;
  result: Record<string, unknown> | null;
}

export async function listCronRuns(limit: number = 100): Promise<CronRunRow[]> {
  const rows = await db
    .select()
    .from(cron_runs)
    .orderBy(desc(cron_runs.started_at))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    task: r.task,
    startedAt: r.started_at ? r.started_at.toISOString() : '',
    finishedAt: r.finished_at ? r.finished_at.toISOString() : null,
    ok: r.ok,
    result: (() => {
      if (!r.result_json) return null;
      try { return JSON.parse(r.result_json) as Record<string, unknown>; }
      catch { return null; }
    })(),
  }));
}
