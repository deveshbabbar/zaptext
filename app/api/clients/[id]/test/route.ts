import { NextRequest, NextResponse } from 'next/server';
import { getClientById } from '@/lib/google-sheets';
import { generateBotResponse } from '@/lib/gemini';
import { getUserRole } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserRole();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { message } = await request.json();

    const client = await getClientById(id);

    // Return the SAME 404 for both "no such client" and "exists but
    // not yours". Returning 404 vs 403 was an ID-enumeration oracle —
    // a caller probing arbitrary client_id values could distinguish
    // "this client exists, just not mine" from "this client doesn't
    // exist", letting them confirm valid IDs across tenants. With one
    // shared 404 they get no signal.
    if (!client || (user.role !== 'admin' && client.owner_user_id !== user.userId)) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const response = await generateBotResponse(client.system_prompt, [], message);
    return NextResponse.json({ response });
  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 });
  }
}
