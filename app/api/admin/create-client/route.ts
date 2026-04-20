import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { addClient, DuplicateBotError } from '@/lib/google-sheets';
import { generateSystemPrompt } from '@/lib/prompt-generator';
import { createSubscription, PLANS, isDurationKey, computePlanPrice, type PlanKey } from '@/lib/subscription';
import { sendTemplate, tplWelcome } from '@/lib/email';
import { ClientConfig, ClientRow, BusinessType } from '@/lib/types';
import { generateId, getISTTimestamp, formatPhoneNumber } from '@/lib/utils';
import { clerkClient } from '@clerk/nextjs/server';

const VALID_BIZ_TYPES: BusinessType[] = [
  'restaurant', 'coaching', 'realestate', 'salon', 'd2c', 'gym',
];

function generateTempPassword(): string {
  // 12-char readable temp password. Admin shares with client verbally / email.
  // Avoids similar-looking chars (0/O, 1/l/I).
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 12; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s + '!';
}

export async function POST(req: NextRequest) {
  const admin = await getUserRole();
  if (!admin || admin.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      email,
      firstName,
      lastName,
      contactPhone,
      plan,
      months,
      businessType,
      businessName,
      ownerName,
      whatsappNumber,
      phoneNumberId,
      city,
      address,
      sendWelcomeEmail,
    } = body as Record<string, unknown>;

    // Validate required fields
    if (typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }
    if (typeof plan !== 'string' || !(plan in PLANS)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }
    if (!isDurationKey(months)) {
      return NextResponse.json({ error: 'months must be 1, 6, or 12' }, { status: 400 });
    }
    if (typeof businessType !== 'string' || !VALID_BIZ_TYPES.includes(businessType as BusinessType)) {
      return NextResponse.json({ error: 'Invalid businessType' }, { status: 400 });
    }
    if (typeof businessName !== 'string' || !businessName.trim()) {
      return NextResponse.json({ error: 'businessName required' }, { status: 400 });
    }
    if (typeof whatsappNumber !== 'string' || !whatsappNumber.trim()) {
      return NextResponse.json({ error: 'whatsappNumber required' }, { status: 400 });
    }

    const validPlan = plan as PlanKey;
    const bizType = businessType as BusinessType;
    const waNumber = formatPhoneNumber(whatsappNumber);
    const contactNum = typeof contactPhone === 'string' && contactPhone.trim()
      ? formatPhoneNumber(contactPhone)
      : waNumber;

    // ─── 1. Create Clerk user account ───
    const cc = await clerkClient();
    const tempPassword = generateTempPassword();
    let newUserId: string;
    let createdFresh = false;
    try {
      const newUser = await cc.users.createUser({
        emailAddress: [email],
        firstName: typeof firstName === 'string' ? firstName : undefined,
        lastName: typeof lastName === 'string' ? lastName : undefined,
        password: tempPassword,
        skipPasswordChecks: true,
      });
      newUserId = newUser.id;
      createdFresh = true;
    } catch (err) {
      // If user already exists, look them up and proceed (handover flow).
      const msg = String(err).toLowerCase();
      if (msg.includes('already') || msg.includes('exists') || msg.includes('taken')) {
        const found = await cc.users.getUserList({ emailAddress: [email], limit: 5 });
        const existing = found.data[0];
        if (!existing) throw err;
        newUserId = existing.id;
      } else {
        throw err;
      }
    }

    // ─── 2. Build bot config + create client row ───
    const config = {
      type: bizType,
      businessName: businessName.trim(),
      ownerName: typeof ownerName === 'string' && ownerName.trim() ? ownerName.trim() : `${firstName || ''} ${lastName || ''}`.trim() || 'Owner',
      whatsappNumber: waNumber,
      contactNumber: contactNum,
      city: typeof city === 'string' ? city.trim() : '',
      address: typeof address === 'string' ? address.trim() : '',
      workingHours: 'Mon-Sat: 9 AM to 9 PM',
      languages: ['English'],
      welcomeMessage: `Welcome to ${businessName.trim()}! How can I help you today?`,
      additionalInfo: '',
    } as unknown as ClientConfig;

    const systemPrompt = generateSystemPrompt(config);
    const clientId = generateId();
    const clientRow: ClientRow = {
      client_id: clientId,
      business_name: config.businessName,
      type: bizType,
      owner_name: config.ownerName,
      whatsapp_number: waNumber,
      phone_number_id: typeof phoneNumberId === 'string' ? phoneNumberId.trim() : '',
      city: config.city,
      system_prompt: systemPrompt,
      knowledge_base_json: JSON.stringify(config),
      status: 'active',
      created_at: getISTTimestamp(),
      owner_user_id: newUserId,
      upi_id: '',
      upi_name: '',
      existing_system: '',
      export_format: 'csv',
      contact_number: contactNum,
      // Admin attests opt-in on behalf of the client they're onboarding.
      opt_in_accepted: true,
    };

    await addClient(clientRow);

    // ─── 3. Create subscription record ───
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + months * 30);
    const planAmount = computePlanPrice(validPlan, months);

    await createSubscription({
      userId: newUserId,
      plan: validPlan,
      status: 'active',
      razorpayPaymentId: `admin-onboard-${admin.userId.slice(-6)}`,
      razorpayOrderId: `admin-onboard-${admin.userId.slice(-6)}`,
      amount: planAmount,
      startDate: now.toISOString(),
      endDate: end.toISOString(),
      createdAt: getISTTimestamp(),
    });

    // ─── 4. Optional welcome email with login info ───
    let welcomeEmailSent = false;
    if (sendWelcomeEmail === true && createdFresh) {
      try {
        const fullName = `${firstName || ''} ${lastName || ''}`.trim() || 'there';
        await sendTemplate(email, tplWelcome({ name: fullName }), fullName);
        welcomeEmailSent = true;
      } catch (e) {
        console.error('Welcome email failed:', e);
      }
    }

    return NextResponse.json({
      success: true,
      userId: newUserId,
      clientId,
      createdFresh,
      tempPassword: createdFresh ? tempPassword : null,
      welcomeEmailSent,
      plan: validPlan,
      months,
      amount: planAmount,
      endDate: end.toISOString(),
      adminUrl: `/admin/clients/${clientId}`,
    });
  } catch (err) {
    if (err instanceof DuplicateBotError) {
      return NextResponse.json(
        { error: 'DUPLICATE_BOT', field: err.field, message: err.message },
        { status: 409 }
      );
    }
    console.error('[admin/create-client] error:', err);
    return NextResponse.json({ error: String(err).slice(0, 500) }, { status: 500 });
  }
}
