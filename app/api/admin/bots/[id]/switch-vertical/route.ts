// POST /api/admin/bots/[id]/switch-vertical
// Body: { vertical: 'restaurant'|'coaching'|...|'grocery' }
//
// Admin-only utility for demos. Overwrites a bot's business_name, type,
// knowledge_base_json, and system_prompt with the matching DEMO_BUNDLES
// preset so the same WhatsApp number behaves like that vertical
// end-to-end. Customer-facing fields (whatsapp_number, phone_number_id,
// owner_user_id, status, subscription) stay untouched.

import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { getClientById, updateClientFields } from '@/lib/google-sheets';
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

  const bundle = DEMO_BUNDLES[vertical];
  const promptConfig = { ...bundle.knowledge_base, type: vertical } as unknown as ClientConfig;
  let nextPrompt = '';
  try {
    nextPrompt = generateSystemPrompt(promptConfig);
  } catch (err) {
    console.error('[switch-vertical] prompt generation failed', err);
  }

  await updateClientFields(botId, {
    business_name: bundle.business_name,
    type: vertical,
    knowledge_base_json: JSON.stringify(bundle.knowledge_base),
    system_prompt: nextPrompt || client.system_prompt,
  });

  return NextResponse.json({
    ok: true,
    vertical,
    business_name: bundle.business_name,
    promptRegenerated: !!nextPrompt,
  });
}
