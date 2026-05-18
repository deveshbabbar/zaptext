// Brevo (formerly Sendinblue) transactional email integration.
// Dashboard: https://app.brevo.com
// Env vars:
//   BREVO_API_KEY       (required) — xkeysib-... key from Brevo dashboard
//                                    → Senders & IPs → SMTP & API → API Keys
//   BREVO_SENDER_EMAIL  (optional) — defaults to 'hello@zaptext.shop'.
//                                    Must be a verified sender in Brevo.
//   BREVO_SENDER_NAME   (optional) — defaults to 'ZapText'.
//   BREVO_REPLY_TO_EMAIL(optional) — defaults to BREVO_SENDER_EMAIL
//                                    (single-inbox setup — replies go
//                                    back to the same hello@ mailbox).
//
// API reference: https://developers.brevo.com/reference/sendtransacemail
// Body shape differs from Zoho's ZeptoMail (`htmlContent` vs `htmlbody`,
// `sender` vs `from`, etc.) — full rewrite, not a drop-in swap.

import { recordEmailAttempt } from './db/email-send-log';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

export interface EmailAttachment {
  filename: string;
  content: string; // base64-encoded
  contentType?: string;
}

interface SendEmailParams {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}

// Strip CR/LF from any user-controlled subject text — guards against
// header injection if a business name accidentally contains a newline.
function sanitizeSubject(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').slice(0, 200);
}

// Whether an HTTP error is worth retrying. 4xx (except 429) means our
// request is wrong — retrying won't help. 5xx and 429 are transient.
function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function sendEmail({ to, toName, subject, html, attachments }: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error('[Email] BREVO_API_KEY not configured. Add it from Brevo dashboard → Senders & IPs → SMTP & API → API Keys.');
    return { success: false, error: 'BREVO_API_KEY not configured' };
  }
  if (!to) {
    return { success: false, error: 'No recipient' };
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'hello@zaptext.shop';
  const senderName = process.env.BREVO_SENDER_NAME || 'ZapText';
  // Single-mailbox setup: replies route back to the same hello@ inbox
  // by default, so the customer's reply lands in the mailbox the email
  // came from. Override with BREVO_REPLY_TO_EMAIL if you ever want
  // replies routed elsewhere.
  const replyToEmail = process.env.BREVO_REPLY_TO_EMAIL || senderEmail;
  const safeSubject = sanitizeSubject(subject);

  // Brevo's transactional send endpoint expects a different body shape
  // than ZeptoMail: `sender` (not `from`), `htmlContent` (not `htmlbody`),
  // `to` is a flat array of {email, name}, attachments use `attachment`
  // (singular) array with {name, content} fields. Get any of these wrong
  // and Brevo returns 400.
  const body: Record<string, unknown> = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: to, name: toName || to }],
    replyTo: { email: replyToEmail, name: senderName },
    subject: safeSubject,
    htmlContent: html,
  };
  if (attachments && attachments.length > 0) {
    body.attachment = attachments.map((a) => ({
      name: a.filename,
      content: a.content,
    }));
  }

  // Retry on transient (5xx/429) failures. Booking notifications are
  // critical — a single provider blip used to drop them silently. Worst
  // case wall-clock under ~5.5s so we don't blow webhook latency budgets.
  const MAX_ATTEMPTS = 3;
  const BASE_DELAY_MS = 750;
  console.log(`[Email] Sending to ${to} | Subject: ${safeSubject} | From: ${senderName} <${senderEmail}> | Reply-To: ${replyToEmail}`);

  let lastError = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(BREVO_API_URL, {
        method: 'POST',
        headers: {
          // Brevo uses a custom `api-key` header (NOT `Authorization`).
          'api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const result = await res.json().catch(() => ({})) as Record<string, unknown>;
        // Brevo returns `messageId` on 201 Created.
        console.log(`[Email] Sent to ${to} | ID: ${result.messageId || 'ok'}${attempt > 1 ? ` (attempt ${attempt})` : ''}`);
        await recordEmailAttempt({
          toEmail: to,
          subject: safeSubject,
          status: 'sent',
          attemptCount: attempt,
        });
        return { success: true };
      }

      const errorData = await res.text();
      lastError = `${res.status} ${errorData}`.slice(0, 500);
      console.error(`[Email] Brevo error (${res.status}, attempt ${attempt}/${MAX_ATTEMPTS}):`, errorData);
      if (res.status === 401) {
        console.error('[Email] Invalid BREVO_API_KEY — check Brevo dashboard → Senders & IPs → SMTP & API → API Keys.');
      }
      if (res.status === 400) {
        console.error(`[Email] Bad request — verify ${senderEmail} is added as a verified sender in Brevo (Senders & IPs → Senders).`);
      }
      if (!isRetryableStatus(res.status) || attempt === MAX_ATTEMPTS) {
        await recordEmailAttempt({
          toEmail: to,
          subject: safeSubject,
          status: 'failed',
          attemptCount: attempt,
          lastError,
        });
        return { success: false, error: lastError };
      }
    } catch (error) {
      // Network errors are retryable.
      lastError = String(error).slice(0, 500);
      console.error(`[Email] Network/send error (attempt ${attempt}/${MAX_ATTEMPTS}):`, error);
      if (attempt === MAX_ATTEMPTS) {
        await recordEmailAttempt({
          toEmail: to,
          subject: safeSubject,
          status: 'failed',
          attemptCount: attempt,
          lastError,
        });
        return { success: false, error: lastError };
      }
    }

    // Exponential backoff with light jitter: ~750ms, ~1500ms, ~3000ms.
    const delay = BASE_DELAY_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
    await sleep(delay);
  }
  await recordEmailAttempt({
    toEmail: to,
    subject: safeSubject,
    status: 'failed',
    attemptCount: MAX_ATTEMPTS,
    lastError: lastError || 'Email send failed',
  });
  return { success: false, error: lastError || 'Email send failed' };
}

