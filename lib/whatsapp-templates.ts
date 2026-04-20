// WhatsApp Business approved-template sending.
//
// Meta's Business Messaging Policy requires that any business-initiated
// message sent OUTSIDE the 24-hour customer-service window use a template
// that has been pre-approved by WhatsApp. Free-form text is only allowed
// as a reply within 24h of the customer's last inbound message.
//
// Template NAMES below must be created and approved in Meta Business Manager
// → WhatsApp Manager → Message Templates before use. The language code must
// match the approved template's language.
//
// Setup checklist for each new deployment:
//   1. Business Manager → WhatsApp Manager → Message Templates → Create
//   2. Category: UTILITY (for reminders) or AUTHENTICATION (for OTPs)
//   3. Language: English (or whatever you prefer; set WHATSAPP_TEMPLATE_LOCALE)
//   4. Body with placeholders: {{1}}, {{2}}, ...
//   5. Submit for approval (usually 1-24 hours)
//   6. Once APPROVED, sendWhatsAppTemplate() will work

const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0';

export const TEMPLATE_NAMES = {
  // UTILITY category — booking confirmations, reminders.
  BOOKING_REMINDER: 'booking_reminder',
  // UTILITY — sent to owner when their bot activates.
  BOT_ACTIVATED: 'bot_activated',
} as const;

export type TemplateName = typeof TEMPLATE_NAMES[keyof typeof TEMPLATE_NAMES];

export interface TemplateComponent {
  type: 'body' | 'header' | 'footer' | 'button';
  parameters?: Array<{ type: 'text'; text: string }>;
}

// Sends an approved WhatsApp template message. Returns { success, error }.
// On failure, callers MUST NOT fall back to free-form text outside the 24h
// window — Meta will downgrade the account's quality rating.
export async function sendWhatsAppTemplate(
  phoneNumberId: string,
  to: string,
  templateName: TemplateName,
  bodyParams: string[] = [],
  languageCode?: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) {
    return { success: false, error: 'WHATSAPP_ACCESS_TOKEN not set' };
  }
  const lang = languageCode || process.env.WHATSAPP_TEMPLATE_LOCALE || 'en';

  const components: TemplateComponent[] = [];
  if (bodyParams.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyParams.map((text) => ({ type: 'text' as const, text })),
    });
  }

  try {
    const res = await fetch(
      `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: lang },
            components: components.length > 0 ? components : undefined,
          },
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      const errMsg = data.error?.message || data.error?.error_data?.details || 'Unknown WhatsApp error';
      console.error('[whatsapp-template] send failed', {
        template: templateName,
        status: res.status,
        error: errMsg,
      });
      return { success: false, error: errMsg };
    }
    const messageId = data.messages?.[0]?.id as string | undefined;
    return { success: true, messageId };
  } catch (err) {
    console.error('[whatsapp-template] send threw', err);
    return { success: false, error: String(err).slice(0, 300) };
  }
}

// Helper: checks if a customer is within the 24-hour conversation window
// based on the most recent inbound message timestamp. If this returns true,
// free-form sendWhatsAppMessage is permitted; otherwise you MUST use a template.
export function isWithinCustomerServiceWindow(lastInboundAtMs: number | null): boolean {
  if (!lastInboundAtMs) return false;
  const hoursSince = (Date.now() - lastInboundAtMs) / (1000 * 60 * 60);
  return hoursSince < 24;
}
