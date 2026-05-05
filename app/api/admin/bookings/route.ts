// ─── Admin cross-tenant bookings ───
//
// Powers /admin/bookings. Returns recent bookings across every client,
// joined with the client business name so the operator can spot ops
// issues (e.g. one bot's pending-approval queue blowing up). Admin-only.
// Filterable by status via ?status=pending_approval|confirmed|cancelled.

import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { getUserRole } from '@/lib/auth';
import { db } from '@/lib/db';
import { bookings, clients } from '@/lib/db/schema';

export async function GET(req: NextRequest) {
  const user = await getUserRole();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get('status') || '';
  const limitRaw = parseInt(req.nextUrl.searchParams.get('limit') || '200', 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(1000, limitRaw)) : 200;

  const baseQuery = db
    .select({
      booking_id: bookings.booking_id,
      client_id: bookings.client_id,
      business_name: clients.business_name,
      customer_name: bookings.customer_name,
      customer_phone: bookings.customer_phone,
      date: bookings.date,
      time_slot: bookings.time_slot,
      service: bookings.service,
      status: bookings.status,
      created_at: bookings.created_at,
      notes: bookings.notes,
    })
    .from(bookings)
    .leftJoin(clients, eq(bookings.client_id, clients.client_id));

  const rows = status
    ? await baseQuery.where(eq(bookings.status, status)).orderBy(desc(bookings.created_at)).limit(limit)
    : await baseQuery.orderBy(desc(bookings.created_at)).limit(limit);

  return NextResponse.json({
    ok: true,
    filter: { status: status || null },
    count: rows.length,
    rows: rows.map((r) => ({
      bookingId: r.booking_id,
      clientId: r.client_id,
      businessName: r.business_name ?? '(deleted client)',
      customerName: r.customer_name ?? '',
      customerPhone: r.customer_phone ?? '',
      date: r.date ?? '',
      timeSlot: r.time_slot ?? '',
      service: r.service ?? '',
      status: r.status,
      createdAt: r.created_at ? r.created_at.toISOString() : '',
      notes: r.notes ?? '',
    })),
  });
}
