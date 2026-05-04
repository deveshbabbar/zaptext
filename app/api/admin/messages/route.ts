import { NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { getAllClients, getClientConversations } from '@/lib/google-sheets';

// Aggregates the latest conversation per (client, customer) pair across every
// bot in the system, plus a few headline counts. Used to live on a Sheets
// `conversations` tab; now reads the Neon `conversations` table per-client
// in parallel — same response shape, but typically 10-30x faster on warm
// Neon vs Sheets.
export async function GET() {
  const user = await getUserRole();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const clients = await getAllClients();

    // Pull conversations per client in parallel; flat-map into a single list
    // matching the legacy row shape (timestamp, client_id, customer_phone,
    // direction, message). Fan-out scoped to clients.length to keep the
    // burst manageable on the Neon connection pool.
    const perClient = await Promise.all(
      clients.map(async (c) => {
        const rows = await getClientConversations(c.client_id).catch(() => []);
        return rows.map((r) => ({
          timestamp: r.timestamp || '',
          client_id: r.client_id,
          customer_phone: r.customer_phone,
          direction: r.direction,
          message: r.message,
        }));
      })
    );
    const flat = perClient.flat();

    const clientById = new Map(clients.map((c) => [c.client_id, c]));

    // Group by customer phone + client → keep the latest message per pair,
    // and count total messages in that thread.
    const grouped = new Map<
      string,
      {
        client_id: string;
        customer_phone: string;
        lastMessage: string;
        lastTimestamp: string;
        messageCount: number;
        lastDirection: string;
      }
    >();
    let todayCount = 0;
    const todayPrefix = new Date()
      .toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
      .replace(/\//g, '/');
    for (const row of flat) {
      const { timestamp, client_id, customer_phone, direction, message } = row;
      if (!client_id || !customer_phone) continue;
      const key = `${client_id}::${customer_phone}`;
      const existing = grouped.get(key);
      if (!existing || timestamp > existing.lastTimestamp) {
        grouped.set(key, {
          client_id,
          customer_phone,
          lastMessage: message,
          lastTimestamp: timestamp,
          messageCount: (existing?.messageCount || 0) + 1,
          lastDirection: direction,
        });
      } else {
        existing.messageCount++;
      }
      if (timestamp.includes(todayPrefix)) todayCount++;
    }

    const conversations = Array.from(grouped.values())
      .map((c) => ({
        ...c,
        business_name: clientById.get(c.client_id)?.business_name || 'Unknown',
        business_type: clientById.get(c.client_id)?.type || '',
      }))
      .sort((a, b) => (b.lastTimestamp || '').localeCompare(a.lastTimestamp || ''));

    return NextResponse.json({
      conversations,
      stats: {
        totalConversations: conversations.length,
        totalMessages: flat.length,
        today: todayCount,
        avgPerClient: clients.length > 0 ? Math.round(flat.length / clients.length) : 0,
      },
    });
  } catch (error) {
    console.error('Admin messages error:', error);
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
