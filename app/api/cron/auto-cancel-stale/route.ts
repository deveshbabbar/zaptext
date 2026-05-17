// ─── Auto-cancel pending_approval bookings older than 1 hour ────────────
//
// Without this safety net, a trainer who never sees their booking-request
// notification leaves the customer hanging indefinitely AND the slot stays
// blocked (per-trainer slot conflict logic treats pending_approval rows as
// "taken"). This cron sweeps every 15 min, cancels anything that's been
// pending_approval for >60 min, notifies both sides, and frees the slot.
//
// 24h window safety: bookings cancelled here were CREATED within the last
// 60-something minutes, so the customer & trainer are both well inside the
// WhatsApp customer-service window — free-form messages are policy-safe.
//
// Schedule: every 15 minutes (configured in vercel.json). Authed by
// Bearer CRON_SECRET, matching the other cron handlers.

import { NextRequest, NextResponse } from 'next/server';
import { getStalePendingBookings, cancelBooking } from '@/lib/booking';
import { getClientById } from '@/lib/google-sheets';
import { getStaffById } from '@/lib/staff';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

// Platform default + per-client override. Each client row may set
// stale_booking_minutes (clamped 30..240); when null we use the default.
// We pull every booking older than the absolute floor (30 min) and apply
// each client's actual cutoff in JS so a 120-minute client doesn't get
// their bookings cancelled at 60.
const STALE_DEFAULT_MINUTES = 60;
const STALE_LOWER_BOUND_MINUTES = 30;

function clampStaleMinutes(raw: number | null | undefined): number {
  if (raw == null || !Number.isFinite(raw)) return STALE_DEFAULT_MINUTES;
  return Math.max(30, Math.min(240, Math.floor(raw)));
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stale = await getStalePendingBookings(STALE_LOWER_BOUND_MINUTES);
  let cancelled = 0;
  let customerNotified = 0;
  let trainerNotified = 0;
  let skippedNotYetEligible = 0;
  const errors: string[] = [];
  const now = Date.now();

  for (const b of stale) {
    try {
      const client = await getClientById(b.client_id).catch((err) => {
        console.error('[auto-cancel] getClientById failed', { clientId: b.client_id, err });
        return null;
      });
      const cutoffMinutes = clampStaleMinutes(client?.stale_booking_minutes);
      const ageMinutes = b.created_at
        ? (now - new Date(b.created_at).getTime()) / 60000
        : Infinity;
      if (ageMinutes < cutoffMinutes) {
        skippedNotYetEligible += 1;
        continue;
      }

      // Identify the booking kind so we use the right copy. Restaurant
      // orders tag the bookings row's `service` field with "ORDER · …" —
      // those need order-flavoured cancellation copy ("owner didn't
      // confirm the order") instead of the gym-flavoured "trainer
      // didn't respond" line that was hard-coded here.
      const isOrder = (b.service || '').toUpperCase().startsWith('ORDER');
      const actorWord = isOrder
        ? 'the owner'
        : (client?.type === 'gym' ? 'the trainer' : 'the team');

      // Cancel first — even if notifications fail, the slot must free up so
      // it doesn't keep blocking other customers.
      await cancelBooking(
        b.booking_id,
        isOrder
          ? `[AUTO-CANCEL: owner did not approve the order within ${cutoffMinutes} minutes]`
          : `[AUTO-CANCEL: ${actorWord} did not respond within ${cutoffMinutes} minutes]`
      );
      cancelled += 1;

      if (!client?.phone_number_id) continue;

      // Customer notification — single language picked from client.default_language.
      if (b.customer_phone) {
        try {
          const lang = client?.default_language === 'hindi' || client?.default_language === 'hinglish'
            ? client.default_language
            : 'english';
          let msg: string;
          if (isOrder) {
            msg = lang === 'english'
              ? `🙏 Sorry, we couldn't confirm your order in time. It was auto-cancelled after ${cutoffMinutes} minutes without confirmation from the kitchen. Please message again if you'd still like to order.`
              : `🙏 Sorry, aapka order ${cutoffMinutes} minute mein confirm nahi ho paya — auto-cancel ho gaya. Agar phir bhi order karna ho toh dobara message kariye.`;
          } else {
            const svcLine = b.service ? ` (${b.service})` : '';
            msg = lang === 'english'
              ? `🙏 Sorry, we couldn't confirm your booking${svcLine} for ${b.date} at ${b.time_slot} — no response within ${cutoffMinutes} minutes. Please reply with another preferred time and we'll set it up.`
              : `🙏 Maaf kijiye, ${b.date} ko ${b.time_slot} ki booking${svcLine} confirm nahi ho payi. Doosra time bhej dijiye, hum set kar denge.`;
          }
          await sendWhatsAppMessage(client.phone_number_id, b.customer_phone, msg);
          customerNotified += 1;
        } catch (e) {
          errors.push(`customer-notify ${b.booking_id}: ${String(e).slice(0, 100)}`);
        }
      }

      // Trainer notification (if this was a per-trainer booking).
      if (b.staff_id) {
        try {
          const staff = await getStaffById(b.staff_id).catch((err) => {
            console.error('[auto-cancel] getStaffById failed', { staffId: b.staff_id, err });
            return null;
          });
          if (staff?.whatsapp_phone) {
            const msg =
              `⏰ Booking auto-cancelled\n\n` +
              `Customer: ${b.customer_name || b.customer_phone}\n` +
              `Slot: ${b.date} at ${b.time_slot}\n\n` +
              `No approve/reject response within ${cutoffMinutes} minutes — slot was freed automatically. ` +
              `If you still want this booking, ask the customer to rebook.`;
            await sendWhatsAppMessage(client.phone_number_id, staff.whatsapp_phone, msg);
            trainerNotified += 1;
          }
        } catch (e) {
          errors.push(`trainer-notify ${b.booking_id}: ${String(e).slice(0, 100)}`);
        }
      }
    } catch (e) {
      errors.push(`cancel ${b.booking_id}: ${String(e).slice(0, 100)}`);
    }
  }

  return NextResponse.json({
    ok: true,
    staleFound: stale.length,
    cancelled,
    customerNotified,
    trainerNotified,
    skippedNotYetEligible,
    errors: errors.slice(0, 50),
  });
}
