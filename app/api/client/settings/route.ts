import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { updateClientField } from '@/lib/google-sheets';
import { generateSystemPrompt } from '@/lib/prompt-generator';
import { ClientConfig } from '@/lib/types';

function parseKb(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

export async function GET() {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ error: 'No bot selected' }, { status: 404 });

  const kb = parseKb(bot.knowledge_base_json);
  const rawLangs = Array.isArray(kb.languages) ? kb.languages : [];
  const langs = rawLangs.filter((x): x is string => typeof x === 'string');

  return NextResponse.json({
    systemPrompt: bot.system_prompt,
    knowledgeBase: bot.knowledge_base_json,
    upiId: bot.upi_id || '',
    upiName: bot.upi_name || '',
    existingSystem: bot.existing_system || '',
    exportFormat: (bot.export_format || 'csv') as 'csv' | 'json',
    languages: langs.length > 0 ? langs : ['English'],
  });
}

export async function POST(request: NextRequest) {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ error: 'No bot selected' }, { status: 400 });

  try {
    const { field, value } = await request.json();

    // Language update: also regenerates system_prompt so the bot's actual
    // behavior switches — a bare knowledge_base update alone wouldn't change it.
    if (field === 'languages') {
      if (!Array.isArray(value) || value.some((v) => typeof v !== 'string') || value.length === 0) {
        return NextResponse.json({ error: 'languages must be a non-empty string array' }, { status: 400 });
      }
      const kb = parseKb(bot.knowledge_base_json);
      kb.languages = value;
      const updatedConfig = kb as unknown as ClientConfig;
      const newPrompt = generateSystemPrompt(updatedConfig);
      const newKbJson = JSON.stringify(kb);
      await updateClientField(bot.client_id, 'knowledge_base_json', newKbJson);
      await updateClientField(bot.client_id, 'system_prompt', newPrompt);
      return NextResponse.json({ success: true, systemPrompt: newPrompt });
    }

    // Only allow safe fields to be updated by clients
    const ALLOWED_FIELDS = [
      'system_prompt', 'knowledge_base_json', 'business_name', 'city', 'whatsapp_number',
      'upi_id', 'upi_name', 'existing_system', 'export_format',
    ];
    if (!ALLOWED_FIELDS.includes(field)) {
      return NextResponse.json({ error: 'Field not allowed' }, { status: 403 });
    }

    await updateClientField(bot.client_id, field, value);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
