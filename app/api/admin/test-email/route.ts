import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { sendEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  const user = await getUserRole();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const envCheck = {
    ZEPTO_API_KEY: process.env.ZEPTO_API_KEY ? `SET (${process.env.ZEPTO_API_KEY.slice(0, 20)}...)` : 'NOT SET',
    ZEPTO_SENDER_EMAIL: process.env.ZEPTO_SENDER_EMAIL || 'NOT SET',
    ZEPTO_SENDER_NAME: process.env.ZEPTO_SENDER_NAME || 'NOT SET',
  };

  if (!process.env.ZEPTO_API_KEY) {
    return NextResponse.json({
      success: false,
      error: 'ZEPTO_API_KEY not set in Vercel env vars. Add it and redeploy.',
      envCheck,
    }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const to = (typeof body.to === 'string' && body.to) || user.email;

    const result = await sendEmail({
      to,
      toName: 'Test',
      subject: '🧪 ZeptoMail Test — ZapText',
      html: `
        <h2>✅ ZeptoMail is working!</h2>
        <p>This is a diagnostic test email from ZapText.</p>
        <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
        <p><strong>From:</strong> ${process.env.ZEPTO_SENDER_NAME} &lt;${process.env.ZEPTO_SENDER_EMAIL}&gt;</p>
        <hr />
        <p style="color:#888;font-size:13px;">If you received this, your ZeptoMail integration is fully working. All transactional emails will flow through this channel.</p>
      `,
    });

    return NextResponse.json({
      success: result.success,
      error: result.error,
      to,
      envCheck,
      hint: result.success
        ? 'Email sent! Check inbox (including spam folder).'
        : 'Check Vercel function logs for full ZeptoMail error. Common issues: sender email not verified in ZeptoMail, invalid API key format, daily limit hit, or domain DNS not propagated.',
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: String(err).slice(0, 400),
      envCheck,
    }, { status: 500 });
  }
}
