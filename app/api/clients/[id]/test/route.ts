import { NextRequest, NextResponse } from 'next/server';
import { getClientById } from '@/lib/google-sheets';
import { generateBotResponse } from '@/lib/gemini';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { message } = await request.json();

    const client = await getClientById(id);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const response = await generateBotResponse(client.system_prompt, [], message);
    return NextResponse.json({ response });
  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 });
  }
}
