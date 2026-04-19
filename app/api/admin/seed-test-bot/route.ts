import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { addClient } from '@/lib/google-sheets';
import { generateSystemPrompt } from '@/lib/prompt-generator';
import { setActiveBotId } from '@/lib/active-bot';
import { GymFields, ClientRow } from '@/lib/types';
import { generateId, getISTTimestamp, formatPhoneNumber } from '@/lib/utils';

function buildGymConfig(whatsappNumber: string): GymFields {
  return {
    type: 'gym',
    businessName: 'ZapText Test Gym',
    ownerName: 'Test Owner',
    whatsappNumber,
    contactNumber: whatsappNumber,
    city: 'Bengaluru',
    address: '123 MG Road, Bengaluru 560001',
    workingHours: 'Mon-Sat: 5 AM to 11 PM, Sun: 6 AM to 10 AM',
    languages: ['English'],
    welcomeMessage: 'Welcome to ZapText Test Gym! How can I help you today?',
    additionalInfo: 'This is a test/demo gym bot for validating WhatsApp flows. Feel free to ask about memberships, trial classes, timings, or personal training.',
    gymName: 'ZapText Test Gym',
    facilities: [
      'Cardio zone (treadmills, ellipticals, bikes)',
      'Free weights',
      'Resistance machines',
      'Functional training area',
      'Yoga studio',
      'Steam room',
      'Locker rooms',
    ],
    membershipPlans: [
      { name: 'Monthly', duration: '1 month', price: '₹1,500', includes: 'All equipment, group classes' },
      { name: 'Quarterly', duration: '3 months', price: '₹4,000', includes: 'All equipment, group classes, 1 PT session' },
      { name: 'Half-Yearly', duration: '6 months', price: '₹7,500', includes: 'All equipment, group classes, 3 PT sessions' },
      { name: 'Annual', duration: '12 months', price: '₹13,000', includes: 'All equipment, group classes, 6 PT sessions, steam room' },
    ],
    personalTraining: {
      available: true,
      pricePerSession: '₹800/session',
      trainerInfo: 'Certified trainers with 5+ years of experience. Specializations: weight loss, muscle gain, sports performance.',
    },
    groupClasses: ['Yoga', 'Zumba', 'HIIT', 'CrossFit', 'Strength training'],
    trialAvailable: true,
    trialDetails: 'Free 1-day trial available. Just walk in with your ID between 7 AM and 10 AM.',
    timings: 'Mon-Sat: 5 AM - 11 PM, Sun: 6 AM - 10 AM',
  };
}

export async function POST(req: NextRequest) {
  const user = await getUserRole();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const rawPhoneNumber = typeof body.whatsappNumber === 'string' ? body.whatsappNumber : '';
    const phoneNumberId = typeof body.phoneNumberId === 'string' ? body.phoneNumberId.trim() : '';

    if (!phoneNumberId) {
      return NextResponse.json(
        { error: 'phoneNumberId is required. Get it from Meta WhatsApp Manager → API Setup.' },
        { status: 400 }
      );
    }
    if (!rawPhoneNumber) {
      return NextResponse.json(
        { error: 'whatsappNumber is required (e.g. +15556333873).' },
        { status: 400 }
      );
    }

    const whatsappNumber = formatPhoneNumber(rawPhoneNumber);
    const config = buildGymConfig(whatsappNumber);
    const systemPrompt = generateSystemPrompt(config);
    const clientId = generateId();

    const client: ClientRow = {
      client_id: clientId,
      business_name: config.businessName,
      type: 'gym',
      owner_name: config.ownerName,
      whatsapp_number: whatsappNumber,
      phone_number_id: phoneNumberId,
      city: config.city,
      system_prompt: systemPrompt,
      knowledge_base_json: JSON.stringify(config),
      status: 'active',
      created_at: getISTTimestamp(),
      owner_user_id: user.userId,
      upi_id: '',
      upi_name: '',
      existing_system: '',
      export_format: 'csv',
      contact_number: whatsappNumber,
    };

    await addClient(client);
    await setActiveBotId(clientId);

    return NextResponse.json({
      success: true,
      clientId,
      message: 'Test gym bot seeded. Send a WhatsApp message to the test number to try it.',
      adminUrl: `/admin/clients/${clientId}`,
    });
  } catch (err) {
    console.error('[seed-test-bot] error:', err);
    return NextResponse.json({ error: String(err).slice(0, 300) }, { status: 500 });
  }
}
