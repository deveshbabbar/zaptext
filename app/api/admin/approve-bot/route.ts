import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { updateClientField, getClientById } from '@/lib/google-sheets';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { formatPhoneNumber } from '@/lib/utils';
import { sendTemplate } from '@/lib/email';
import { clerkClient } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
  const user = await getUserRole();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { clientId, action } = await req.json();

    if (!clientId || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request. Provide clientId and action (approve/reject).' }, { status: 400 });
    }

    const client = await getClientById(clientId);
    if (!client) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    if (action === 'approve') {
      // Activate the bot
      await updateClientField(clientId, 'status', 'active');

      // Send WhatsApp activation message to bot owner
      if (client.phone_number_id && client.whatsapp_number) {
        try {
          await sendWhatsAppMessage(
            client.phone_number_id,
            formatPhoneNumber(client.whatsapp_number),
            `🎉 Great news! Your WhatsApp AI bot for ${client.business_name} has been approved and is now LIVE! Your customers can start chatting now.`
          );
        } catch (e) {
          console.error('WhatsApp activation message failed:', e);
        }
      }

      // Send email notification to bot owner
      try {
        if (client.owner_user_id) {
          const cc = await clerkClient();
          const owner = await cc.users.getUser(client.owner_user_id);
          const ownerEmail = owner.emailAddresses[0]?.emailAddress;
          const ownerName = `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || 'there';

          if (ownerEmail) {
            await sendTemplate(ownerEmail, {
              subject: `🎉 Your bot "${client.business_name}" is now LIVE!`,
              html: `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F3EDE3;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;color:#1a2e1d;">
<div style="max-width:560px;margin:24px auto;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #e5dcc8;">
  <div style="background:linear-gradient(135deg,#1a2e1d 0%,#1a5d47 100%);color:#FAF7F2;padding:28px 24px;">
    <h1 style="margin:0;font-size:22px;font-weight:700;">🎉 Bot Approved & Activated!</h1>
  </div>
  <div style="padding:24px;line-height:1.6;font-size:14px;color:#1a2e1d;">
    <p>Hi <strong>${ownerName}</strong>,</p>
    <p>Your WhatsApp AI bot for <strong>${client.business_name}</strong> has been reviewed and approved by our team!</p>
    <p>Your bot is now <strong>LIVE</strong> and ready to handle customer conversations 24/7.</p>
    <div style="margin-top:24px;text-align:center;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/client/dashboard" style="display:inline-block;background:#1a5d47;color:#FAF7F2;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;">Go to Dashboard</a>
    </div>
  </div>
  <div style="padding:16px 24px;background:#FAF7F2;border-top:1px solid #e5dcc8;font-size:12px;color:#5a6b5d;text-align:center;">
    ZapText · AI WhatsApp bots for every business
  </div>
</div>
</body></html>`,
            }, ownerName);
          }
        }
      } catch (e) {
        console.error('Approval email failed:', e);
      }

      return NextResponse.json({ success: true, message: `Bot "${client.business_name}" approved and activated.` });
    }

    if (action === 'reject') {
      await updateClientField(clientId, 'status', 'rejected');

      return NextResponse.json({ success: true, message: `Bot "${client.business_name}" has been rejected.` });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Approve bot error:', error);
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
