// PATCH /api/booking/[id]/decision
//
// Owner-side approve/decline for a pending advance reservation. Previously
// the only approval path was the staff WhatsApp tap-to-confirm flow — fine
// when the chain has a separate staff number, useless for the typical
// single-owner Indian dhaba/cafe. This endpoint closes that loop: the
// /client/restaurant/tables page calls this to flip status, and the
// customer gets a WhatsApp message back automatically.
//
// Body: { decision: 'approved' | 'declined', reason?: string }
// Response: { ok: true, booking, notified: 'freeform' | 'template' | 'skipped' }
//
// Auth: owner OR admin. Outlet managers can also decide bookings for their
// outlet (viewer-context already gates the page).
//
// Idempotent — clicking Approve on an already-confirmed booking is a no-op.
// Clicking Decline on an already-cancelled booking re-runs the customer
// notification (in case the first send failed silently outside the 24-hr
// CSW).

import { NextRequest, NextResponse } from 'next/server';
import { approveBooking, cancelBooking, getBookingById } from '@/lib/booking';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { getClientById } from '@/lib/google-sheets';
import {
  notifyBookingApproved,
  notifyBookingCancellation,
} from '@/lib/booking-notifications';

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, ctx: Params): Promise<Response> {
  try {
    const user = await getUserRole();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await ctx.params;
    const bookingId = id?.trim();
    if (!bookingId) {
      return NextResponse.json({ error: 'Booking id required' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const decision = body?.decision === 'approved' || body?.decision === 'declined'
      ? body.decision
      : null;
    if (!decision) {
      return NextResponse.json({ error: 'decision must be "approved" or "declined"' }, { status: 400 });
    }
    const reason = typeof body?.reason === 'string'
      ? body.reason.trim().slice(0, 200)
      : '';

    const booking = await getBookingById(bookingId);
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Ownership / scope check — admins can act on any booking; everyone else
    // must own (or manage) the bot this booking belongs to.
    if (user.role !== 'admin') {
      const bot = await resolveActiveBot(user.userId);
      if (!bot || bot.client_id !== booking.client_id) {
        return NextResponse.json({ error: 'Booking not found for your bot' }, { status: 403 });
      }
    }

    // Apply the state change via the existing helpers — both are idempotent
    // and well-tested.
    let updatedStatus = booking.status;
    if (decision === 'approved') {
      const result = await approveBooking(bookingId);
      if (!result) {
        return NextResponse.json({ error: 'Failed to approve' }, { status: 500 });
      }
      updatedStatus = result.status;
    } else {
      const ok = await cancelBooking(bookingId, reason || 'Declined by owner from dashboard');
      if (!ok) {
        return NextResponse.json({ error: 'Failed to decline' }, { status: 500 });
      }
      updatedStatus = 'cancelled';
    }

    // Fire the customer-facing WhatsApp message. Non-fatal — the DB state
    // is already updated; if the message fails the operator can resend.
    let notified: 'freeform' | 'template' | 'skipped' = 'skipped';
    try {
      const client = await getClientById(booking.client_id);
      if (client?.phone_number_id && booking.customer_phone) {
        if (decision === 'approved') {
          const r = await notifyBookingApproved({
            phoneNumberId: client.phone_number_id,
            clientId: booking.client_id,
            customerPhone: booking.customer_phone,
            customerName: booking.customer_name || '',
            service: booking.service || '',
            date: booking.date,
            time: booking.time_slot || '',
            bookingId: booking.booking_id || '',
            businessName: client.business_name,
          });
          notified = r.used;
        } else {
          const r = await notifyBookingCancellation({
            phoneNumberId: client.phone_number_id,
            clientId: booking.client_id,
            customerPhone: booking.customer_phone,
            customerName: booking.customer_name || '',
            service: booking.service || '',
            date: booking.date,
            time: booking.time_slot || '',
            bookingId: booking.booking_id || '',
            businessName: client.business_name,
            reason,
          });
          notified = r.used;
        }
      }
    } catch (notifyErr) {
      console.error('[booking-decision] customer notify failed:', notifyErr);
    }

    return NextResponse.json({
      ok: true,
      booking: { ...booking, status: updatedStatus },
      notified,
    });
  } catch (error) {
    console.error('[booking-decision] error:', error);
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
  }
}
