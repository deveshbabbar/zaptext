// ─── Admin audit log writer ───
//
// Every admin-side mutation should call writeAuditLog() so we have a
// "who did this, when, to whom" trail for billing disputes, abuse
// investigations, and rollback scenarios. Append-only: nothing in the
// app reads or rewrites these rows beyond the upcoming /admin/audit-log
// dashboard.

import { v4 as uuid } from 'uuid';
import { desc, eq } from 'drizzle-orm';
import { db } from './index';
import { admin_audit_log } from './schema';

export interface AuditLogInput {
  actorUserId: string;
  actorEmail?: string;
  action: string;             // e.g. 'plan.grant', 'bot.seed', 'client.delete'
  targetUserId?: string;
  targetEmail?: string;
  targetResource?: string;    // e.g. client_id, bot_id, subscription_id
  details?: Record<string, unknown>;
}

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  // Audit logging is best-effort: if the DB hiccups we DO NOT want to
  // block the underlying admin action (better to lose a log row than
  // refuse a legitimate plan grant). Errors are logged for ops review.
  try {
    await db.insert(admin_audit_log).values({
      id: uuid(),
      actor_user_id: input.actorUserId,
      actor_email: input.actorEmail || '',
      action: input.action,
      target_user_id: input.targetUserId || '',
      target_email: input.targetEmail || '',
      target_resource: input.targetResource || '',
      details_json: input.details ? JSON.stringify(input.details).slice(0, 4000) : '',
    });
  } catch (err) {
    console.error('[audit-log] write failed:', err, input);
  }
}

export interface AuditLogRow {
  id: string;
  actorUserId: string;
  actorEmail: string;
  action: string;
  targetUserId: string;
  targetEmail: string;
  targetResource: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

function rowToOut(r: typeof admin_audit_log.$inferSelect): AuditLogRow {
  return {
    id: r.id,
    actorUserId: r.actor_user_id,
    actorEmail: r.actor_email ?? '',
    action: r.action,
    targetUserId: r.target_user_id ?? '',
    targetEmail: r.target_email ?? '',
    targetResource: r.target_resource ?? '',
    details: (() => {
      if (!r.details_json) return null;
      try { return JSON.parse(r.details_json) as Record<string, unknown>; }
      catch { return null; }
    })(),
    createdAt: r.created_at ? r.created_at.toISOString() : '',
  };
}

export async function listAuditLog(limit: number = 200): Promise<AuditLogRow[]> {
  const rows = await db
    .select()
    .from(admin_audit_log)
    .orderBy(desc(admin_audit_log.created_at))
    .limit(limit);
  return rows.map(rowToOut);
}

export async function listAuditLogForActor(actorUserId: string, limit: number = 100): Promise<AuditLogRow[]> {
  const rows = await db
    .select()
    .from(admin_audit_log)
    .where(eq(admin_audit_log.actor_user_id, actorUserId))
    .orderBy(desc(admin_audit_log.created_at))
    .limit(limit);
  return rows.map(rowToOut);
}
