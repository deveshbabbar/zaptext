import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { getClientById } from '@/lib/google-sheets';
import { registerPhoneNumber } from '@/lib/whatsapp';

export async function POST(req: NextRequest) {
  const user = await getUserRole();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { clientId, pin } = await req.json();

    if (!clientId || typeof clientId !== 'string') {
      return NextResponse.json(
        { error: 'Missing clientId' },
        { status: 400 }
      );
    }
    if (!pin || typeof pin !== 'string' || !/^[0-9]{6}$/.test(pin)) {
      return NextResponse.json(
        { error: 'PIN must be the 6-digit two-step verification PIN you set in Meta WhatsApp Manager.' },
        { status: 400 }
      );
    }

    const client = await getClientById(clientId);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    if (!client.phone_number_id || !client.phone_number_id.trim()) {
      return NextResponse.json(
        {
          error: 'PHONE_NUMBER_ID_MISSING',
          message:
            'Set the WhatsApp Business API phone_number_id on this client first (the WhatsApp API Connection card on the client detail page).',
        },
        { status: 400 }
      );
    }

    const result = await registerPhoneNumber(client.phone_number_id.trim(), pin);
    if (!result.success) {
      return NextResponse.json(
        {
          error: 'REGISTER_FAILED',
          message:
            result.error ||
            'Meta rejected the registration. Common causes: wrong PIN, expired access token, or phone_number_id mismatch.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        'Number registered with Meta. Status will flip from Pending → Connected within ~30 seconds. Refresh WhatsApp Manager to confirm.',
    });
  } catch (error) {
    console.error('register-whatsapp-number error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: String(error) },
      { status: 500 }
    );
  }
}
