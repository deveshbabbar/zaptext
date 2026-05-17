import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { updateClientField, updateClientFields, updateClientAllergenStrictMode, updateClientConcurrentOrderCap, updateClientNotificationChannels, updateClientOrderApprovalMode, updateClientDefaultLanguage } from '@/lib/google-sheets';
import { generateSystemPrompt } from '@/lib/prompt-generator';
import { ClientConfig } from '@/lib/types';
import { isValidUpiId } from '@/lib/payments';
import { syncProductsFromConfig } from '@/lib/inventory-sync';
import { getActiveSubscription } from '@/lib/subscription';
import { canUse } from '@/lib/feature-gates';

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
    // Owner's PERSONAL WhatsApp number (separate from `whatsapp_number`
    // which identifies the bot's WABA). All owner notifications (new order,
    // approval prompts, low stock alerts) get sent here. Empty = falls
    // back to whatsapp_number, which fails when whatsapp_number IS the
    // bot's WABA (Meta refuses send-to-self with #100 Invalid Parameter).
    contactNumber: bot.contact_number || '',
    existingSystem: bot.existing_system || '',
    exportFormat: (bot.export_format || 'csv') as 'csv' | 'json',
    languages: langs.length > 0 ? langs : ['English'],
    // Default TRUE — see migration 0006_allergen_strict_mode.sql for the
    // FSSAI rationale. The settings UI uses this to render the toggle.
    allergenStrictMode: bot.allergen_strict_mode !== false,
    // Kitchen capacity gate (Work Item 5). Null/undefined → use platform
    // default (8) at the webhook layer. UI shows the actual stored value
    // or null so the owner can tell "I haven't set this" from "I picked 8".
    concurrentOrderCap:
      typeof bot.concurrent_order_cap === 'number' ? bot.concurrent_order_cap : null,
    // Per-channel notification toggles. Default TRUE on un-migrated bots.
    notifyWhatsapp: bot.notify_whatsapp !== false,
    notifyEmail: bot.notify_email !== false,
    notifyDashboard: bot.notify_dashboard !== false,
    // Order Gate. 'auto' (default) = bot emits [ORDER:] immediately after
    // stock + capacity check. 'manual' = bot emits [ORDER_PENDING:],
    // booking goes to pending_approval, owner gets Approve/Decline
    // interactive buttons on WhatsApp.
    orderApprovalMode: (bot.order_approval_mode === 'manual' ? 'manual' : 'auto') as 'auto' | 'manual',
    // First-touch greeting language. Per-message detection still overrides
    // this once the customer speaks — cold-start preference only.
    defaultLanguage:
      bot.default_language === 'hindi' || bot.default_language === 'hinglish'
        ? bot.default_language
        : ('english' as 'english' | 'hindi' | 'hinglish'),
  });
}

