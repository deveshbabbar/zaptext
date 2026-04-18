// Resend email integration
// Free tier: 3,000 emails/month
// Get API key from: https://resend.com/api-keys

const RESEND_API_URL = 'https://api.resend.com/emails';

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

export async function sendEmail({ to, toName, subject, html, attachments }: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[Email] RESEND_API_KEY not configured. Get your key from https://resend.com/api-keys');
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }
  if (!to) {
    return { success: false, error: 'No recipient' };
  }

  // Resend free tier uses "onboarding@resend.dev" as sender
  // To use custom domain, add & verify domain at https://resend.com/domains
  const senderEmail = process.env.RESEND_SENDER_EMAIL || 'onboarding@resend.dev';
  const senderName = process.env.RESEND_SENDER_NAME || 'ZapText';

  try {
    console.log(`[Email] Sending to ${to} | Subject: ${subject} | Sender: ${senderName} <${senderEmail}>`);

    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${senderName} <${senderEmail}>`,
        to: [to],
        subject,
        html,
        ...(attachments && attachments.length > 0
          ? {
              attachments: attachments.map((a) => ({
                filename: a.filename,
                content: a.content,
                ...(a.contentType ? { content_type: a.contentType } : {}),
              })),
            }
          : {}),
      }),
    });

    if (!res.ok) {
      const errorData = await res.text();
      console.error(`[Email] Resend API error (${res.status}):`, errorData);
      if (res.status === 401) {
        console.error('[Email] Invalid RESEND_API_KEY. Check your key at https://resend.com/api-keys');
      }
      if (res.status === 403) {
        console.error('[Email] Sender domain not verified. Free tier must use "onboarding@resend.dev". For custom domain, verify at https://resend.com/domains');
      }
      return { success: false, error: errorData };
    }

    const result = await res.json();
    console.log(`[Email] Successfully sent to ${to} | ID: ${result.id}`);
    return { success: true };
  } catch (error) {
    console.error('[Email] Network/send error:', error);
    return { success: false, error: String(error) };
  }
}

// ─── Template Wrapper ───

function wrap(title: string, body: string, ctaUrl?: string, ctaLabel?: string): string {
  return `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F3EDE3;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;color:#1a2e1d;">
<div style="max-width:560px;margin:24px auto;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #e5dcc8;">
  <div style="background:linear-gradient(135deg,#1a2e1d 0%,#1a5d47 100%);color:#FAF7F2;padding:28px 24px;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
      <div style="width:36px;height:36px;border-radius:8px;background:#25D366;color:#1a2e1d;display:inline-flex;align-items:center;justify-content:center;font-weight:700;">Z</div>
      <strong style="font-size:18px;">ZapText</strong>
    </div>
    <h1 style="margin:0;font-size:22px;font-weight:700;letter-spacing:-0.01em;">${title}</h1>
  </div>
  <div style="padding:24px;line-height:1.6;font-size:14px;color:#1a2e1d;">
    ${body}
    ${ctaUrl && ctaLabel ? `
    <div style="margin-top:24px;text-align:center;">
      <a href="${ctaUrl}" style="display:inline-block;background:#1a5d47;color:#FAF7F2;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;">${ctaLabel}</a>
    </div>` : ''}
  </div>
  <div style="padding:16px 24px;background:#FAF7F2;border-top:1px solid #e5dcc8;font-size:12px;color:#5a6b5d;text-align:center;">
    ZapText · AI WhatsApp bots for every business
  </div>
</div>
</body></html>
  `.trim();
}

function infoBox(rows: Array<{ label: string; value: string }>): string {
  const items = rows.map((r) => `<div style="margin-bottom:8px;"><strong>${r.label}:</strong> ${r.value}</div>`).join('');
  return `<div style="background:#F3EDE3;border-radius:8px;padding:14px 16px;margin:16px 0;">${items}</div>`;
}

// ─── OWNER EMAILS ───

export function tplNewBooking(p: { ownerName: string; businessName: string; customerName: string; customerPhone: string; date: string; time: string; service?: string; }) {
  const body = `
    <p>Hi <strong>${p.ownerName}</strong>,</p>
    <p>A new booking just came in via your WhatsApp bot for <strong>${p.businessName}</strong>.</p>
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
    <p>Hi <strong>${p.ownerName}</strong>,</p>
    <p>A booking at <strong>${p.businessName}</strong> was cancelled.</p>
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
    : `<ul style="padding-left:20px;margin:12px 0;">${p.bookings.map((b) => `<li style="margin-bottom:6px;"><strong>${b.time}</strong> — ${b.customer}${b.service ? ` (${b.service})` : ''}</li>`).join('')}</ul>`;
  const body = `
    <p>Good morning <strong>${p.ownerName}</strong>!</p>
    <p>Here&apos;s your day at <strong>${p.businessName}</strong> (${p.date}):</p>
    ${list}
  `;
  return { subject: `Today's bookings at ${p.businessName} — ${p.bookings.length} scheduled`, html: wrap("Today's Schedule", body, `${process.env.NEXT_PUBLIC_APP_URL}/client/calendar`, 'View Calendar') };
}

