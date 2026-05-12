// POST /api/admin/demo/seed-bots
// Body: { ownerUserId: string, ownerName?: string, verticals?: BusinessType[] }
//
// Seeds demo bots — one per requested vertical — under the specified
// Clerk user. Each bot gets the full DEMO_BUNDLES preset (rich KB, regen'd
// system prompt). They use placeholder phone numbers (+9199000000N)
// because the goal is to show the CLIENT DASHBOARD with realistic data
// per vertical, not actually receive WhatsApp messages — phone_number_id
// stays empty so the webhook never serves them.
//
// Existing demo bots (matched by owner + business_name) are SKIPPED so
// re-running is safe. If `verticals` is omitted, all 8 non-hidden
// verticals are attempted; the dbabbar workflow passes a 7-element list
// to skip Gym (the real bot lives there already).

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { getUserRole } from '@/lib/auth';
import { db } from '@/lib/db';
import { clients as clientsTable } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { generateSystemPrompt } from '@/lib/prompt-generator';
import { DEMO_BUNDLES } from '@/lib/demo-data';
import type { BusinessType, ClientConfig } from '@/lib/types';

const ALL_VERTICALS: BusinessType[] = [
  'restaurant',
  'coaching',
  'realestate',
  'salon',
  'gym',
  'tiffin',
  'ecommerce',
  'grocery',
];

export async function POST(request: NextRequest) {
  const user = await getUserRole();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: { ownerUserId?: string; ownerName?: string; verticals?: string[] };
  try {
    body = (await request.json()) as { ownerUserId?: string; ownerName?: string; verticals?: string[] };
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const ownerUserId = String(body.ownerUserId || '').trim();
  if (!ownerUserId) {
    return NextResponse.json({ ok: false, error: 'Missing ownerUserId' }, { status: 400 });
  }
  const ownerName = String(body.ownerName || 'Demo Owner').trim();
  const requested: BusinessType[] = Array.isArray(body.verticals) && body.verticals.length > 0
    ? body.verticals.filter((v): v is BusinessType => ALL_VERTICALS.includes(v as BusinessType))
    : ALL_VERTICALS;

  const created: Array<{ vertical: BusinessType; client_id: string; business_name: string }> = [];
  const skipped: Array<{ vertical: BusinessType; reason: string }> = [];

  for (let i = 0; i < requested.length; i++) {
    const vertical = requested[i];
    const bundle = DEMO_BUNDLES[vertical];

    const existing = await db
      .select({ id: clientsTable.client_id })
      .from(clientsTable)
      .where(
        and(
          eq(clientsTable.owner_user_id, ownerUserId),
          eq(clientsTable.business_name, bundle.business_name)
        )
      )
      .limit(1);
    if (existing.length > 0) {
      skipped.push({ vertical, reason: 'already exists for this owner' });
      continue;
    }

    let systemPrompt = '';
    try {
      const promptConfig = { ...bundle.knowledge_base, type: vertical } as unknown as ClientConfig;
      systemPrompt = generateSystemPrompt(promptConfig);
    } catch (err) {
      console.error('[seed-bots] prompt gen failed', { vertical, err });
    }

    // Placeholder phone. Real WhatsApp customers can't message it (no
    // phone_number_id), but the dashboard treats it as a valid bot.
    const placeholderPhone = `+9199${String(900000 + ALL_VERTICALS.indexOf(vertical) + 1).padStart(7, '0')}`;
    const clientId = uuid();

    try {
      await db.insert(clientsTable).values({
        client_id: clientId,
        business_name: bundle.business_name,
        type: vertical,
        owner_name: ownerName,
        whatsapp_number: placeholderPhone,
        phone_number_id: '',
        city: String((bundle.knowledge_base as Record<string, unknown>).city || ''),
        system_prompt: systemPrompt,
        knowledge_base_json: JSON.stringify(bundle.knowledge_base),
        status: 'active',
        owner_user_id: ownerUserId,
        upi_id: '',
        upi_name: '',
        existing_system: 'Demo seed',
        export_format: 'csv',
        contact_number: placeholderPhone,
        opt_in_accepted: true,
      });
      created.push({ vertical, client_id: clientId, business_name: bundle.business_name });
    } catch (err) {
      console.error('[seed-bots] insert failed', { vertical, err });
      skipped.push({ vertical, reason: err instanceof Error ? err.message : 'insert failed' });
    }
  }

  return NextResponse.json({
    ok: true,
    ownerUserId,
    created,
    skipped,
    summary: `Created ${created.length}, skipped ${skipped.length}`,
  });
}