export async function POST(request: NextRequest) {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ error: 'No bot selected' }, { status: 400 });

  try {
    const body = await request.json();

    // Plan-feature gate: custom system prompts are gated to Growth+ plans.
    // The auto-regenerated prompt (built from KB) is always allowed; only
    // a user-supplied system_prompt string is restricted.
    const ownerSub = await getActiveSubscription(user.userId).catch(() => null);
    const customPromptAllowed = canUse(ownerSub?.plan, 'custom_system_prompt').allowed;

    // Bulk save: one request writes multiple fields atomically. Used by the
    // unified "Save" button on /client/settings.
    if (body && typeof body === 'object' && body.bulk && typeof body.bulk === 'object') {
      const bulk = body.bulk as Record<string, unknown>;
      const writes: Record<string, string> = {};

      if (typeof bulk.system_prompt === 'string' && !customPromptAllowed) {
        return NextResponse.json(
          {
            error: 'PLAN_LIMIT',
            message: 'Custom bot personality (system prompt) is available on Growth (₹1,499/mo) and above. Your other settings can still be saved.',
            upgradeTo: 'growth',
          },
          { status: 403 }
        );
      }

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
      if (typeof bulk.upi_id === 'string') {
        const trimmedUpi = bulk.upi_id.trim();
        // Empty string is allowed (owner clearing UPI). Otherwise must look
        // like name@bank — otherwise the bot generates broken UPI links and
        // the customer's payment app errors out.
        if (trimmedUpi && !isValidUpiId(trimmedUpi)) {
          return NextResponse.json(
            { error: 'INVALID_UPI', message: 'UPI ID must be in format name@bank (e.g. rohit@ybl).' },
            { status: 400 }
          );
        }
        writes.upi_id = trimmedUpi;
      }
      if (typeof bulk.upi_name === 'string') writes.upi_name = bulk.upi_name.trim();
      // Owner's personal WhatsApp number. Strip everything but digits + a
      // single leading '+'. Empty string is allowed (clears the override and
      // falls back to whatsapp_number).
      if (typeof bulk.contact_number === 'string') {
        const cleaned = bulk.contact_number.trim();
        // Allow empty OR a phone-like string. Minimal validation: digits +
        // optional leading '+'. The webhook does its own /\D/g cleanup.
        if (cleaned !== '' && !/^\+?\d{8,15}$/.test(cleaned.replace(/[\s-]/g, ''))) {
          return NextResponse.json(
            { error: 'INVALID_CONTACT_NUMBER', message: 'Owner contact number must be 8–15 digits, optionally with a leading +.' },
            { status: 400 }
          );
        }
        writes.contact_number = cleaned;
      }
      if (typeof bulk.existing_system === 'string') writes.existing_system = bulk.existing_system.trim();
      if (bulk.export_format === 'csv' || bulk.export_format === 'json') {
        writes.export_format = bulk.export_format;
      }

      // FSSAI allergen-safety toggle (Work Item 4). Separate from `writes`
      // because updateClientFields only accepts string values — booleans
      // route through their own dedicated helper. Tracked here so the
      // "saved" response array includes it for UI confirmation.
      let allergenStrictWritten: boolean | null = null;
      if (typeof bulk.allergen_strict_mode === 'boolean') {
        allergenStrictWritten = bulk.allergen_strict_mode;
      }

      // Kitchen capacity gate (Work Item 5). Same separate-helper rationale
      // as the boolean above. `null` from the client = clear the override
      // and fall back to the platform default 8.
      let capWritten: 'set' | 'cleared' | null = null;
      let capValue: number | null = null;
      if (bulk.concurrent_order_cap === null) {
        capWritten = 'cleared';
        capValue = null;
      } else if (typeof bulk.concurrent_order_cap === 'number' && Number.isFinite(bulk.concurrent_order_cap)) {
        const clamped = Math.max(1, Math.min(200, Math.floor(bulk.concurrent_order_cap)));
        capWritten = 'set';
        capValue = clamped;
      }

      // Per-channel notification toggles. Same boolean-via-dedicated-helper
      // pattern as the two above. Partial patch — only present keys flip.
      const notifyPatch: { whatsapp?: boolean; email?: boolean; dashboard?: boolean } = {};
      if (typeof bulk.notify_whatsapp === 'boolean') notifyPatch.whatsapp = bulk.notify_whatsapp;
      if (typeof bulk.notify_email === 'boolean') notifyPatch.email = bulk.notify_email;
      if (typeof bulk.notify_dashboard === 'boolean') notifyPatch.dashboard = bulk.notify_dashboard;
      const hasNotifyPatch = Object.keys(notifyPatch).length > 0;

      // Order Gate + default language. Validated to a fixed enum so a
      // malformed value falls through to null and isn't written.
      let approvalModeWritten: 'auto' | 'manual' | null = null;
      if (bulk.order_approval_mode === 'auto' || bulk.order_approval_mode === 'manual') {
        approvalModeWritten = bulk.order_approval_mode;
      }
      let defaultLanguageWritten: 'english' | 'hindi' | 'hinglish' | null = null;
      if (
        bulk.default_language === 'english' ||
        bulk.default_language === 'hindi' ||
        bulk.default_language === 'hinglish'
      ) {
        defaultLanguageWritten = bulk.default_language;
      }

      if (
        Object.keys(writes).length === 0 &&
        allergenStrictWritten === null &&
        capWritten === null &&
        !hasNotifyPatch &&
        approvalModeWritten === null &&
        defaultLanguageWritten === null
      ) {
        return NextResponse.json({ error: 'Nothing to save' }, { status: 400 });
      }

      if (Object.keys(writes).length > 0) {
        await updateClientFields(bot.client_id, writes);
      }
      if (allergenStrictWritten !== null) {
        await updateClientAllergenStrictMode(bot.client_id, allergenStrictWritten);
      }
      if (capWritten !== null) {
        await updateClientConcurrentOrderCap(bot.client_id, capValue);
      }
      if (hasNotifyPatch) {
        await updateClientNotificationChannels(bot.client_id, notifyPatch);
      }
      if (approvalModeWritten !== null) {
        await updateClientOrderApprovalMode(bot.client_id, approvalModeWritten);
      }
      if (defaultLanguageWritten !== null) {
        await updateClientDefaultLanguage(bot.client_id, defaultLanguageWritten);
      }

      // Auto-sync inventory whenever the KB is updated. The owner's edits to
      // menu items / services / membership plans / courses / products /
      // listings flow into the inventory table so the bot's runtime menu
      // (and the inventory dashboard page) stay in lock-step with what the
      // owner just typed in settings. Best-effort — if sync fails, the
      // settings save still succeeds and the user can rerun manually from
      // /client/inventory.
      //
      // Work Item 6: capture and return the count so callers (menu editor /
      // settings page) can show "N items synced" in their success toast
      // instead of telling the user to click a manual Sync button. The
      // manual button stays as a recovery path but should no longer be the
      // primary mental model.
      let inventorySynced: number | null = null;
      if (typeof writes.knowledge_base_json === 'string') {
        try {
          const parsedKb = JSON.parse(writes.knowledge_base_json) as ClientConfig;
          if (parsedKb && parsedKb.type) {
            const result = await syncProductsFromConfig(bot.client_id, parsedKb);
            inventorySynced = result?.count ?? 0;
          }
        } catch (e) {
          console.error('[settings] inventory auto-sync failed (non-fatal):', e);
        }
      }

      const savedKeys = Object.keys(writes);
      if (allergenStrictWritten !== null) savedKeys.push('allergen_strict_mode');
      if (capWritten !== null) savedKeys.push('concurrent_order_cap');
      if (hasNotifyPatch) savedKeys.push(...Object.keys(notifyPatch).map((k) => `notify_${k}`));
      if (approvalModeWritten !== null) savedKeys.push('order_approval_mode');
      if (defaultLanguageWritten !== null) savedKeys.push('default_language');
      return NextResponse.json({
        success: true,
        systemPrompt: writes.system_prompt,
        saved: savedKeys,
        inventorySynced,
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

    // Same plan gate as the bulk path — owner can't directly write a
    // system_prompt unless their plan allows custom personalities.
    if (field === 'system_prompt' && !customPromptAllowed) {
      return NextResponse.json(
        {
          error: 'PLAN_LIMIT',
          message: 'Custom bot personality is available on Growth (₹1,499/mo) and above.',
          upgradeTo: 'growth',
        },
        { status: 403 }
      );
    }

    // Prevent storing invalid JSON in knowledge_base_json — a corrupted value
    // would silently break all AI responses and the inventory sync for this bot.
    if (field === 'knowledge_base_json' && !isValidJson(value)) {
      return NextResponse.json({ error: 'Invalid JSON in knowledge_base_json' }, { status: 400 });
    }

    // Same UPI guard as the bulk path — non-empty value must look like name@bank.
    if (field === 'upi_id' && typeof value === 'string' && value.trim() && !isValidUpiId(value.trim())) {
      return NextResponse.json(
        { error: 'INVALID_UPI', message: 'UPI ID must be in format name@bank (e.g. rohit@ybl).' },
        { status: 400 }
      );
    }

    await updateClientField(bot.client_id, field, value);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
