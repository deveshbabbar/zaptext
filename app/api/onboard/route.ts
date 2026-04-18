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

    // Validate WhatsApp number
    if (config.whatsappNumber) {
      const digits = config.whatsappNumber.replace(/[^0-9]/g, '');
      if (digits.length < 10 || digits.length > 15) {
        return NextResponse.json(
          { error: 'Invalid WhatsApp number. Please enter a valid number with country code (e.g., +919876543210).' },
          { status: 400 }
        );
      }
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
      // Admin-created bots are active immediately; client-created bots need admin approval
      status: isAdmin ? 'active' : 'pending',
      created_at: getISTTimestamp(),
      owner_user_id: user.userId,
      upi_id: typeof config.upiId === 'string' ? config.upiId.trim() : '',
      upi_name: typeof config.upiName === 'string' ? config.upiName.trim() : '',
      existing_system: typeof config.existingSystem === 'string' ? config.existingSystem.trim() : '',
      export_format: config.exportFormat === 'json' ? 'json' : 'csv',
      contact_number: typeof config.contactNumber === 'string' ? formatPhoneNumber(config.contactNumber) : '',
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

      // Notify admin about new bot (needs approval)
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

    // Only send WhatsApp activation message if admin created (immediately active)
    if (isAdmin && phoneNumberId && config.whatsappNumber) {
      await sendWhatsAppMessage(
        phoneNumberId,
        formatPhoneNumber(config.whatsappNumber),
        `🎉 Your WhatsApp AI bot for ${config.businessName} is now active!`
      );
    }

    return NextResponse.json({ success: true, clientId, status: isAdmin ? 'active' : 'pending' });
  } catch (error) {
    console.error('Onboard error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
