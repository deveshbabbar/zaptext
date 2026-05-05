// ─── Email deliverability log ───
//
// Records the outcome of every sendEmail attempt: which address, which
// subject, success / failure, attempt count, and the upstream error on
// failure. Powers /admin/email-log so operators can answer questions
// like "did the booking notification actually go out?" without grepping
// console logs across 30 days of Vercel function invocations.

import { v4 as uuid } from 'uuid';
import { and, desc, eq, gt } from 'drizzle-orm';
import { db } from './index';
import { email_send_log } from './schema';

export type EmailSendStatus = 'sent' | 'retrying' | 'failed';

export async function recordEmailAttempt(input: {
  toEmail: string;
  subject: string;
  status: EmailSendStatus;
  attemptCount: number;
  lastError?: string;
}): Promise<void> {
  // Best-effort. We do NOT want a DB blip to break email sending — if
  // logging fails the message still went out (or didn't) regardless.
  try {
    await db.insert(email_send_log).values({
      id: uuid(),
      to_email: input.toEmail.slice(0, 200),
      subject: input.subject.slice(0, 500),
      status: input.status,
      attempt_count: input.attemptCount,
      last_error: (input.lastError || '').slice(0, 1000),
    });
  } catch (err) {
    console.error('[email-send-log] write failed (non-fatal):', err);
  }
}

export interface EmailLogRow {
  id: string;
  toEmail: string;
  subject: string;
  status: EmailSendStatus;
  attemptCount: number;
  lastError: string;
  sentAt: string;
}

function rowToOut(r: typeof email_send_log.$inferSelect): EmailLogRow {
  return {
    id: r.id,
    toEmail: r.to_email,
    subject: r.subject,
    status: r.status as EmailSendStatus,
    attemptCount: r.attempt_count,
    lastError: r.last_error ?? '',
    sentAt: r.sent_at ? r.sent_at.toISOString() : '',
  };
}

export async function listRecentEmails(limit: number = 200): Promise<EmailLogRow[]> {
  const rows = await db
    .select()
    .from(email_send_log)
    .orderBy(desc(email_send_log.sent_at))
    .limit(limit);
  return rows.map(rowToOut);
}

export async function listFailedEmails(limit: number = 100): Promise<EmailLogRow[]> {
  const rows = await db
    .select()
    .from(email_send_log)
    .where(eq(email_send_log.status, 'failed'))
    .orderBy(desc(email_send_log.sent_at))
    .limit(limit);
  return rows.map(rowToOut);
}

// Stats card for the /admin/email-log header. Returns counts within the
// last `windowHours` broken down by status — quick "is anything broken
// right now?" detection without scrolling through the full feed.
export async function getEmailStats(windowHours: number = 24): Promise<{
  windowHours: number;
  sent: number;
  failed: number;
  retrying: number;
}> {
  const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const [sent, failed, retrying] = await Promise.all([
    db
      .select({ id: email_send_log.id })
      .from(email_send_log)
      .where(and(eq(email_send_log.status, 'sent'), gt(email_send_log.sent_at, cutoff))),
    db
      .select({ id: email_send_log.id })
      .from(email_send_log)
      .where(and(eq(email_send_log.status, 'failed'), gt(email_send_log.sent_at, cutoff))),
    db
      .select({ id: email_send_log.id })
      .from(email_send_log)
      .where(and(eq(email_send_log.status, 'retrying'), gt(email_send_log.sent_at, cutoff))),
  ]);
  return {
    windowHours,
    sent: sent.length,
    failed: failed.length,
    retrying: retrying.length,
  };
}
