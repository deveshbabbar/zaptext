import crypto from 'crypto';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0';

export async function sendWhatsAppMessage(
  phoneNumberId: string,
  to: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text },
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error('WhatsApp API error:', data);
      return { success: false, error: data.error?.message || 'Unknown error' };
    }
    return { success: true };
  } catch (error) {
    console.error('WhatsApp send error:', error);
    return { success: false, error: String(error) };
  }
}

// Send a message with up to 3 native WhatsApp reply buttons. Used to give
// trainers tappable Approve/Reject for booking requests so they don't have
// to type the booking ID. Falls back to a plain-text message if Meta rejects
// the interactive payload (e.g. on tenancies without interactive support).
//
// Limits per Meta:
//   - max 3 buttons per message
//   - button.title <= 20 chars (WhatsApp truncates beyond)
//   - button.id <= 256 chars
//
// Button IDs are echoed back verbatim in the inbound webhook as
// `interactive.button_reply.id` — surfaced via parseWebhookPayload's
// `interactiveButtonId` field. Use a short prefix like "appr|<booking_id>"
// so the handler can split + dispatch.
export async function sendWhatsAppButtons(
  phoneNumberId: string,
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>,
  fallbackText?: string
): Promise<{ success: boolean; error?: string }> {
  // Defensive: clip to Meta's limits so a too-long title doesn't make Meta
  // reject the whole payload silently.
  const safeButtons = buttons.slice(0, 3).map((b) => ({
    type: 'reply' as const,
    reply: { id: b.id.slice(0, 256), title: b.title.slice(0, 20) },
  }));

  try {
    const response = await fetch(
      `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: bodyText.slice(0, 1024) },
            action: { buttons: safeButtons },
          },
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error('WhatsApp buttons error:', data);
      // Fall back to plain text so the trainer still gets the info even when
      // interactive isn't available — they can text "approve" instead of tapping.
      if (fallbackText) {
        return await sendWhatsAppMessage(phoneNumberId, to, fallbackText);
      }
      return { success: false, error: data.error?.message || 'Unknown error' };
    }
    return { success: true };
  } catch (error) {
    console.error('WhatsApp buttons exception:', error);
    if (fallbackText) {
      return await sendWhatsAppMessage(phoneNumberId, to, fallbackText);
    }
    return { success: false, error: String(error) };
  }
}

// Sends a WhatsApp list message — up to 10 tappable rows in a dropdown
// menu. Used for the first-message welcome menu so customers can pick
// "Talk to a trainer" / "See pricing" / etc. without typing.
//
// Limits per Meta:
//   - max 10 rows total across all sections (we use one section)
//   - row.title <= 24 chars, row.description <= 72 chars
//   - row.id <= 200 chars (we cap at 200 here defensively)
//   - header <= 60, body <= 1024, footer <= 60, buttonText <= 20
//
// Row IDs come back through the inbound webhook as
// `interactive.list_reply.id` — surfaced via parseWebhookPayload's
// `interactiveListId` field.
export async function sendWhatsAppList(
  phoneNumberId: string,
  to: string,
  header: string,
  bodyText: string,
  footer: string,
  buttonText: string,
  items: Array<{ id: string; title: string; description?: string }>,
  fallbackText?: string
): Promise<{ success: boolean; error?: string }> {
  const safeRows = items.slice(0, 10).map((it) => ({
    id: it.id.slice(0, 200),
    title: it.title.slice(0, 24),
    ...(it.description ? { description: it.description.slice(0, 72) } : {}),
  }));

  const payload: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      ...(header ? { header: { type: 'text', text: header.slice(0, 60) } } : {}),
      body: { text: bodyText.slice(0, 1024) },
      ...(footer ? { footer: { text: footer.slice(0, 60) } } : {}),
      action: {
        button: (buttonText || 'Choose').slice(0, 20),
        sections: [{ title: 'Options', rows: safeRows }],
      },
    },
  };

  try {
    const response = await fetch(
      `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );
    const data = await response.json();
    if (!response.ok) {
      console.error('WhatsApp list error:', data);
      // Fall back to plain text so the customer at least gets the welcome
      // message even if the interactive shape is rejected.
      if (fallbackText) return await sendWhatsAppMessage(phoneNumberId, to, fallbackText);
      return { success: false, error: data.error?.message || 'Unknown error' };
    }
    return { success: true };
  } catch (error) {
    console.error('WhatsApp list exception:', error);
    if (fallbackText) return await sendWhatsAppMessage(phoneNumberId, to, fallbackText);
    return { success: false, error: String(error) };
  }
}

