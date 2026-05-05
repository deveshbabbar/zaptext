// ─── Admin: WhatsApp template approval status ───────────────────────────
//
// Returns the current state of every template we've submitted to Meta for
// the configured WABA. Reads from the local template_submissions table
// (fast, fresh enough — Meta's webhook keeps us in sync) and joins the
// definition from lib/whatsapp-templates so the operator sees the body
// text + category alongside the status.
//
// Optional ?refresh=1 — pulls the live state from Meta's
// /{WABA_ID}/message_templates endpoint and upserts rows. Use this if
// you suspect the local table has drifted (e.g., webhook missed an event).

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getUserRole } from '@/lib/auth';
import { db } from '@/lib/db';
import { template_submissions } from '@/lib/db/schema';
import {
  ALL_LANGUAGES,
  ALL_TEMPLATE_NAMES,
  TEMPLATE_DEFINITIONS,
  type TemplateLanguage,
  type TemplateName,
} from '@/lib/whatsapp-templates';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0';

interface MetaTemplate {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  rejected_reason?: string;
}

async function fetchAllFromMeta(wabaId: string, accessToken: string): Promise<MetaTemplate[]> {
  const out: MetaTemplate[] = [];
  let url: string | null = `${WHATSAPP_API_URL}/${wabaId}/message_templates?limit=100`;
  while (url) {
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Meta returned ${res.status}: ${errBody.slice(0, 200)}`);
    }
    const data = await res.json();
    if (Array.isArray(data?.data)) out.push(...data.data);
    url = data?.paging?.next || null;
  }
  return out;
}

export async function GET(req: NextRequest) {
  const user = await getUserRole();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  if (!wabaId) {
    return NextResponse.json(
      { error: 'WHATSAPP_BUSINESS_ACCOUNT_ID not set in env' },
      { status: 500 }
    );
  }

  const refresh = req.nextUrl.searchParams.get('refresh') === '1';

  if (refresh) {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json(
        { error: 'WHATSAPP_ACCESS_TOKEN not set' },
        { status: 500 }
      );
    }
    try {
      const live = await fetchAllFromMeta(wabaId, accessToken);
      const known = new Set(ALL_TEMPLATE_NAMES as string[]);
      for (const t of live) {
        if (!known.has(t.name)) continue;
        await db
          .insert(template_submissions)
          .values({
            waba_id: wabaId,
            template_name: t.name,
            language: t.language,
            category: t.category || 'UTILITY',
            status: t.status || 'PENDING',
            meta_template_id: t.id || '',
            last_error: t.rejected_reason || '',
            updated_at: new Date(),
          })
          .onConflictDoUpdate({
            target: [
              template_submissions.waba_id,
              template_submissions.template_name,
              template_submissions.language,
            ],
            set: {
              status: t.status || 'PENDING',
              meta_template_id: t.id || '',
              last_error: t.rejected_reason || '',
              category: t.category || 'UTILITY',
              updated_at: new Date(),
            },
          });
      }
    } catch (err) {
      return NextResponse.json(
        { error: 'META_REFRESH_FAILED', message: String(err).slice(0, 300) },
        { status: 502 }
      );
    }
  }

  const rows = await db
    .select()
    .from(template_submissions)
    .where(eq(template_submissions.waba_id, wabaId));

  // Index DB rows by (name, language) for O(1) join with the definition list.
  const rowMap = new Map<string, typeof rows[number]>();
  for (const r of rows) {
    rowMap.set(`${r.template_name}|${r.language}`, r);
  }

  // Build a deterministic full report so the UI shows ALL templates we
  // have defined, even those never submitted (status: NOT_SUBMITTED).
  const report = ALL_TEMPLATE_NAMES.flatMap((name: TemplateName) => {
    const def = TEMPLATE_DEFINITIONS[name];
    return ALL_LANGUAGES.map((language: TemplateLanguage) => {
      const row = rowMap.get(`${name}|${language}`);
      const body = def.bodies[language];
      return {
        name,
        language,
        category: def.category,
        description: def.description,
        body_preview: body?.body.slice(0, 100) || '',
        status: row?.status || 'NOT_SUBMITTED',
        meta_template_id: row?.meta_template_id || '',
        last_error: row?.last_error || '',
        submitted_at: row?.submitted_at?.toISOString() || null,
        updated_at: row?.updated_at?.toISOString() || null,
      };
    });
  });

  // Bucket counts so the dashboard card can render at a glance.
  const counts = report.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    waba_id: wabaId,
    total: report.length,
    counts,
    refreshed_from_meta: refresh,
    templates: report,
  });
}
