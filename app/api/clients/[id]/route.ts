import { NextRequest, NextResponse } from 'next/server';
import { getClientById, updateClientField, updateClientFields, deleteClient, getClientConversations, getClientAnalytics } from '@/lib/google-sheets';
import { getUserRole } from '@/lib/auth';

// Source of truth for valid bot verticals. Kept in sync with `BusinessType`
// in lib/types.ts. `clinic` is intentionally absent — that vertical was
// removed for WhatsApp Business Policy compliance and any attempt to set
// type=clinic must be rejected to prevent silent restaurant fallback.
const VALID_BUSINESS_TYPES = ['restaurant', 'coaching', 'realestate', 'salon', 'd2c', 'gym', 'tiffin', 'grocery'] as const;

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

const ADMIN_ALLOWED_FIELDS = ['status', 'system_prompt', 'knowledge_base_json', 'phone_number_id', 'business_name', 'city', 'type'];

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
  type: 50,
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

    // Business type changes require strict validation + atomic sync of the
    // knowledge_base_json's inner `type` field. Without the sync, the prompt
    // generator reads the JSON's stale type and produces the wrong vertical's
    // bot personality — which is exactly the bug we're fixing here. Reject
    // any value outside the known set so legacy strings like "clinic" can
    // never sneak back in via this endpoint.
    if (field === 'type') {
      if (!(VALID_BUSINESS_TYPES as ReadonlyArray<string>).includes(value)) {
        return NextResponse.json(
          {
            error: 'INVALID_BUSINESS_TYPE',
            message: `Business type must be one of: ${VALID_BUSINESS_TYPES.join(', ')}. Got "${value}".`,
          },
          { status: 400 }
        );
      }
      const existing = await getClientById(id);
      if (!existing) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      }
      let kbJson = existing.knowledge_base_json || '{}';
      try {
        const kb = JSON.parse(kbJson);
        kb.type = value;
        kbJson = JSON.stringify(kb);
      } catch {
        // Corrupt JSON — overwrite with a minimal valid object so the
        // prompt generator at least gets the right vertical going forward.
        kbJson = JSON.stringify({ type: value });
      }
      if (kbJson.length > FIELD_MAX_LEN.knowledge_base_json) {
        return NextResponse.json(
          { error: 'knowledge_base_json exceeds max size after type sync' },
          { status: 400 }
        );
      }
      await updateClientFields(id, { type: value, knowledge_base_json: kbJson });
      return NextResponse.json({ success: true });
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