// ─── Grocery-vertical interactive helpers ─────────────────────────────
//
// Two thinner wrappers around Meta's interactive list/button payloads,
// designed to match the formatter output in `lib/grocery/wa-messages.ts`.
// Distinct from `sendWhatsAppList` / `sendWhatsAppButtons` above:
//   - take pre-built `sections`/`buttons` arrays (the grocery formatters
//     already shape these via catalogToListSections / qtyButtonsForProduct
//     / slotButtons), so callers don't reshape them again here.
//   - omit header/footer/fallbackText since grocery flows always have
//     enough context in the body text and we want a thin Promise<void>
//     surface for handler ergonomics.
// Both follow the same `phoneNumberId` first-arg signature as the rest
// of this file (NOT the global env var the original plan used).

export interface ListSection {
  title: string;
  rows: Array<{ id: string; title: string; description?: string }>;
}

// Sends an interactive list message. Meta caps the TOTAL rows at 10
// across ALL sections (NOT 10/section). We enforce that defensively here:
// trim sections so cumulative rows <= 10, dropping later sections/rows
// silently rather than letting Meta 400 the whole payload.
export async function sendInteractiveList(
  phoneNumberId: string,
  to: string,
  bodyText: string,
  buttonText: string,
  sections: ListSection[]
): Promise<void> {
  const TOTAL_ROW_CAP = 10;
  let remaining = TOTAL_ROW_CAP;
  const safeSections: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }> = [];
  for (const s of sections.slice(0, 10)) {
    if (remaining <= 0) break;
    const take = s.rows.slice(0, remaining).map((r) => ({
      id: r.id.slice(0, 200),
      title: r.title.slice(0, 24),
      ...(r.description ? { description: r.description.slice(0, 72) } : {}),
    }));
    if (take.length === 0) continue;
    safeSections.push({
      title: (s.title || 'Options').slice(0, 24),
      rows: take,
    });
    remaining -= take.length;
  }

  if (safeSections.length === 0) {
    console.error('sendInteractiveList: nothing to send (zero rows after clipping)');
    return;
  }

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: bodyText.slice(0, 1024) },
      action: {
        button: (buttonText || 'Choose').slice(0, 20),
        sections: safeSections,
      },
    },
  };

  try {
    const res = await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(
        `sendInteractiveList failed: ${res.status} ${res.statusText} body=${text}`
      );
    }
  } catch (error) {
    console.error('sendInteractiveList exception', error);
  }
}