// ─── Template Wrapper ───
//
// Modern transactional email shell. Table-based layout for max email-
// client compatibility (Outlook desktop in particular ignores most
// flex/grid + half of modern CSS). Brand strip + clean white body +
// muted footer. Single brand colour token (`BRAND`) so a re-skin is
// one constant change. System font stack — no @font-face dance.
//
// Constraints we deliberately accept:
//   • Inline styles only (no <style> blocks survive Gmail clipping).
//   • Max width 600px (Outlook narrowest reliable column).
//   • No background-image (Outlook strips them).
//   • CTA is a bulletproof MSO-conditional button so it renders in
//     Outlook 2007-2019 as a real rectangle, not naked anchor text.

const BRAND_INK   = '#0E0E0C';     // headlines / strong text
const BRAND_MUTE  = '#6F6A5F';     // captions / labels
const BRAND_LINE  = '#E8E1C8';     // dividers / borders
const BRAND_PAGE  = '#F8F4E3';     // outer page bg (cream)
const BRAND_CARD  = '#FFFFFF';     // card bg
const BRAND_GREEN_DARK = '#1A8A47';// CTA button (better contrast than pure green)

function wrap(title: string, body: string, ctaUrl?: string, ctaLabel?: string): string {
  const ctaButton = ctaUrl && ctaLabel ? `
    <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="margin:8px auto 4px;">
      <tr>
        <td align="center" bgcolor="${BRAND_GREEN_DARK}" style="border-radius:10px;">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${ctaUrl}" style="height:44px;v-text-anchor:middle;width:240px;" arcsize="23%" stroke="f" fillcolor="${BRAND_GREEN_DARK}">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;font-size:14px;font-weight:600;">${ctaLabel}</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <a href="${ctaUrl}" style="display:inline-block;background:${BRAND_GREEN_DARK};color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:10px;font-weight:600;font-size:14px;letter-spacing:0.01em;line-height:1;">${ctaLabel}</a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>
  ` : '';
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:${BRAND_PAGE};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND_INK};-webkit-font-smoothing:antialiased;">
<!-- preheader: hidden text that shows up next to subject line in Gmail/Inbox previews -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${BRAND_PAGE};opacity:0;">
  ${title} · ZapText
</div>

