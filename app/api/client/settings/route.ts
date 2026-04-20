import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { updateClientField, updateClientFields } from '@/lib/google-sheets';
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
    botId: bot.client_id,
    botName: bot.business_name,
    botType: bot.type,
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
    const body = await request.json();

    // Bulk save: one request writes multiple fields atomically. Used by the
    // unified "Save" button on /client/settings.
    if (body && typeof body === 'object' && body.bulk && typeof body.bulk === 'object') {
      const bulk = body.bulk as Record<string, unknown>;
      const writes: Record<string, string> = {};

      // Languages → also regenerates system_prompt
      if (Array.isArray(bulk.languages)) {
        const langs = (bulk.languages as unknown[]).filter(
          (v): v is string => typeof v === 'string' && v.trim().length > 0
        );
        if (langs.length === 0) {
          return NextResponse.json({ error: 'languages must be a non-empty string array' }, { status: 400 });
        }
        const kb = parseKb(bot.knowledge_base_json);
        kb.languages = langs;
        writes.knowledge_base_json = JSON.stringify(kb);
        const regeneratedPrompt = generateSystemPrompt(kb as unknown as ClientConfig);
        // If the caller ALSO sent an edited system_prompt, their edit wins
        // (they may have tweaked it manually); otherwise use the regenerated one.
        if (typeof bulk.system_prompt !== 'string') {
          writes.system_prompt = regeneratedPrompt;
        }
      }

      if (typeof bulk.system_prompt === 'string') writes.system_prompt = bulk.system_prompt;
      if (typeof bulk.upi_id === 'string') writes.upi_id = bulk.upi_id.trim();
      if (typeof bulk.upi_name === 'string') writes.upi_name = bulk.upi_name.trim();
      if (typeof bulk.existing_system === 'string') writes.existing_system = bulk.existing_system.trim();
      if (bulk.export_format === 'csv' || bulk.export_format === 'json') {
        writes.export_format = bulk.export_format;
      }

      if (Object.keys(writes).length === 0) {
        return NextResponse.json({ error: 'Nothing to save' }, { status: 400 });
      }

      await updateClientFields(bot.client_id, writes);
      return NextResponse.json({
        success: true,
        systemPrompt: writes.system_prompt,
        saved: Object.keys(writes),
      });
    }

    const { field, value } = body;

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
      // Atomic batch write: 1 Sheets read + 1 batchUpdate instead of 2+2.
      // Prevents half-completed saves when the client's fetch() times out
      // (the old sequential path could leave prompt + languages out of sync).
      await updateClientFields(bot.client_id, {
        knowledge_base_json: newKbJson,
        system_prompt: newPrompt,
      });
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