// Sends an interactive button message (max 3 reply buttons). Thin
// counterpart to `sendInteractiveList`; see the doc-comment above for
// why this exists alongside `sendWhatsAppButtons`.
export async function sendInteractiveButtons(
  phoneNumberId: string,
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>
): Promise<void> {
  const safeButtons = buttons.slice(0, 3).map((b) => ({
    type: 'reply' as const,
    reply: { id: b.id.slice(0, 256), title: b.title.slice(0, 20) },
  }));

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText.slice(0, 1024) },
      action: { buttons: safeButtons },
    },
  };

  try {
    const res = await fetch(
      `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('sendInteractiveButtons failed', text);
    }
  } catch (error) {
    console.error('sendInteractiveButtons exception', error);
  }
}

export async function sendWhatsAppImage(
  phoneNumberId: string,
  to: string,
  imageUrl: string,
  caption?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'image',
          image: {
            link: imageUrl,
            ...(caption && { caption }),
          },
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error('WhatsApp image error:', data);
      return { success: false, error: data.error?.message || 'Unknown error' };
    }
    return { success: true };
  } catch (error) {
    console.error('WhatsApp image send error:', error);
    return { success: false, error: String(error) };
  }
}

// Register a phone number for WhatsApp Cloud API. Required once after adding a
// new number to the WABA — flips status from "Pending" → "Connected" so the
// number can send/receive via the API. The PIN is the 6-digit two-step
// verification PIN configured in Meta WhatsApp Manager → Phone numbers →
// Two-step verification.
export async function registerPhoneNumber(
  phoneNumberId: string,
  pin: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${WHATSAPP_API_URL}/${phoneNumberId}/register`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          pin,
        }),
      }
    );
    const data = await response.json();
    if (!response.ok) {
      console.error('WhatsApp register error:', data);
      return { success: false, error: data.error?.message || 'Unknown error' };
    }
    return { success: true };
  } catch (error) {
    console.error('WhatsApp register exception:', error);
    return { success: false, error: String(error) };
  }
}

export function verifyWebhook(
  mode: string | null,
  token: string | null,
  challenge: string | null
): string | null {
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return challenge;
  }
  return null;
}

// Verifies Meta's X-Hub-Signature-256 header against a raw request body.
// Returns true only when HMAC-SHA256(body, WHATSAPP_APP_SECRET) matches the header.
// A missing app secret returns false (never silently pass).
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) return false;
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;

  const expected = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(rawBody, 'utf8')
    .digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signatureHeader, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export interface WhatsAppMessage {
  id: string;
  from: string;
  text?: string;
  type: string;
  timestamp: string;
  imageId?: string;
  caption?: string;
  // Set when the inbound message is type:'audio' (covers both regular audio
  // uploads and voice notes — WhatsApp routes both through the same media
  // pipeline). Voice notes are typically OGG/Opus; regular audio can be MP3,
  // M4A, AAC. Webhook handler downloads via downloadWhatsAppMedia(audioId)
  // and sends to Gemini for transcription before treating as text.
  audioId?: string;
  audioMimeType?: string;
  // Set when the inbound message is an interactive button_reply — value is
  // the button.id we sent (e.g. "appr|BK_xxx"). Webhook handler treats this
  // like a typed command so trainers can tap instead of typing the booking ID.
  interactiveButtonId?: string;
  interactiveButtonTitle?: string;
  // Set when the inbound message is an interactive list_reply — value is
  // the row.id we sent in sendWhatsAppList (e.g. "talk_to_trainer").
  // Webhook routes welcome-menu taps via this id.
  interactiveListId?: string;
  interactiveListTitle?: string;
}

export interface WhatsAppWebhookPayload {
  phoneNumberId: string;
  messages: WhatsAppMessage[];
}

// ─── Deduplication cache (prevents processing same message twice) ───
const processedMessageIds = new Set<string>();
const MAX_CACHE_SIZE = 5000;

export function isMessageProcessed(messageId: string): boolean {
  if (processedMessageIds.has(messageId)) return true;
  // Prevent memory leak — clear oldest when too large
  if (processedMessageIds.size >= MAX_CACHE_SIZE) {
    const firstHalf = Array.from(processedMessageIds).slice(0, MAX_CACHE_SIZE / 2);
    firstHalf.forEach((id) => processedMessageIds.delete(id));
  }
  processedMessageIds.add(messageId);
  return false;
}

