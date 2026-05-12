// POST /api/client/restaurant/sessions/close
//
// Manager-initiated table-session close. Authenticated; only the owner
// of the matching restaurant bot can close their own sessions.

import { NextRequest, NextResponse } from 'next/server';
import { requireClientWithBots } from '@/lib/auth';
import {
  closeSession,
  getSessionById,
  getOrdersBySession,
  type DineInOrder,
} from '@/lib/db/restaurant-dine-in';
import { getClientById } from '@/lib/db/clients';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

// Builds a bilingual itemised bill for the WhatsApp send.
function buildBill(input: {
  businessName: string;
  tableNumber: string;
  orders: DineInOrder[];
}): string {
  const lines: string[] = [];
  let grandTotal = 0;
  for (const order of input.orders) {
    if (order.status === 'cancelled') continue;
    for (const item of order.items) {
      const lineTotal = item.qty * item.price;
      grandTotal += lineTotal;
      lines.push(`• ${item.qty}× ${item.name} — ₹${lineTotal.toFixed(0)}`);
    }
  }
  if (lines.length === 0) {
    return [
      `${input.businessName} — Table ${input.tableNumber}`,
      `Your dine-in session is closed. Hope to see you again!`,
      ``,
      `Aapka dine-in session band ho gaya hai. Phir aaiye!`,
    ].join('\n');
  }
  return [
    `${input.businessName} — Table ${input.tableNumber}`,
    `Final bill ✅`,
    ...lines,
    `Total: ₹${grandTotal.toFixed(0)}`,
    `Thank you — please pay at the counter / on the spot.`,
    ``,
    `${input.businessName} — Table ${input.tableNumber}`,
    `Final bill ✅`,
    ...lines,
    `Total: ₹${grandTotal.toFixed(0)}`,
    `Dhanyavaad — counter par ya wahin pay kariye.`,
  ].join('\n');
}

export async function POST(request: NextRequest) {
  const user = await requireClientWithBots().catch(() => null);
  if (!user || !user.activeBot || user.activeBot.type !== 'restaurant') {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: { sessionId?: string };
  try {
    body = (await request.json()) as { sessionId?: string };
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const sessionId = String(body.sessionId || '').trim();
  if (!sessionId) return NextResponse.json({ ok: false, error: 'Missing sessionId' }, { status: 400 });

  const session = await getSessionById(sessionId).catch(() => null);
  if (!session || session.client_id !== user.activeBot.client_id) {
    return NextResponse.json({ ok: false, error: 'Session not found' }, { status: 404 });
  }
  if (session.status !== 'open') {
    return NextResponse.json({ ok: true, alreadyClosed: true });
  }

  await closeSession(sessionId, 'manager');

  // Best-effort bill send. Failure here doesn't undo the close — the
  // session is closed regardless and the manager moves on.
  try {
    const [client, orders] = await Promise.all([
      getClientById(session.client_id),
      getOrdersBySession(sessionId),
    ]);
    if (client?.phone_number_id) {
      const bill = buildBill({
        businessName: client.business_name,
        tableNumber: session.table_number,
        orders,
      });
      for (const phone of session.customer_phones) {
        try {
          await sendWhatsAppMessage(client.phone_number_id, phone, bill);
        } catch (err) {
          console.error('[session-close] bill send failed', { phone, err });
        }
      }
    }
  } catch (err) {
    console.error('[session-close] bill build failed', err);
  }

  return NextResponse.json({ ok: true });
}