<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="${BRAND_PAGE}" style="background:${BRAND_PAGE};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;">

        <!-- Wordmark strip — actual brand logo image (served from
             /public/logo.png on production). Absolute URL is mandatory
             in email; relative paths won't resolve in any client. The
             URL falls back to www.zaptext.shop when NEXT_PUBLIC_APP_URL
             isn't set so a build before-env-was-configured can't break
             the header. -->
        <tr>
          <td style="padding:0 4px 18px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://www.zaptext.shop'}" style="text-decoration:none;display:inline-block;">
              <img src="${process.env.NEXT_PUBLIC_APP_URL || 'https://www.zaptext.shop'}/logo.png" alt="Zaptext.shop" width="200" height="52" style="display:block;border:0;outline:none;width:200px;height:auto;max-width:220px;" />
            </a>
          </td>
        </tr>

        <!-- Card -->
        <tr>
          <td bgcolor="${BRAND_CARD}" style="background:${BRAND_CARD};border:1px solid ${BRAND_LINE};border-radius:14px;padding:32px 32px 28px;">

            <!-- Title -->
            <h1 style="margin:0 0 18px;font-size:22px;font-weight:700;line-height:1.3;letter-spacing:-0.01em;color:${BRAND_INK};">${title}</h1>

            <!-- Body -->
            <div style="font-size:14.5px;line-height:1.65;color:${BRAND_INK};">
              ${body}
            </div>

            ${ctaButton ? `
            <!-- CTA -->
            <div style="margin-top:24px;">
              ${ctaButton}
            </div>` : ''}

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:22px 8px 4px;text-align:center;font-size:12px;color:${BRAND_MUTE};line-height:1.6;">
            <div style="font-weight:600;color:${BRAND_INK};margin-bottom:4px;">ZapText</div>
            AI WhatsApp bots for every business<br>
            <a href="https://www.zaptext.shop" style="color:${BRAND_MUTE};text-decoration:underline;">zaptext.shop</a>
          </td>
        </tr>

        <tr>
          <td style="padding:14px 8px 0;text-align:center;font-size:11px;color:${BRAND_MUTE};line-height:1.5;">
            You're receiving this because you own a ZapText bot. Replies come to a real person — just hit reply.
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body></html>
  `.trim();
}

// Escape user-controlled strings before injecting into email HTML.
// Prevents stored-XSS via business names, customer notes, error messages, etc.
function esc(s: string | number | undefined | null): string {
  if (s === undefined || s === null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Information box — clean table row layout. Label on the left in muted
// caps, value on the right in regular weight. Used inside `wrap`'s body
// slot to render structured order / booking / payment details.
function infoBox(rows: Array<{ label: string; value: string }>): string {
  const items = rows
    .map(
      (r) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid ${BRAND_LINE};font-size:11.5px;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND_MUTE};font-weight:600;width:38%;vertical-align:top;">${esc(r.label)}</td>
      <td style="padding:10px 0;border-bottom:1px solid ${BRAND_LINE};font-size:14px;color:${BRAND_INK};vertical-align:top;">${esc(r.value)}</td>
    </tr>`
    )
    .join('');
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:18px 0 4px;border-top:1px solid ${BRAND_LINE};">${items}</table>`;
}

// ─── OWNER EMAILS ───

export function tplNewBooking(p: { ownerName: string; businessName: string; customerName: string; customerPhone: string; date: string; time: string; service?: string; }) {
  const body = `
    <p>Hi <strong>${esc(p.ownerName)}</strong>,</p>
    <p>A new booking just came in via your WhatsApp bot for <strong>${esc(p.businessName)}</strong>.</p>
    ${infoBox([
      { label: 'Customer', value: p.customerName },
      { label: 'Phone', value: p.customerPhone },
      { label: 'Date', value: p.date },
      { label: 'Time', value: p.time },
      ...(p.service ? [{ label: 'Service', value: p.service }] : []),
    ])}
  `;
  return { subject: `New booking at ${p.businessName} — ${p.date} ${p.time}`, html: wrap('New Booking', body, `${process.env.NEXT_PUBLIC_APP_URL}/client/bookings`, 'View Booking') };
}

export function tplBookingCancelled(p: { ownerName: string; businessName: string; customerName: string; date: string; time: string; }) {
  const body = `
    <p>Hi <strong>${esc(p.ownerName)}</strong>,</p>
    <p>A booking at <strong>${esc(p.businessName)}</strong> was cancelled.</p>
    ${infoBox([
      { label: 'Customer', value: p.customerName },
      { label: 'Date', value: p.date },
      { label: 'Time', value: p.time },
    ])}
    <p>This slot is now available again.</p>
  `;
  return { subject: `Booking cancelled — ${p.date} ${p.time}`, html: wrap('Booking Cancelled', body, `${process.env.NEXT_PUBLIC_APP_URL}/client/bookings`, 'View Bookings') };
}

