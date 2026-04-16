import { NextRequest, NextResponse } from 'next/server';
import { addClient } from '@/lib/google-sheets';
import { generateSystemPrompt } from '@/lib/prompt-generator';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { ClientConfig, ClientRow } from '@/lib/types';
import { generateId, getISTTimestamp, formatPhoneNumber } from '@/lib/utils';
import { getUserRole } from '@/lib/auth';
import { setActiveBotId } from '@/lib/active-bot';
import { sendTemplate, tplAdminNewBot, tplWelcome } from '@/lib/email';
import { clerkClient } from '@clerk/nextjs/server';
import { getBotsByOwner } from '@/lib/owner-clients';
import { getActiveSubscription } from '@/lib/subscription';
import { PLANS } from '@/lib/plans';

export async function POST(request: NextRequest) {
  const user = await getUserRole();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // ─── Check active subscription before allowing bot creation ───
    // Admin users bypass subscription checks
    const isAdmin = user.role === 'admin';
    let existingBots = await getBotsByOwner(user.userId);

    if (!isAdmin) {
      const subscription = await getActiveSubscription(user.userId);
      if (!subscription) {
        return NextResponse.json(
          { error: 'NO_PLAN', message: 'Please purchase a plan before creating a bot. Go to Subscription page to choose a plan.' },
          { status: 403 }
        );
      }

      // Check bot limit based on plan
      const planConfig = PLANS[subscription.plan];
      if (planConfig && existingBots.length >= planConfig.bots) {
        return NextResponse.json(
          { error: 'BOT_LIMIT', message: `Your ${planConfig.name} plan allows ${planConfig.bots} bot(s). Please upgrade to add more bots.` },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const { config, phoneNumberId } = body as { config: ClientConfig; phoneNumberId: string };

    if (!config || !config.type || !config.businessName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const systemPrompt = generateSystemPrompt(config);
    const clientId = generateId();
    const client: ClientRow = {
      client_id: clientId,
      business_name: config.businessName,
      type: config.type,
      owner_name: config.ownerName,
      whatsapp_number: formatPhoneNumber(config.whatsappNumber),
      phone_number_id: phoneNumberId || '',
      city: config.city,
      system_prompt: systemPrompt,
      knowledge_base_json: JSON.stringify(config),
      status: 'active',
      created_at: getISTTimestamp(),
      owner_user_id: user.userId,
    };

    const existingBotsCount = existingBots.length;

    await addClient(client);
    await setActiveBotId(clientId);

    try {
      const cc = await clerkClient();
      const owner = await cc.users.getUser(user.userId);
      const ownerEmail = owner.emailAddresses[0]?.emailAddress;
      const ownerName = `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || 'there';

      if (existingBotsCount === 0 && ownerEmail) {
        await sendTemplate(ownerEmail, tplWelcome({ name: ownerName }), ownerName);
      }

      const adminEmail = process.env.ADMIN_EMAIL || 'admin@zaptext.shop';
      await sendTemplate(adminEmail, tplAdminNewBot({
        businessName: client.business_name,
        type: client.type,
        ownerName,
        ownerEmail: ownerEmail || 'unknown',
      }));
    } catch (e) {
      console.error('Onboard emails failed:', e);
    }

    if (phoneNumberId && config.whatsappNumber) {
      await sendWhatsAppMessage(
        phoneNumberId,
        formatPhoneNumber(config.whatsappNumber),
        `🎉 Your WhatsApp AI bot for ${config.businessName} is now active!`
      );
    }

    return NextResponse.json({ success: true, clientId });
  } catch (error) {
    console.error('Onboard error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
