import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { updateClientField, updateClientFields } from '@/lib/google-sheets';
import { generateSystemPrompt } from '@/lib/prompt-generator';
import { ClientConfig } from '@/lib/types';

function parseKb(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

// Returns true only if the raw string is valid JSON (or empty).
function isValidJson(raw: string): boolean {
  if (!raw || !raw.trim()) return true;
  try { JSON.parse(raw); return true; } catch { return false; }
}

// Detects when parseKb silently fell back to {} due to corruption.
// If original was non-empty but returned empty, the JSON is corrupt.
function isKbCorrupted(original: string, parsed: Record<string, unknown>): boolean {
  return !!original && original.trim().length > 0 && Object.keys(parsed).length === 0;
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

      // Knowledge base + languages both touch the same JSON cell. Process them
      // together so the final KB has both the user's edits AND the language
      // selection merged in, then regenerate the system_prompt from the result.
      const hasKbEdit = typeof bulk.knowledge_base_json === 'string';
      const hasLangChange = Array.isArray(bulk.languages);

      if (hasKbEdit || hasLangChange) {
        const currentKb = parseKb(bot.knowledge_base_json);
        if (isKbCorrupted(bot.knowledge_base_json, currentKb)) {
          return NextResponse.json(
            { error: 'Bot configuration is corrupted — contact support or re-submit the onboarding form to reset it.' },
            { status: 422 }
          );
        }

        let nextKb: Record<string, unknown>;
        if (hasKbEdit) {
          const rawKb = bulk.knowledge_base_json as string;
          if (!isValidJson(rawKb)) {
            return NextResponse.json(
              { error: 'Business knowledge must be valid JSON. Fix the syntax and try again.' },
              { status: 400 }
            );
          }
          const parsed = JSON.parse(rawKb || '{}');
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return NextResponse.json(
              { error: 'Business knowledge must be a JSON object (starts with { and ends with }).' },
              { status: 400 }
            );
          }
          nextKb = parsed as Record<string, unknown>;
        } else {
          nextKb = { ...currentKb };
        }

        if (hasLangChange) {
          const langs = (bulk.languages as unknown[]).filter(
            (v): v is string => typeof v === 'string' && v.trim().length > 0
          );
          if (langs.length === 0) {
            return NextResponse.json({ error: 'languages must be a non-empty string array' }, { status: 400 });
          }
          nextKb.languages = langs;
        }

        writes.knowledge_base_json = JSON.stringify(nextKb);
        // Caller's manual system_prompt edit always wins; otherwise regenerate.
        if (typeof bulk.system_prompt !== 'string') {
          writes.system_prompt = generateSystemPrompt(nextKb as unknown as ClientConfig);
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
      if (isKbCorrupted(bot.knowledge_base_json, kb)) {
        return NextResponse.json(
          { error: 'Bot configuration is corrupted — contact support or re-submit the onboarding form to reset it.' },
          { status: 422 }
        );
      }
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

    // Prevent storing invalid JSON in knowledge_base_json — a corrupted value
    // would silently break all AI responses and the inventory sync for this bot.
    if (field === 'knowledge_base_json' && !isValidJson(value)) {
      return NextResponse.json({ error: 'Invalid JSON in knowledge_base_json' }, { status: 400 });
    }

    await updateClientField(bot.client_id, field, value);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