export function tplDailyMorningSummary(p: { ownerName: string; businessName: string; date: string; bookings: Array<{ time: string; customer: string; service?: string }>; }) {
  const list = p.bookings.length === 0
    ? '<p style="color:#5a6b5d;">No bookings today. Enjoy a free day!</p>'
    : `<ul style="padding-left:20px;margin:12px 0;">${p.bookings.map((b) => `<li style="margin-bottom:6px;"><strong>${esc(b.time)}</strong> — ${esc(b.customer)}${b.service ? ` (${esc(b.service)})` : ''}</li>`).join('')}</ul>`;
  const body = `
    <p>Good morning <strong>${esc(p.ownerName)}</strong>!</p>
    <p>Here&apos;s your day at <strong>${esc(p.businessName)}</strong> (${esc(p.date)}):</p>
    ${list}
  `;
  return { subject: `Today's bookings at ${p.businessName} — ${p.bookings.length} scheduled`, html: wrap("Today's Schedule", body, `${process.env.NEXT_PUBLIC_APP_URL}/client/calendar`, 'View Calendar') };
}

// Restaurant new-order alert — fired the moment a customer places an
// order (web menu link, QR-scan dine-in, or AI [ORDER:] tag). Lands in
// the owner's inbox with full item list, mode (delivery/dine-in/take-
// away), customer phone + address/table so they can acknowledge from
// either email or the dashboard.
export function tplNewOrder(p: {
  ownerName: string;
  businessName: string;
  orderId: string;
  mode: 'dine_in' | 'home_delivery' | 'parcel_takeaway';
  customerName: string;
  customerPhone: string;
  tableNumber?: string;
  deliveryAddress?: string;
  notes?: string;
  items: Array<{ name: string; qty: number; price: number }>;
  total: number;
  source: 'menu_link' | 'qr_dine_in' | 'whatsapp_chat';
}) {
  const modeLabel =
    p.mode === 'dine_in' ? `🍽️ Dine-in${p.tableNumber ? ` · Table ${esc(p.tableNumber)}` : ''}`
    : p.mode === 'home_delivery' ? '🛵 Delivery'
    : '🛍️ Takeaway';
  const sourceLabel =
    p.source === 'menu_link' ? 'Web menu link'
    : p.source === 'qr_dine_in' ? 'QR-scan dine-in'
    : 'WhatsApp chat';

  const itemRows = p.items
    .map((it) => `
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:8px 4px;">${esc(it.name)}</td>
        <td style="padding:8px 4px;text-align:right;color:#666;">× ${it.qty}</td>
        <td style="padding:8px 4px;text-align:right;font-weight:500;">₹${(it.price * it.qty).toFixed(0)}</td>
      </tr>`)
    .join('');

  // DPDPA 2023 §8(5) "reasonable security safeguards" + §6 purpose
  // limitation: email is a low-control channel (forwarded, archived,
  // searched). Surface enough for the owner to recognise the order in
  // dashboard, but NOT enough to act on it from email alone — the
  // dashboard link below is the source of truth for customer PII. We
  // ship last-4 of phone and a "see dashboard" stub for the address,
  // not the full values.
  const phoneDigits = (p.customerPhone || '').replace(/\D/g, '');
  const maskedPhone = phoneDigits.length >= 4
    ? `••• ${phoneDigits.slice(-4)}`
    : '•••';

  // infoBox runs esc() on every value, so we pass PLAIN TEXT here.
  // Pre-escaping (e.g. ${esc(...)}) would double-escape; HTML wrappers
  // do not survive — they render as visible markup in the inbox
  // (caught a literal "<span style=...>" appearing in a customer
  // demo email after the Phase-0 PII-minimisation work).
  const detailRows: Array<{ label: string; value: string }> = [
    { label: 'Mode', value: modeLabel },
    { label: 'Customer', value: `${p.customerName || 'Unknown'} (${maskedPhone})` },
  ];
  if (p.mode === 'home_delivery' && p.deliveryAddress) {
    detailRows.push({
      label: 'Delivery to',
      value: 'Address available in dashboard →',
    });
  }
  if (p.notes) {
    detailRows.push({ label: 'Notes', value: p.notes });
  }
  detailRows.push({ label: 'Source', value: sourceLabel });
  detailRows.push({ label: 'Order ID', value: p.orderId });

  const body = `
    <p>Hi <strong>${esc(p.ownerName)}</strong>,</p>
    <p><strong>New order</strong> at <strong>${esc(p.businessName)}</strong> — ${modeLabel}</p>
    ${infoBox(detailRows)}
    <h3 style="margin:20px 0 8px;font-size:15px;color:#1a1a1a;">Items</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr style="border-top:2px solid #ddd;">
          <td style="padding:10px 4px;font-weight:600;">Total</td>
          <td></td>
          <td style="padding:10px 4px;text-align:right;font-weight:700;font-size:16px;">₹${p.total.toFixed(0)}</td>
        </tr>
      </tfoot>
    </table>
    <p style="margin-top:16px;color:#5a6b5d;font-size:13px;">Tap the button below to acknowledge and update status — the customer gets a WhatsApp ping on every status change.</p>
  `;
  return {
    subject: `🆕 New order at ${p.businessName} — ₹${p.total.toFixed(0)} · ${modeLabel}`,
    html: wrap('New Order', body, `${process.env.NEXT_PUBLIC_APP_URL}/client/restaurant/orders`, 'View Order'),
  };
}