// Meta sends template approval/rejection events to the SAME webhook URL
// that handles messages, but with a different `field` ('message_template_status_update').
// Returns null when the payload isn't a template-status event so the
// caller can fall through to message parsing.
//
// Sample event shape:
//   { entry:[{ id:'WABA_ID', changes:[{ field:'message_template_status_update',
//     value:{ event:'APPROVED'|'REJECTED'|'PAUSED'|'FLAGGED'|'IN_APPEAL'|'PENDING_DELETION'|'DELETED',
//             message_template_id:'12345', message_template_name:'booking_reminder',
//             message_template_language:'en', reason:'...' } }] }] }
export interface TemplateStatusEvent {
  wabaId: string;
  metaTemplateId: string;
  templateName: string;
  language: string;
  status: string;          // verbatim Meta enum, mirrored into our DB
  reason: string;          // empty string when no reason provided
}

export function parseTemplateStatusEvent(
  body: Record<string, unknown>
): TemplateStatusEvent | null {
  try {
    const entry = body.entry as Array<Record<string, unknown>>;
    if (!entry || entry.length === 0) return null;
    const wabaId = (entry[0].id as string) || '';
    const changes = entry[0].changes as Array<Record<string, unknown>>;
    if (!changes || changes.length === 0) return null;
    const ch = changes[0];
    if (ch.field !== 'message_template_status_update') return null;
    const value = ch.value as Record<string, unknown>;
    if (!value) return null;
    return {
      wabaId,
      metaTemplateId: String(value.message_template_id || ''),
      templateName: String(value.message_template_name || ''),
      language: String(value.message_template_language || ''),
      status: String(value.event || 'PENDING'),
      reason: String(value.reason || ''),
    };
  } catch {
    return null;
  }
}

export function parseWebhookPayload(body: Record<string, unknown>): WhatsAppWebhookPayload | null {
  try {
    const entry = body.entry as Array<Record<string, unknown>>;
    if (!entry || entry.length === 0) return null;

    const changes = entry[0].changes as Array<Record<string, unknown>>;
    if (!changes || changes.length === 0) return null;

    const value = changes[0].value as Record<string, unknown>;
    if (!value) return null;

    const metadata = value.metadata as Record<string, string>;
    const phoneNumberId = metadata?.phone_number_id;
    if (!phoneNumberId) return null;

    const messages = value.messages as Array<Record<string, unknown>>;
    if (!messages || messages.length === 0) return null;

    return {
      phoneNumberId,
      messages: messages.map((m) => {
        const image = m.image as Record<string, string> | undefined;
        // Audio block — present for both type:'audio' (uploaded clips) and
        // type:'voice' (voice notes). Meta still puts the media metadata
        // under m.audio for both paths.
        const audio = m.audio as Record<string, string | boolean> | undefined;
        // Interactive button replies come through as type:'interactive' with
        // interactive.button_reply.{id,title}. Surface the id verbatim and
        // also synthesize a `text` field so existing string-matching paths
        // (handleStaffCommand etc.) accept the tap as if the trainer had
        // typed the title (e.g. "✅ Approve").
        const interactive = m.interactive as Record<string, unknown> | undefined;
        const buttonReply = (interactive?.button_reply as Record<string, string> | undefined);
        const interactiveButtonId = buttonReply?.id;
        const interactiveButtonTitle = buttonReply?.title;
        // List replies (interactive list message taps) — same idea as
        // button_reply, but sourced from interactive.list_reply.
        const listReply = (interactive?.list_reply as Record<string, string> | undefined);
        const interactiveListId = listReply?.id;
        const interactiveListTitle = listReply?.title;
        return {
          id: (m.id as string) || '',
          from: (m.from as string) || '',
          text:
            (m.text as Record<string, string>)?.body ??
            interactiveButtonTitle ??
            interactiveListTitle, // tap → behaves like text for existing handlers
          type: (m.type as string) || 'unknown',
          timestamp: (m.timestamp as string) || '',
          imageId: image?.id,
          caption: image?.caption,
          audioId: typeof audio?.id === 'string' ? audio.id : undefined,
          audioMimeType: typeof audio?.mime_type === 'string' ? audio.mime_type : undefined,
          interactiveButtonId,
          interactiveButtonTitle,
          interactiveListId,
          interactiveListTitle,
        };
      }),
    };
  } catch {
    return null;
  }
}
