// lib/grocery/owner-handler.ts
//
// Routes owner messages on a grocery client to the right action.
// Currently only catalog updates (text + voice). Later: substitution-group
// edits, slot edits, etc. — but those default to web admin in v1.
//
// NOTE on the inbound shape: this codebase's webhook parser flattens Meta's
// nested message into `{ from, type, text, audioId, audioMimeType, ... }`
// (see parseWebhookPayload in lib/whatsapp.ts). We accept that flat shape
// directly. Likewise, the project's outbound text helper is
// sendWhatsAppMessage(phoneNumberId, to, text) — there is no
// sendWhatsAppText — so the handler takes phoneNumberId as a parameter.

import { downloadWhatsAppMedia } from '../payments';
import { sendWhatsAppMessage } from '../whatsapp';
import { parseCatalogText, parseCatalogVoice } from './catalog-parser';
import { applyCatalogUpdate, formatCatalogReport } from './daily-catalog';
import { todayIsoIST } from './date-utils';

interface ClientLite {
  client_id: string;
  whatsapp_number: string;
  business_name: string;
}

interface InboundMessageLite {
  from: string;
  type: string;
  text?: string;
  audioId?: string;
  audioMimeType?: string;
}

export async function handleGroceryOwnerMessage(
  phoneNumberId: string,
  client: ClientLite,
  message: InboundMessageLite
): Promise<boolean> {
  const today = todayIsoIST();

  if (message.type === 'text' && message.text) {
    const text = message.text.trim();
    if (/^(menu|help|list|status|orders)\b/i.test(text)) return false;

    try {
      const parsed = await parseCatalogText(text);
      const report = await applyCatalogUpdate(client.client_id, today, parsed, {
        autoCreateUnknown: false,
      });
      await sendWhatsAppMessage(phoneNumberId, client.whatsapp_number, formatCatalogReport(report));
      return true;
    } catch {
      if (looksLikeCatalogUpdate(text)) {
        await sendWhatsAppMessage(
          phoneNumberId,
          client.whatsapp_number,
          'List samajh nahi aayi. Try: "tamatar 30 pyaaz 40 aloo 25"'
        );
        return true;
      }
      return false;
    }
  }

  if (message.type === 'audio' && message.audioId) {
    const media = await downloadWhatsAppMedia(message.audioId);
    if (!media) {
      await sendWhatsAppMessage(
        phoneNumberId,
        client.whatsapp_number,
        'Voice note download nahi ho saka. Try again ya text bhej do.'
      );
      return true;
    }
    try {
      const parsed = await parseCatalogVoice(media.base64, message.audioMimeType || media.mimeType);
      const report = await applyCatalogUpdate(client.client_id, today, parsed, {
        autoCreateUnknown: false,
      });
      await sendWhatsAppMessage(phoneNumberId, client.whatsapp_number, formatCatalogReport(report));
    } catch {
      await sendWhatsAppMessage(
        phoneNumberId,
        client.whatsapp_number,
        'Voice note se list nahi ban payi. Try text: "tamatar 30 pyaaz 40"'
      );
    }
    return true;
  }

  return false;
}

function looksLikeCatalogUpdate(text: string): boolean {
  if (!/\d/.test(text)) return false;
  return /\b(tamatar|pyaaz|aloo|gobhi|palak|methi|baingan|bhindi|mirch|adrak|dhaniya|nimbu|gajar|mooli|kaddu|capsicum|bhaji|sabzi|fruit|aam|kela|seb|santra|dudh|paneer|dahi)\b/i.test(
    text
  );
}