// Restaurant low-stock daily digest — fired by /api/cron/low-stock-alerts
// in the morning bucket. Lists every menu item where stock <=
// low_stock_threshold so the owner can re-stock before the lunch rush.
// Items list is rendered as a compact table for scannability.
export function tplLowStock(p: {
  ownerName: string;
  businessName: string;
  date: string;
  items: Array<{ name: string; stock: number; threshold: number }>;
}) {
  const rows = p.items
    .map((it) => {
      const danger = it.stock === 0 || it.stock <= it.threshold / 2;
      const stockColor = it.stock === 0 ? '#c0392b' : danger ? '#e67e22' : '#666';
      return `
        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:8px 4px;font-weight:500;">${esc(it.name)}</td>
          <td style="padding:8px 4px;text-align:right;color:${stockColor};font-weight:600;">${it.stock} left</td>
          <td style="padding:8px 4px;text-align:right;color:#999;font-size:13px;">alert at ${it.threshold}</td>
        </tr>`;
    })
    .join('');
  const body = `
    <p>Good morning <strong>${esc(p.ownerName)}</strong>,</p>
    <p><strong>${p.items.length} item${p.items.length === 1 ? '' : 's'}</strong> at <strong>${esc(p.businessName)}</strong> ${p.items.length === 1 ? 'is' : 'are'} below your alert threshold this morning (${esc(p.date)}):</p>
    <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:14px;">
      <thead>
        <tr style="border-bottom:2px solid #ddd;color:#5a6b5d;text-align:left;">
          <th style="padding:8px 4px;font-weight:600;">Item</th>
          <th style="padding:8px 4px;text-align:right;font-weight:600;">Stock</th>
          <th style="padding:8px 4px;text-align:right;font-weight:600;">Threshold</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin-top:16px;color:#5a6b5d;font-size:13px;">Re-stock or temporarily mark items unavailable in your inventory dashboard before the lunch rush.</p>
  `;
  return {
    subject: `⚠️ ${p.businessName} — ${p.items.length} item${p.items.length === 1 ? '' : 's'} low on stock`,
    html: wrap('Low stock alert', body, `${process.env.NEXT_PUBLIC_APP_URL}/client/inventory`, 'Update Inventory'),
  };
}

export function tplDailyEveningSummary(p: { ownerName: string; businessName: string; tomorrowDate: string; bookings: Array<{ time: string; customer: string; service?: string }>; }) {
  const list = p.bookings.length === 0
    ? '<p style="color:#5a6b5d;">No bookings tomorrow yet.</p>'
    : `<ul style="padding-left:20px;margin:12px 0;">${p.bookings.map((b) => `<li style="margin-bottom:6px;"><strong>${esc(b.time)}</strong> — ${esc(b.customer)}${b.service ? ` (${esc(b.service)})` : ''}</li>`).join('')}</ul>`;
  const body = `
    <p>Hi <strong>${esc(p.ownerName)}</strong>,</p>
    <p>Tomorrow at <strong>${esc(p.businessName)}</strong> (${esc(p.tomorrowDate)}):</p>
    ${list}
    <p>Good night!</p>
  `;
  return { subject: `Tomorrow at ${p.businessName} — ${p.bookings.length} bookings`, html: wrap("Tomorrow's Bookings", body, `${process.env.NEXT_PUBLIC_APP_URL}/client/calendar`, 'View Calendar') };
}