export function tplDailyEveningSummary(p: { ownerName: string; businessName: string; tomorrowDate: string; bookings: Array<{ time: string; customer: string; service?: string }>; }) {
  const list = p.bookings.length === 0
    ? '<p style="color:#5a6b5d;">No bookings tomorrow yet.</p>'
    : `<ul style="padding-left:20px;margin:12px 0;">${p.bookings.map((b) => `<li style="margin-bottom:6px;"><strong>${b.time}</strong> — ${b.customer}${b.service ? ` (${b.service})` : ''}</li>`).join('')}</ul>`;
  const body = `
    <p>Hi <strong>${p.ownerName}</strong>,</p>
    <p>Tomorrow at <strong>${p.businessName}</strong> (${p.tomorrowDate}):</p>
    ${list}
    <p>Good night!</p>
  `;
  return { subject: `Tomorrow at ${p.businessName} — ${p.bookings.length} bookings`, html: wrap("Tomorrow's Bookings", body, `${process.env.NEXT_PUBLIC_APP_URL}/client/calendar`, 'View Calendar') };
}

// ─── CUSTOMER EMAILS ───

export function tplCustomerReminder(p: { customerName: string; businessName: string; date: string; time: string; service?: string; address?: string; }) {
  const body = `
    <p>Hi <strong>${p.customerName}</strong>,</p>
    <p>This is a reminder for your appointment tomorrow at <strong>${p.businessName}</strong>.</p>
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
    <p>An error occurred for bot <strong>${p.businessName}</strong>:</p>
    <pre style="background:#F3EDE3;padding:12px;border-radius:6px;font-size:12px;overflow-x:auto;">${p.errorMessage}</pre>
  `;
  return { subject: `Bot error: ${p.businessName}`, html: wrap('Bot Error', body) };
}

// ─── SUBSCRIPTION LIFECYCLE EMAILS ───

export function tplWelcome(p: { name: string; }) {
  const body = `
    <p>Welcome <strong>${p.name}</strong>!</p>
    <p>You&apos;re all set to create your first AI-powered WhatsApp bot. Here&apos;s what to do next:</p>
    <ol style="padding-left:20px;line-height:1.8;">
      <li>Create your first bot from the dashboard</li>
      <li>Auto-fill from your website (Zomato/Swiggy/Instagram link)</li>
      <li>Test with sample messages</li>
      <li>Share your WhatsApp number with customers</li>
    </ol>
    <p>Let us know if you need help — just reply to this email.</p>
  `;
  return { subject: `Welcome to ZapText, ${p.name}!`, html: wrap('Welcome to ZapText', body, `${process.env.NEXT_PUBLIC_APP_URL}/client/create-bot`, 'Create Your First Bot') };
}

export function tplSubscriptionStarted(p: { name: string; plan: string; amount: number; nextBilling: string; }) {
  const body = `
    <p>Hi <strong>${p.name}</strong>,</p>
    <p>Your <strong>${p.plan}</strong> subscription is now active.</p>
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
    <p>Hi <strong>${p.name}</strong>,</p>
    <p>Your free trial ends in <strong>${p.daysLeft} day${p.daysLeft !== 1 ? 's' : ''}</strong>.</p>
    <p>To keep your bots active, upgrade to a paid plan now. Plans start at Rs.999/month.</p>
  `;
  return { subject: `Trial ending in ${p.daysLeft} days — upgrade to keep bots active`, html: wrap('Trial Ending Soon', body, `${process.env.NEXT_PUBLIC_APP_URL}/client/subscription`, 'Choose a Plan') };
}

export function tplRenewalReminder(p: { name: string; plan: string; amount: number; renewalDate: string; }) {
  const body = `
    <p>Hi <strong>${p.name}</strong>,</p>
    <p>Your <strong>${p.plan}</strong> subscription will auto-renew on <strong>${p.renewalDate}</strong>.</p>
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
    <p>Hi <strong>${p.name}</strong>,</p>
    <p>We couldn&apos;t process your payment for the <strong>${p.plan}</strong> plan.</p>
    ${p.reason ? `<p style="color:#dc2626;">Reason: ${p.reason}</p>` : ''}
    <p>Please update your payment method to keep your bots active.</p>
  `;
  return { subject: `Payment failed — action needed`, html: wrap('Payment Failed', body, `${process.env.NEXT_PUBLIC_APP_URL}/client/subscription`, 'Update Payment') };
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
