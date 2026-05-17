// ─── Booking-related WhatsApp notifications with 24hr-window awareness ──
//
// The webhook can talk to customers freely because they just messaged the
// bot (inside the 24hr free-form window). But cron jobs, dashboard
// actions like "Cancel booking", and other business-initiated flows hit
// customers OUTSIDE that window — Meta only allows pre-approved template
// messages there. Free-form sends silently fail, leaving customers in
// the dark and the WABA's quality rating slipping.
//
// These helpers check the window via the most recent inbound timestamp
// and dispatch to either sendWhatsAppMessage (free-form) or
// sendWhatsAppTemplate (approved template) accordingly. Callers don't
// have to think about the window themselves.

import { getConversationHistory } from './google-sheets';
import { sendWhatsAppMessage } from './whatsapp';
import {
  TEMPLATE_NAMES,
  pickTemplateLanguage,
  sendWhatsAppTemplate,
  isWithinCustomerServiceWindow,
} from './whatsapp-templates';

// Returns the most recent inbound timestamp (ms since epoch) for this
// customer, or null when there's no inbound at all.
async function lastInboundMs(clientId: string, customerPhone: string): Promise<number | null> {
  const rows = await getConversationHistory(clientId, customerPhone, 50).catch(() => []);
  const lastInbound = [...rows].reverse().find((m) => m.direction === 'incoming');
  if (!lastInbound) return null;
  const t = new Date(lastInbound.timestamp).getTime();
  return Number.isFinite(t) ? t : null;
}

interface NotifyResult {
  ok: boolean;
  used: 'freeform' | 'template' | 'skipped';
  error?: string;
}

// Sends a booking-cancellation notification. Inside 24hr window → friendly
// free-form text. Outside → booking_cancellation template (which must be
// APPROVED in the WABA — see /admin/templates).
export async function notifyBookingCancellation(args: {
  phoneNumberId: string;
  clientId: string;
  customerPhone: string;
  customerName: string;
  service: string;
  date: string;
  time: string;
  bookingId: string;
  businessName: string;
  reason: string;
  customerLang?: string | null;
}): Promise<NotifyResult> {
  const inWindow = isWithinCustomerServiceWindow(await lastInboundMs(args.clientId, args.customerPhone));
  if (inWindow) {
    const reasonLine = args.reason ? `\nReason: ${args.reason}` : '';
    const text =
      `🙏 Sorry ${args.customerName || ''}, your booking for ` +
      `${args.service || 'your appointment'} on ${args.date}` +
      `${args.time ? ` at ${args.time}` : ''} (${args.businessName}) ` +
      `has been cancelled.${reasonLine}\n\nReply here and we'll help you rebook.`;
    const r = await sendWhatsAppMessage(args.phoneNumberId, args.customerPhone, text);
    return { ok: r.success, used: 'freeform', error: r.error };
  }
  const lang = pickTemplateLanguage(args.customerLang);
  const r = await sendWhatsAppTemplate(
    args.phoneNumberId,
    args.customerPhone,
    TEMPLATE_NAMES.BOOKING_CANCELLATION,
    [args.customerName || 'Customer', args.service || 'your appointment', args.date, args.time || '—', args.bookingId],
    lang
  );
  return { ok: r.success, used: 'template', error: r.error };
}

// Sends a booking-APPROVED notification when the owner clicks Approve on a
// pending advance reservation. Mirrors notifyBookingCancellation's dispatch
// logic — friendly free-form text inside the 24-hr CSW, fall back to the
// pre-approved booking_confirmation template outside the window.
export async function notifyBookingApproved(args: {
  phoneNumberId: string;
  clientId: string;
  customerPhone: string;
  customerName: string;
  service: string;
  date: string;
  time: string;
  bookingId: string;
  businessName: string;
  customerLang?: string | null;
}): Promise<NotifyResult> {
  const inWindow = isWithinCustomerServiceWindow(await lastInboundMs(args.clientId, args.customerPhone));
  if (inWindow) {
    const text =
      `✅ ${args.customerName || 'Hi'}, your booking for ` +
      `${args.service || 'your appointment'} on ${args.date}` +
      `${args.time ? ` at ${args.time}` : ''} is confirmed at ${args.businessName}.` +
      `\nBooking ID: ${args.bookingId}\n\nReply CANCEL anytime to cancel.`;
    const r = await sendWhatsAppMessage(args.phoneNumberId, args.customerPhone, text);
    return { ok: r.success, used: 'freeform', error: r.error };
  }
  const lang = pickTemplateLanguage(args.customerLang);
  const r = await sendWhatsAppTemplate(
    args.phoneNumberId,
    args.customerPhone,
    TEMPLATE_NAMES.BOOKING_CONFIRMATION,
    [args.customerName || 'Customer', args.service || 'your appointment', args.date, args.time || '—', args.bookingId],
    lang
  );
  return { ok: r.success, used: 'template', error: r.error };
}

// Sends a booking-rescheduled notification. Same dispatch logic.
export async function notifyBookingReschedule(args: {
  phoneNumberId: string;
  clientId: string;
  customerPhone: string;
  customerName: string;
  service: string;
  newDate: string;
  newTime: string;
  bookingId: string;
  businessName: string;
  customerLang?: string | null;
}): Promise<NotifyResult> {
  const inWindow = isWithinCustomerServiceWindow(await lastInboundMs(args.clientId, args.customerPhone));
  if (inWindow) {
    const text =
      `📅 Hi ${args.customerName || ''}, your booking with ${args.businessName} ` +
      `has been rescheduled to ${args.newDate} at ${args.newTime}. ` +
      `Booking ID: ${args.bookingId}.`;
    const r = await sendWhatsAppMessage(args.phoneNumberId, args.customerPhone, text);
    return { ok: r.success, used: 'freeform', error: r.error };
  }
  const lang = pickTemplateLanguage(args.customerLang);
  const r = await sendWhatsAppTemplate(
    args.phoneNumberId,
    args.customerPhone,
    TEMPLATE_NAMES.BOOKING_RESCHEDULE,
    [args.customerName || 'Customer', args.service || 'your appointment', args.newDate, args.newTime, args.bookingId],
    lang
  );
  return { ok: r.success, used: 'template', error: r.error };
}

// Sends a payment request. Inside-window: full UPI link inline.
// Outside-window: payment_request template (which carries the link via {{4}}).
export async function notifyPaymentRequest(args: {
  phoneNumberId: string;
  clientId: string;
  customerPhone: string;
  customerName: string;
  description: string;
  amount: number;
  paymentUrl: string;
  invoiceId: string;
  customerLang?: string | null;
}): Promise<NotifyResult> {
  const inWindow = isWithinCustomerServiceWindow(await lastInboundMs(args.clientId, args.customerPhone));
  if (inWindow) {
    const text =
      `Hi ${args.customerName || ''}, your bill for ${args.description} is ` +
      `Rs ${args.amount.toFixed(2)}. Pay here: ${args.paymentUrl}\nInvoice: ${args.invoiceId}.`;
    const r = await sendWhatsAppMessage(args.phoneNumberId, args.customerPhone, text);
    return { ok: r.success, used: 'freeform', error: r.error };
  }
  const lang = pickTemplateLanguage(args.customerLang);
  const r = await sendWhatsAppTemplate(
    args.phoneNumberId,
    args.customerPhone,
    TEMPLATE_NAMES.PAYMENT_REQUEST,
    [args.customerName || 'Customer', args.description, args.amount.toFixed(2), args.paymentUrl, args.invoiceId],
    lang
  );
  return { ok: r.success, used: 'template', error: r.error };
}