// ─── CUSTOMER EMAILS ───

export function tplCustomerReminder(p: { customerName: string; businessName: string; date: string; time: string; service?: string; address?: string; }) {
  const body = `
    <p>Hi <strong>${esc(p.customerName)}</strong>,</p>
    <p>This is a reminder for your appointment tomorrow at <strong>${esc(p.businessName)}</strong>.</p>
    ${infoBox([
      { label: 'Date', value: p.date },
      { label: 'Time', value: p.time },
      ...(p.service ? [{ label: 'Service', value: p.service }] : []),
      ...(p.address ? [{ label: 'Address', value: p.address }] : []),
    ])}
    <p>See you tomorrow!</p>
  `;
  return { subject: `Reminder: Your appointment at ${p.businessName} tomorrow`, html: wrap('Appointment Reminder', body) };
}

// ─── ADMIN EMAILS ───

export function tplAdminNewSignup(p: { name: string; email: string; }) {
  const body = `
    <p>A new user just signed up:</p>
    ${infoBox([
      { label: 'Name', value: p.name },
      { label: 'Email', value: p.email },
    ])}
  `;
  return { subject: `New signup: ${p.name}`, html: wrap('New User Signup', body, `${process.env.NEXT_PUBLIC_APP_URL}/admin/dashboard`, 'View Admin') };
}

export function tplAdminNewBot(p: { businessName: string; type: string; ownerName: string; ownerEmail: string; }) {
  const body = `
    <p>A new bot was created:</p>
    ${infoBox([
      { label: 'Business', value: p.businessName },
      { label: 'Type', value: p.type },
      { label: 'Owner', value: `${p.ownerName} (${p.ownerEmail})` },
    ])}
  `;
  // Subject is plain text (not HTML) so ZeptoMail escaping handles it;
  // still pass through as-is — the XSS vector was the HTML body above,
  // which is now fully escaped by esc() in infoBox.
  return { subject: `New bot created: ${p.businessName}`, html: wrap('New Bot Created', body, `${process.env.NEXT_PUBLIC_APP_URL}/admin/clients`, 'View Clients') };
}

export function tplAdminNewSubscription(p: { ownerName: string; ownerEmail: string; plan: string; amount: number; }) {
  const body = `
    <p>New subscription payment received:</p>
    ${infoBox([
      { label: 'Customer', value: `${p.ownerName} (${p.ownerEmail})` },
      { label: 'Plan', value: p.plan },
      { label: 'Amount', value: `Rs.${p.amount.toLocaleString('en-IN')}` },
    ])}
  `;
  return { subject: `New subscription: ${p.plan} from ${p.ownerName}`, html: wrap('New Subscription', body, `${process.env.NEXT_PUBLIC_APP_URL}/admin/revenue`, 'View Revenue') };
}

export function tplAdminFailedPayment(p: { ownerName: string; ownerEmail: string; plan: string; reason: string; }) {
  const body = `
    <p>A payment failed:</p>
    ${infoBox([
      { label: 'Customer', value: `${p.ownerName} (${p.ownerEmail})` },
      { label: 'Plan', value: p.plan },
      { label: 'Reason', value: p.reason },
    ])}
  `;
  return { subject: `Payment failed: ${p.ownerName}`, html: wrap('Payment Failed', body) };
}

export function tplAdminBotError(p: { businessName: string; errorMessage: string; }) {
  const body = `
    <p>An error occurred for bot <strong>${esc(p.businessName)}</strong>:</p>
    <pre style="background:#F3EDE3;padding:12px;border-radius:6px;font-size:12px;overflow-x:auto;">${esc(p.errorMessage)}</pre>
  `;
  return { subject: `Bot error: ${p.businessName}`, html: wrap('Bot Error', body) };
}

