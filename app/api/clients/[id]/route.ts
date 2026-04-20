import { NextRequest, NextResponse } from 'next/server';
import { getClientById, updateClientField, deleteClient, getClientConversations, getClientAnalytics } from '@/lib/google-sheets';
import { getUserRole } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserRole();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

const ADMIN_ALLOWED_FIELDS = ['status', 'system_prompt', 'knowledge_base_json', 'phone_number_id', 'business_name', 'city'];

// Google Sheets cell limit is 50,000 chars — anything longer is silently
// truncated. Cap per-field so callers get a clear 400 instead of a silent
// corrupting write.
const FIELD_MAX_LEN: Record<string, number> = {
  system_prompt: 50_000,
  knowledge_base_json: 50_000,
  status: 50,
  phone_number_id: 100,
  business_name: 200,
  city: 100,
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserRole();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { field, value } = body as { field: string; value: string };

    if (!field || value === undefined) {
      return NextResponse.json({ error: 'Missing field or value' }, { status: 400 });
    }

    if (!ADMIN_ALLOWED_FIELDS.includes(field)) {
      return NextResponse.json({ error: 'Field not allowed' }, { status: 403 });
    }

    if (typeof value !== 'string') {
      return NextResponse.json({ error: 'Value must be a string' }, { status: 400 });
    }

    const maxLen = FIELD_MAX_LEN[field] ?? 5_000;
    if (value.length > maxLen) {
      return NextResponse.json(
        { error: `Value too long for ${field} (${value.length} > ${maxLen} chars).` },
        { status: 400 }
      );
    }

    await updateClientField(id, field, value);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating client:', error);
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserRole();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const ok = await deleteClient(id);
    if (!ok) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, clientId: id });
  } catch (error) {
    console.error('Error deleting client:', error);
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 });
  }
}
