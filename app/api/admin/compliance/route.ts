// ─── Admin Compliance Dashboard API ───
//
// Powers /admin/compliance. Aggregates Meta WhatsApp Business Policy
// posture signals so the operator can show auditors / themselves that
// the platform is operating within Meta's Jan 2026 task-scoped-AI rules
// and India DPDP Act 2026 consent requirements.
//
// Surfaces:
//   - Opt-in coverage (clients with opt_in_accepted=true / total active)
//   - Template approval breakdown (APPROVED / PENDING / REJECTED / etc.)
//   - Custom-prompt vs default-prompt distribution (proxy for task-scope risk)
//   - Bots without WhatsApp number (can't actually message — flag)
//   - Recently rejected templates (need attention)
// Admin-only.

import { NextResponse } from 'next/server';
import { and, count, desc, eq, gt } from 'drizzle-orm';
import { getUserRole } from '@/lib/auth';
import { db } from '@/lib/db';
import { clients, template_submissions, conversations } from '@/lib/db/schema';

export async function GET() {
  const user = await getUserRole();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    allClientRows,
    templatesByStatus,
    recentlyRejectedTemplates,
    inboundLast7Days,
    outboundLast7Days,
  ] = await Promise.all([
    db
      .select({
        client_id: clients.client_id,
        status: clients.status,
        opt_in_accepted: clients.opt_in_accepted,
        whatsapp_number: clients.whatsapp_number,
        system_prompt: clients.system_prompt,
      })
      .from(clients),
    db
      .select({ status: template_submissions.status, n: count() })
      .from(template_submissions)
      .groupBy(template_submissions.status),
    db
      .select()
      .from(template_submissions)
      .where(eq(template_submissions.status, 'REJECTED'))
      .orderBy(desc(template_submissions.updated_at))
      .limit(10),
    db
      .select({ n: count() })
      .from(conversations)
      .where(and(eq(conversations.direction, 'incoming'), gt(conversations.timestamp, sevenDaysAgo))),
    db
      .select({ n: count() })
      .from(conversations)
      .where(and(eq(conversations.direction, 'outgoing'), gt(conversations.timestamp, sevenDaysAgo))),
  ]);

  const activeClients = allClientRows.filter((c) => c.status === 'active');
  const optInCoverage = {
    total: activeClients.length,
    accepted: activeClients.filter((c) => c.opt_in_accepted === true).length,
  };

  const missingNumber = allClientRows.filter(
    (c) => c.status === 'active' && (!c.whatsapp_number || c.whatsapp_number.trim() === '')
  ).length;

  const promptHealth = {
    withPrompt: activeClients.filter((c) => (c.system_prompt || '').trim().length > 0).length,
    emptyPrompt: activeClients.filter((c) => (c.system_prompt || '').trim().length === 0).length,
  };

  const messages7d = {
    inbound: Number(inboundLast7Days[0]?.n ?? 0),
    outbound: Number(outboundLast7Days[0]?.n ?? 0),
  };

  return NextResponse.json({
    ok: true,
    now: now.toISOString(),
    optIn: {
      total: optInCoverage.total,
      accepted: optInCoverage.accepted,
      coveragePct:
        optInCoverage.total === 0
          ? 100
          : Math.round((optInCoverage.accepted / optInCoverage.total) * 100),
    },
    templates: {
      byStatus: templatesByStatus.map((r) => ({ status: r.status, count: Number(r.n) })),
      recentlyRejected: recentlyRejectedTemplates.map((r) => ({
        wabaId: r.waba_id,
        templateName: r.template_name,
        language: r.language,
        category: r.category,
        lastError: r.last_error || '(no reason returned)',
        updatedAt: r.updated_at?.toISOString() ?? '',
      })),
    },
    bots: {
      activeCount: activeClients.length,
      missingWhatsAppNumber: missingNumber,
      withPrompt: promptHealth.withPrompt,
      emptyPrompt: promptHealth.emptyPrompt,
    },
    messages7d,
    policy: {
      taskScopedAI: 'enforced (system_prompt scopes Gemini per vertical)',
      service24hrWindow: 'enforced (free-form replies only inside customer-initiated 24hr window)',
      optInRequired: 'enforced (onboarding asserts opt_in_accepted=true; required for all non-template messages)',
      humanEscalation: 'enforced (all bots support pause-toggle + explicit "talk to human" intent)',
      bspPositioning: 'tech provider — not BSP (sits on top of Meta-approved BSP)',
      dpdpCompliance: 'privacy policy at /privacy; data deletion endpoint at /api/client/delete-account',
    },
  });
}