// 7-day expiry heads-up. Sent once when end_date crosses inside the
// 7-day window — gives the owner time to renew before the bot goes
// silent. The cron records last_warned_period='7d' so this template
// doesn't fire daily for the same subscription.
export function tplSubscriptionExpiringSoon(p: {
  ownerName: string;
  businessName: string;
  plan: string;
  endDate: string;
  daysLeft: number;
}) {
  const body = `
    <p>Hi ${esc(p.ownerName)},</p>
    <p>Heads up — your <strong>${esc(p.businessName)}</strong> bot's subscription is ending in <strong>${p.daysLeft} day${p.daysLeft === 1 ? '' : 's'}</strong>.</p>
    ${infoBox([
      { label: 'Plan', value: p.plan },
      { label: 'Expires', value: p.endDate },
    ])}
    <p>If you renew before then, there's no interruption — the bot keeps replying to customers normally. After the end date the bot goes offline and customers get a polite "we'll be in touch" message instead of an AI response.</p>
    <p>Renew with one click from your dashboard.</p>
  `;
  return {
    subject: `Renewal reminder: ${p.businessName} bot expires in ${p.daysLeft} day${p.daysLeft === 1 ? '' : 's'}`,
    html: wrap('Subscription Expiring Soon', body, `${process.env.NEXT_PUBLIC_APP_URL}/client/subscription`, 'Renew Now'),
  };
}

// 1-day final warning. Sent once when end_date is within 24h. After
// this fires the cron sets last_warned_period='1d' (final state until
// renewal). If the owner doesn't renew they'll see the bot go offline
// the next morning — at that point the webhook hot-path returns the
// canned "subscription expired" reply for any new customer message.
export function tplSubscriptionExpiringTomorrow(p: {
  ownerName: string;
  businessName: string;
  plan: string;
  endDate: string;
}) {
  const body = `
    <p>Hi ${esc(p.ownerName)},</p>
    <p><strong>Final reminder</strong> — your <strong>${esc(p.businessName)}</strong> bot's subscription expires within 24 hours.</p>
    ${infoBox([
      { label: 'Plan', value: p.plan },
      { label: 'Expires', value: p.endDate },
    ])}
    <p>Renew now to keep the bot replying to customers without interruption. After the expiry timestamp, new customer messages will get a polite offline reply until you renew.</p>
  `;
  return {
    subject: `Last day: ${p.businessName} bot subscription expires in 24h`,
    html: wrap('Subscription Expires Tomorrow', body, `${process.env.NEXT_PUBLIC_APP_URL}/client/subscription`, 'Renew Now'),
  };
}

// ─── SUBSCRIPTION LIFECYCLE EMAILS ───

export function tplWelcome(p: { name: string; }) {
  const body = `
    <p>Welcome <strong>${esc(p.name)}</strong>!</p>
    <p>You&apos;re all set to create your first AI-powered WhatsApp bot. Here&apos;s what to do next:</p>
    <ol style="padding-left:20px;line-height:1.8;">
      <li>Create your first bot from the dashboard</li>
      <li>Fill in your business details (or auto-fill from your own website)</li>
      <li>Test with sample messages</li>
      <li>Share your WhatsApp number with customers</li>
    </ol>
    <p>Let us know if you need help — just reply to this email.</p>
  `;
  return { subject: `Welcome to ZapText, ${p.name}!`, html: wrap('Welcome to ZapText', body, `${process.env.NEXT_PUBLIC_APP_URL}/client/create-bot`, 'Create Your First Bot') };
}

export function tplSubscriptionStarted(p: { name: string; plan: string; amount: number; nextBilling: string; }) {
  const body = `
    <p>Hi <strong>${esc(p.name)}</strong>,</p>
    <p>Your <strong>${esc(p.plan)}</strong> subscription is now active.</p>
    ${infoBox([
      { label: 'Plan', value: p.plan },
      { label: 'Amount', value: `Rs.${p.amount.toLocaleString('en-IN')} / month` },
      { label: 'Next Billing', value: p.nextBilling },
    ])}
    <p>Thanks for subscribing!</p>
  `;
  return { subject: `${p.plan} subscription activated`, html: wrap('Subscription Active', body, `${process.env.NEXT_PUBLIC_APP_URL}/client/subscription`, 'View Subscription') };
}

export function tplTrialEndingSoon(p: { name: string; daysLeft: number; }) {
  const body = `
    <p>Hi <strong>${esc(p.name)}</strong>,</p>
    <p>Your free trial ends in <strong>${esc(p.daysLeft)} day${p.daysLeft !== 1 ? 's' : ''}</strong>.</p>
    <p>To keep your bots active, upgrade to a paid plan now. Plans start at Rs.999/month.</p>
  `;
  return { subject: `Trial ending in ${p.daysLeft} days — upgrade to keep bots active`, html: wrap('Trial Ending Soon', body, `${process.env.NEXT_PUBLIC_APP_URL}/client/subscription`, 'Choose a Plan') };
}

