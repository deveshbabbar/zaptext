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

  // Welcome email
  if (user.email) {
    await sendTemplate(user.email, tplWelcome({ name: user.name || 'there' }), user.name);
  }
  // Admin notification
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@zaptext.shop';
  await sendTemplate(adminEmail, tplAdminNewSignup({ name: user.name || 'Unknown', email: user.email }));

  store.set('welcomed', '1', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });

  return NextResponse.json({ success: true });
}
