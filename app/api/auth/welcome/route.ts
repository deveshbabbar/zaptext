import { NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { sendTemplate, tplWelcome, tplAdminNewSignup } from '@/lib/email';
import { cookies } from 'next/headers';

export async function POST() {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const store = await cookies();
  if (store.get('welcomed')?.value === '1') {
    return NextResponse.json({ alreadySent: true });
  }

  let emailSent = false;

  // Welcome email to user
  if (user.email) {
    console.log(`[Welcome] Sending welcome email to ${user.email}`);
    const result = await sendTemplate(user.email, tplWelcome({ name: user.name || 'there' }), user.name);
    if (result.success) {
      emailSent = true;
      console.log(`[Welcome] Welcome email sent successfully to ${user.email}`);
    } else {
      console.error(`[Welcome] Failed to send welcome email to ${user.email}:`, result.error);
    }
  }

  // Admin notification
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const adminResult = await sendTemplate(adminEmail, tplAdminNewSignup({ name: user.name || 'Unknown', email: user.email }));
    if (!adminResult.success) {
      console.error(`[Welcome] Failed to send admin notification:`, adminResult.error);
    }
  }

  // Only set cookie if email was actually sent — so it retries next time if it failed
  if (emailSent) {
    store.set('welcomed', '1', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });
  }

  return NextResponse.json({ success: emailSent, emailSent });
}
