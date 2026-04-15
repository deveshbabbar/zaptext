import { NextRequest, NextResponse } from 'next/server';
import { getClientById, updateClientField, getClientConversations, getClientAnalytics } from '@/lib/google-sheets';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = await getClientById(id);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const [conversations, analytics] = await Promise.all([
      getClientConversations(id),
      getClientAnalytics(id),
    ]);

    return NextResponse.json({ client, conversations, analytics });
  } catch (error) {
    console.error('Error fetching client:', error);
    return NextResponse.json({ error: 'Failed to fetch client' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { field, value } = body as { field: string; value: string };

    if (!field || value === undefined) {
      return NextResponse.json({ error: 'Missing field or value' }, { status: 400 });
    }

    await updateClientField(id, field, value);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating client:', error);
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 });
  }
}
