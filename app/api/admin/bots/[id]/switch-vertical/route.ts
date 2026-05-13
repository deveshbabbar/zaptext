// POST /api/admin/bots/[id]/switch-vertical
// Body: { vertical: 'restaurant'|'coaching'|...|'grocery' }
//
// Admin-only utility for demos. Overwrites a bot's business_name, type,
// knowledge_base_json, and system_prompt so the same WhatsApp number
// behaves like the target vertical end-to-end. Customer-facing fields
// (whatsapp_number, phone_number_id, owner_user_id, status, subscription)
// stay untouched.
//
// SOURCE PRIORITY (data-copy order):
//   1. SEEDED DEMO BOT — if the owner already has a bot of the requested
//      vertical (created via /admin/seed-demo), copy that bot's
//      knowledge_base_json + business_name + system_prompt. This preserves
//      any custom edits the owner has made on the seeded demo bot (RERA
//      numbers added, menu tweaks, etc.) and keeps the live-number bot
//      visually identical to the demo bot's workspace.
//   2. STATIC DEMO_BUNDLES (fallback) — if no seeded demo bot exists for
//      that vertical, use the hardcoded preset from lib/demo-data.ts so
//      the flip still works on first run.

import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { getClientById, updateClientFields } from '@/lib/google-sheets';
import { getBotsByOwner } from '@/lib/owner-clients';
import { generateSystemPrompt } from '@/lib/prompt-generator';
import { DEMO_BUNDLES } from '@/lib/demo-data';
import type { BusinessType, ClientConfig } from '@/lib/types';

const VALID: BusinessType[] = ['restaurant', 'coaching', 'realestate', 'salon', 'gym', 'tiffin', 'ecommerce', 'grocery', 'd2c'];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserRole();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id: botId } = await params;
  const client = await getClientById(botId).catch(() => null);
  if (!client) {
    return NextResponse.json({ ok: false, error: 'Bot not found' }, { status: 404 });
  }

  let body: { vertical?: string };
  try {
    body = (await request.json()) as { vertical?: string };
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const vertical = String(body.vertical || '').trim().toLowerCase() as BusinessType;
  if (!VALID.includes(vertical)) {
    return NextResponse.json({ ok: false, error: `vertical must be one of: ${VALID.join(', ')}` }, { status: 400 });
  }

  // ─── Try the seeded demo bot first ───
  // Look up other bots owned by the same user. If one matches the target
  // vertical (and isn't the bot we're modifying), copy its data — this is
  // the seeded demo bot from /admin/seed-demo.
  let sourceBusinessName = '';
  let sourceKbJson = '';
  let sourcePrompt = '';
  let sourceLabel: 'seeded_demo_bot' | 'static_demo_bundles' = 'static_demo_bundles';

  try {
    const siblings = await getBotsByOwner(client.owner_user_id);
    const seededMatch = siblings.find(
      (b) => b.client_id !== botId && b.type === vertical
    );
    if (seededMatch && seededMatch.knowledge_base_json) {
      sourceBusinessName = seededMatch.business_name;
      sourceKbJson = seededMatch.knowledge_base_json;
      sourcePrompt = seededMatch.system_prompt || '';
      sourceLabel = 'seeded_demo_bot';
    }
  } catch (err) {
    console.error('[switch-vertical] owner-sibling lookup failed', err);
  }

  // ─── Fallback: static DEMO_BUNDLES preset ───
  if (sourceLabel === 'static_demo_bundles') {
    const bundle = DEMO_BUNDLES[vertical];
    sourceBusinessName = bundle.business_name;
    sourceKbJson = JSON.stringify(bundle.knowledge_base);
  }

  // Always regenerate the system prompt from the chosen KB so it reflects
  // the latest prompt-generator logic (compliance gates, sub-types, etc.)
  // even if the seeded bot's saved prompt is older.
  let nextPrompt = sourcePrompt;
  try {
    const parsedKb = sourceKbJson ? (JSON.parse(sourceKbJson) as Record<string, unknown>) : {};
    const promptConfig = { ...parsedKb, type: vertical } as unknown as ClientConfig;
    const regenerated = generateSystemPrompt(promptConfig);
    if (regenerated) nextPrompt = regenerated;
  } catch (err) {
    console.error('[switch-vertical] prompt generation failed', err);
  }

  await updateClientFields(botId, {
    business_name: sourceBusinessName,
    type: vertical,
    knowledge_base_json: sourceKbJson,
    system_prompt: nextPrompt || client.system_prompt,
  });

  return NextResponse.json({
    ok: true,
    vertical,
    business_name: sourceBusinessName,
    source: sourceLabel,
    promptRegenerated: !!nextPrompt,
  });
}
