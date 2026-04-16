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

export interface WhatsAppMessage {
  id: string;
  from: string;
  text?: string;
  type: string;
  timestamp: string;
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
      messages: messages.map((m) => ({
        id: (m.id as string) || '',
        from: (m.from as string) || '',
        text: (m.text as Record<string, string>)?.body,
        type: (m.type as string) || 'unknown',
        timestamp: (m.timestamp as string) || '',
      })),
    };
  } catch {
    return null;
  }
}