export function tplRenewalReminder(p: { name: string; plan: string; amount: number; renewalDate: string; }) {
  const body = `
    <p>Hi <strong>${esc(p.name)}</strong>,</p>
    <p>Your <strong>${esc(p.plan)}</strong> subscription will auto-renew on <strong>${esc(p.renewalDate)}</strong>.</p>
    ${infoBox([
      { label: 'Plan', value: p.plan },
      { label: 'Amount', value: `Rs.${p.amount.toLocaleString('en-IN')}` },
      { label: 'Renewal Date', value: p.renewalDate },
    ])}
    <p>No action needed if you&apos;d like to continue.</p>
  `;
  return { subject: `Subscription renewing on ${p.renewalDate}`, html: wrap('Renewal Reminder', body, `${process.env.NEXT_PUBLIC_APP_URL}/client/subscription`, 'Manage Subscription') };
}

export function tplPaymentFailed(p: { name: string; plan: string; reason?: string; }) {
  const body = `
    <p>Hi <strong>${esc(p.name)}</strong>,</p>
    <p>We couldn&apos;t process your payment for the <strong>${esc(p.plan)}</strong> plan.</p>
    ${p.reason ? `<p style="color:#dc2626;">Reason: ${esc(p.reason)}</p>` : ''}
    <p>Please update your payment method to keep your bots active.</p>
  `;
  return { subject: `Payment failed — action needed`, html: wrap('Payment Failed', body, `${process.env.NEXT_PUBLIC_APP_URL}/client/subscription`, 'Update Payment') };
}

// ─── TEAM-MEMBER INVITE ───

// Sent to the email address an owner adds in Team Members → Invite/Swap.
// The invitee signs in to ZapText with this exact email (Clerk passwordless
// or Google) and ZapText auto-promotes their row from 'invited' → 'active'
// on first successful login (see findActiveMembershipForEmail in
// lib/db/team-members.ts). The CTA points at /sign-in so they land in
// Clerk's auth flow immediately.
export function tplTeamInvite(p: {
  inviteeEmail: string;
  businessName: string;
  outletName: string;
  invitedByEmail: string;
  role: 'outlet_manager' | 'staff';
}) {
  const roleLabel = p.role === 'outlet_manager' ? 'Outlet manager' : 'Staff';
  const body = `
    <p>Hi,</p>
    <p><strong>${esc(p.invitedByEmail)}</strong> has invited you to manage
    <strong>${esc(p.outletName)}</strong> on the <strong>${esc(p.businessName)}</strong>
    ZapText dashboard as <strong>${esc(roleLabel)}</strong>.</p>
    ${infoBox([
      { label: 'Business', value: p.businessName },
      { label: 'Outlet', value: p.outletName },
      { label: 'Role', value: roleLabel },
      { label: 'Your login email', value: p.inviteeEmail },
    ])}
    <p>Click the button below to sign in with <strong>${esc(p.inviteeEmail)}</strong>.
    Your access activates automatically on first sign-in.</p>
    <p style="color:#5a6b5d;font-size:13px;margin-top:18px;">If you weren't
    expecting this invite, you can safely ignore this email — no account is
    created until you sign in.</p>
  `;
  return {
    subject: `You're invited to manage ${p.outletName} on ZapText`,
    html: wrap(
      'Team invite',
      body,
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://zaptext.shop'}/sign-in`,
      'Sign in to ZapText'
    ),
  };
}

// ─── Helper: send via Brevo with template ───

export async function sendTemplate(
  to: string,
  template: { subject: string; html: string },
  toName?: string,
  attachments?: EmailAttachment[]
) {
  return sendEmail({ to, toName, subject: template.subject, html: template.html, attachments });
}

// Legacy compat exports for old code
export function bookingConfirmationEmail(p: { customerName: string; businessName: string; date: string; time: string; endTime: string; service?: string; }): string {
  return tplNewBooking({
    ownerName: 'there',
    businessName: p.businessName,
    customerName: p.customerName,
    customerPhone: '',
    date: p.date,
    time: `${p.time}${p.endTime ? ` - ${p.endTime}` : ''}`,
    service: p.service,
  }).html;
}

export function bookingReminderEmail(p: { customerName: string; businessName: string; date: string; time: string; }): string {
  return tplCustomerReminder(p).html;
}
