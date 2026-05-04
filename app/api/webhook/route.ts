import { NextRequest, NextResponse, after } from 'next/server';
import { verifyWebhook, verifyWebhookSignature, parseWebhookPayload, sendWhatsAppMessage, sendWhatsAppImage, sendWhatsAppButtons, isMessageProcessed } from '@/lib/whatsapp';
import { getClientByPhoneNumberId, getConversationHistory, getClientConversations, addConversationMessage, updateAnalytics, updateClientField } from '@/lib/google-sheets';
import { getActiveSubscription, isTrialPlan, TRIAL_MESSAGE_LIMIT } from '@/lib/subscription';
import { generateBotResponse } from '@/lib/gemini';
import { getISTTimestamp } from '@/lib/utils';
import { getAvailableSlots, createBooking, cancelBooking, getBookingsByCustomer, getBookingById, getTodayIST, getDateOffset, calculateEndTime, approveBooking, getBookingsForStaff } from '@/lib/booking';
import { sendTemplate, tplNewBooking, tplBookingCancelled } from '@/lib/email';
import {
  buildUpiLink,
  downloadWhatsAppMedia,
  verifyPaymentScreenshot,
  setPendingPayment,
  getPendingPayment,
  clearPendingPayment,
} from '@/lib/payments';
import {
  getActiveInventory,
  isItemAvailableNow,
  formatAvailabilityHuman,
  reserveOrder,
  setStock,
  adjustStock,
  findBestMatch,
  slugify,
} from '@/lib/inventory';
import {
  getStaffByPhoneAny,
  getActiveStaff,
  formatAvailabilityForBot,
  parseAvailabilityCommand,
  upsertStaff,
  getStaffById,
  DAYS,
} from '@/lib/staff';
import { STAFF_ROLE_LABELS, DEFAULT_STAFF_LABEL } from '@/lib/types';
import { clerkClient } from '@clerk/nextjs/server';

// WhatsApp webhook verification
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const result = verifyWebhook(mode, token, challenge);
  if (result) {
    return new NextResponse(result, { status: 200 });
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// WhatsApp incoming messages
export async function POST(request: NextRequest) {
  try {
    // Read raw body ONCE as text so we can HMAC-verify before parsing JSON.
    const rawBody = await request.text();

    // Verify Meta signed this request. If WHATSAPP_APP_SECRET is unset we
    // log a warning and accept (to not break existing deploys) — set it in
    // production to actually enforce the check.
    if (process.env.WHATSAPP_APP_SECRET) {
      const sig = request.headers.get('x-hub-signature-256');
      if (!verifyWebhookSignature(rawBody, sig)) {
        console.warn('[webhook] HMAC signature mismatch — rejecting request');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
      }
    } else {
      console.warn('[webhook] WHATSAPP_APP_SECRET not set — skipping HMAC verify. SET THIS IN PROD.');
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ status: 'ok' });
    }
    const payload = parseWebhookPayload(body);

    // Always return 200 to WhatsApp immediately
    if (!payload) {
      return NextResponse.json({ status: 'ok' });
    }

    // Process messages asynchronously AFTER sending the 200 response.
    // `after()` from next/server tells Vercel to keep the serverless
    // function warm until this callback finishes — without it, the
    // function freezes the moment the response is sent and Gemini /
    // Sheets / Neon writes get killed mid-flight (which is why we saw
    // no new "incoming" rows in conversations after the Neon cutover:
    // Neon was so much faster than Sheets that the response landed
    // before processMessages even started its first query).
    after(async () => {
      try {
        await processMessages(payload.phoneNumberId, payload.messages);
      } catch (err) {
        console.error('[processMessages] failed', {
          phoneNumberId: payload.phoneNumberId,
          messageCount: payload.messages.length,
          error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
        });
      }
    });

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('[webhook] top-level error', error);
    return NextResponse.json({ status: 'ok' });
  }
}

async function processMessages(phoneNumberId: string, messages: Array<{ id: string; from: string; text?: string; type: string; imageId?: string; caption?: string; interactiveButtonId?: string; interactiveButtonTitle?: string }>) {
  // Look up which client this message belongs to
  const client = await getClientByPhoneNumberId(phoneNumberId);
  if (!client) {
    console.warn(`[webhook] No client found for phone_number_id="${phoneNumberId}". Check that a client row in the Sheets has this exact phone_number_id.`);
    return;
  }
  // Hard-skip for statuses that should receive nothing (rejected/error/pending)
  if (!['active', 'paused'].includes(client.status)) return;

  // Trial gate: count existing outbound replies so we can block further Gemini
  // calls once the lifetime limit is hit and strip premium tags from AI output.
  const ownerSubscription = await getActiveSubscription(client.owner_user_id).catch(() => null);
  const isTrialBot = !!ownerSubscription && isTrialPlan(ownerSubscription.plan);
  let trialOutboundCount = 0;
  if (isTrialBot) {
    const allConvos = await getClientConversations(client.client_id).catch(() => []);
    trialOutboundCount = allConvos.filter((c) => c.direction === 'outgoing').length;
  }

  // Subscription-expired gate: client.status is 'active' but owner has no
  // active plan (paid plan lapsed, or trial not yet started). We don't burn
  // Gemini quota on a non-paying account — send a polite single-shot reply
  // and stop. Owner messages bypass so they can still issue control commands.
  const ownerDigits = client.whatsapp_number.replace(/\D/g, '');
  const isSubscriptionExpired = !ownerSubscription;

  for (const msg of messages) {
    // Skip duplicate messages (WhatsApp may retry delivery)
    if (msg.id && isMessageProcessed(msg.id)) {
      console.log(`[Webhook] Skipping duplicate message: ${msg.id}`);
      continue;
    }
    const timestamp = getISTTimestamp();
    const customerPhone = msg.from;

    // Owner-side control commands (text from owner's own number -> their own bot)
    const senderDigits = (msg.from || '').replace(/\D/g, '');
    const isOwner = senderDigits && ownerDigits && senderDigits === ownerDigits;
    if (isOwner && msg.type === 'text' && msg.text) {
      const handled = await handleOwnerCommand(phoneNumberId, client.client_id, senderDigits, msg.text.trim());
      if (handled) {
        await addConversationMessage({
          timestamp,
          client_id: client.client_id,
          customer_phone: customerPhone,
          direction: 'incoming',
          message: `[owner-cmd] ${msg.text}`,
          message_type: 'text',
        });
        continue;
      }
    }

    // Trainer-side commands (if msg.from matches a registered trainer's phone)
    // Accepts both typed text AND native WhatsApp button taps. Button taps
    // arrive as type:'interactive' with interactiveButtonId set; the parser
    // also synthesizes msg.text from the button title so existing string
    // matching keeps working.
    const isTrainerInbound =
      ((msg.type === 'text' && msg.text) ||
        (msg.type === 'interactive' && msg.interactiveButtonId)) && !isOwner;
    if (isTrainerInbound) {
      const staffMember = await getStaffByPhoneAny(msg.from || '');
      if (staffMember && staffMember.client_id === client.client_id) {
        const inboundText = (msg.text || '').trim();
        const handled = await handleStaffCommand(
          phoneNumberId, staffMember, inboundText, client.client_id, msg.interactiveButtonId
        );
        if (handled) {
          await addConversationMessage({
            timestamp, client_id: client.client_id, customer_phone: customerPhone,
            direction: 'incoming',
            message: msg.interactiveButtonId
              ? `[trainer-tap] ${msg.interactiveButtonId} (${inboundText || 'no title'})`
              : `[trainer-cmd] ${inboundText}`,
            message_type: msg.type,
          });
          continue;
        }
      }
    }

    // If bot is paused, send polite auto-reply to customers (not owner) and skip AI
    if (client.status === 'paused' && !isOwner) {
      const paused =
        `Hi! 👋 We're temporarily offline right now. ` +
        `${client.business_name} will be back soon and will reply personally. Thanks for your patience 🙏`;
      await addConversationMessage({
        timestamp, client_id: client.client_id, customer_phone: customerPhone,
        direction: 'incoming', message: msg.text || `[${msg.type}]`, message_type: msg.type,
      });
      await sendWhatsAppMessage(phoneNumberId, customerPhone, paused);
      await addConversationMessage({
        timestamp: getISTTimestamp(), client_id: client.client_id, customer_phone: customerPhone,
        direction: 'outgoing', message: paused, message_type: 'text',
      });
      continue;
    }

    // Subscription expired (owner stopped paying / trial lapsed). Don't burn
    // Gemini quota — log incoming, send a generic offline reply, skip AI.
    if (isSubscriptionExpired && !isOwner) {
      const offline =
        `Hi! 👋 ${client.business_name}'s bot is temporarily offline. ` +
        `Please contact the owner directly — they'll reply soon 🙏\n\n` +
        `${client.business_name} ka bot abhi temporarily offline hai. ` +
        `Owner se directly contact karein, jaldi reply milega.`;
      await addConversationMessage({
        timestamp, client_id: client.client_id, customer_phone: customerPhone,
        direction: 'incoming', message: msg.text || `[${msg.type}]`, message_type: msg.type,
      });
      await sendWhatsAppMessage(phoneNumberId, customerPhone, offline);
      await addConversationMessage({
        timestamp: getISTTimestamp(), client_id: client.client_id, customer_phone: customerPhone,
        direction: 'outgoing', message: offline, message_type: 'text',
      });
      continue;
    }

    // Handle image messages — may be a payment screenshot
    if (msg.type === 'image' && msg.imageId) {
      await handlePaymentScreenshot(phoneNumberId, client, customerPhone, msg.imageId, msg.caption || '');
      continue;
    }

    // Handle other non-text messages
    if (msg.type !== 'text' || !msg.text) {
      const fallback =
        `Right now I can only understand text and payment screenshots. Could you please type your question? 🙏\n\n` +
        `Abhi main sirf text aur payment screenshot samajh sakta hoon. Kya aap text mein bata sakte hain?`;
      await addConversationMessage({
        timestamp,
        client_id: client.client_id,
        customer_phone: customerPhone,
        direction: 'incoming',
        message: msg.text || `[${msg.type}]`,
        message_type: msg.type,
      });
      await sendWhatsAppMessage(phoneNumberId, customerPhone, fallback);
      await addConversationMessage({
        timestamp: getISTTimestamp(),
        client_id: client.client_id,
        customer_phone: customerPhone,
        direction: 'outgoing',
        message: fallback,
        message_type: 'text',
      });
      continue;
    }

    // Log incoming message
    await addConversationMessage({
      timestamp,
      client_id: client.client_id,
      customer_phone: customerPhone,
      direction: 'incoming',
      message: msg.text,
      message_type: 'text',
    });

    // Get conversation history (last 10 messages)
    const history = await getConversationHistory(client.client_id, customerPhone, 10);
    const pastHistory = history.slice(0, -1);

    // Check if booking-related and inject availability context
    const bookingKeywords = [
      'appointment', 'book', 'slot', 'available', 'schedule',
      'kal', 'parson', 'aaj', 'time', 'kab', 'milega',
      'table', 'reserve', 'visit', 'demo', 'trial',
      'cancel', 'reschedule', 'change', 'booking',
    ];
    const allMessages = [...pastHistory.map((h) => h.message), msg.text];
    const isBookingRelated = bookingKeywords.some((kw) =>
      allMessages.some((m) => m.toLowerCase().includes(kw))
    );

    let availabilityContext = '';
    if (isBookingRelated) {
      try {
        const today = getTodayIST();
        const tomorrow = getDateOffset(today, 1);
        const dayAfter = getDateOffset(today, 2);

        const [todaySlots, tomorrowSlots, dayAfterSlots, customerBookings] = await Promise.all([
          getAvailableSlots(client.client_id, today),
          getAvailableSlots(client.client_id, tomorrow),
          getAvailableSlots(client.client_id, dayAfter),
          getBookingsByCustomer(client.client_id, customerPhone),
        ]);

        const activeBookings = customerBookings.filter((b) => b.status === 'confirmed');

        availabilityContext = `

CURRENT AVAILABILITY DATA:
Today (${today}): ${todaySlots.length > 0 ? todaySlots.map((s) => s.start_time).join(', ') : 'No slots available'}
Tomorrow (${tomorrow}): ${tomorrowSlots.length > 0 ? tomorrowSlots.map((s) => s.start_time).join(', ') : 'No slots available'}
Day after (${dayAfter}): ${dayAfterSlots.length > 0 ? dayAfterSlots.map((s) => s.start_time).join(', ') : 'No slots available'}

${activeBookings.length > 0 ? `CUSTOMER'S EXISTING BOOKINGS:\n${activeBookings.map((b) => `- ${b.date} at ${b.time_slot} (${b.service || 'General'}) [ID: ${b.booking_id}]`).join('\n')}` : 'Customer has no existing bookings.'}

BOOKING INSTRUCTIONS:
- When customer confirms a slot, include EXACTLY this tag in your response: [BOOK:date:time:customerName:service:notes]
  Example: [BOOK:${tomorrow}:11:00:Rahul:consultation:knee pain]
- When customer wants to cancel, include: [CANCEL:booking_id]
  Example: [CANCEL:BK_1713456789]
- The system will process these tags automatically. The rest of your message will be sent to the customer.
- Always collect name before booking. Ask for service/reason where relevant.
- Format dates as YYYY-MM-DD, times as HH:MM (24-hour).`;
      } catch (e) {
        console.error('Booking context error:', e);
      }
    }

    // Payment context: teach bot the [PAY:] tag if this client has UPI configured
    let paymentContext = '';
    if (client.upi_id) {
      paymentContext = `

PAYMENT INSTRUCTIONS:
- This business accepts UPI payments. UPI ID: ${client.upi_id}${client.upi_name ? ` (${client.upi_name})` : ''}
- When customer agrees to a price / confirms an order, include EXACTLY this tag in your response: [PAY:amount:note]
  Example: [PAY:560:Order #8821] or [PAY:500:Root canal consult]
- The system will auto-insert a UPI payment link and ask for a screenshot. Don't paste the raw UPI link yourself — just use the tag.
- When customer sends a payment screenshot, the system verifies + forwards to the owner automatically. Don't acknowledge payment yourself unless the customer just sent a text like "paid" without a screenshot.
- Use [PAY:] only once per order. If already paid, don't ask again.`;
    }

    // Order context: teach bot the [ORDER:] tag for food/product orders.
    // Available for ALL non-trial bots — gyms can sell supplements, salons can
    // sell products, coaching centers can sell course packages, etc. The owner
    // controls availability by what they put in /client/inventory; if there's
    // nothing in inventory the [ORDER:] tag is effectively dormant.
    const orderCapable = !isTrialBot;
    let orderContext = '';
    if (orderCapable) {
      // Live inventory snapshot for the bot
      let stockBlock = '';
      try {
        const active = await getActiveInventory(client.client_id);
        if (active.length > 0) {
          const now = new Date();
          const istNow = new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).format(now);
          const lines = active.map((i) => {
            if (i.stock === 0) return `- ${i.name}: OUT OF STOCK (do not accept orders)`;
            const priceBit = i.price > 0 ? ` · ₹${i.price}` : '';
            const availableNow = isItemAvailableNow(i, now);
            const windowNote = formatAvailabilityHuman(i);
            if (!availableNow) {
              return `- ${i.name}: NOT AVAILABLE RIGHT NOW (only ${windowNote}; do not accept orders now)`;
            }
            const winSuffix = windowNote === 'always available' ? '' : ` (${windowNote})`;
            return `- ${i.name}: ${i.stock} available${priceBit}${winSuffix}`;
          });
          stockBlock =
            `\nCURRENT IST TIME: ${istNow}` +
            `\nLIVE STOCK (respect quantities AND time windows — do not order items marked NOT AVAILABLE RIGHT NOW):\n${lines.join('\n')}\n`;
        }
      } catch {
        // ignore
      }
      orderContext = `

ORDER INSTRUCTIONS (food / product orders):
- When a customer finalizes a menu or product order (confirms items + quantities), include EXACTLY this tag: [ORDER:total:items:address:notes]
  - total: numeric rupee amount (no currency symbol, no commas)
  - items: comma-separated quantity×name tokens, e.g. "2xDum Biryani,1xVeg Pulao"
  - address: delivery address, or empty if pickup/dine-in
  - notes: optional (e.g. "extra spicy", "no onion")
  Example: [ORDER:560:2xDum Biryani,1xVeg Pulao:Koramangala 5th Block, Bengaluru:extra spicy]
  Example (dine-in): [ORDER:320:1xMasala Dosa,1xFilter Coffee::table 4]
- The system records the order, notifies the owner immediately on WhatsApp + email with full item list, and sends your reply to the customer.
- Use [ORDER:] ONCE per completed order, BEFORE [PAY:]. Typical flow: confirm items -> [ORDER:...] -> [PAY:...].
- Never emit both with the same content on conflicting lines; just place them in the same reply.
- Use EXACT item names as shown in LIVE STOCK below. Never confirm or [ORDER:] an item that shows OUT OF STOCK. If customer insists, politely say it's unavailable and suggest an alternative.${stockBlock}`;
    }

    // Staff context: inject active staff/trainers/doctors etc. into bot prompt
    let staffContext = '';
    try {
      const activeStaff = await getActiveStaff(client.client_id);
      if (activeStaff.length > 0) {
        const roleLabel = STAFF_ROLE_LABELS[client.type] || DEFAULT_STAFF_LABEL;
        const staffLines = activeStaff.map((m) => {
          const avail = formatAvailabilityForBot(m);
          const price = m.price > 0 ? ` · ₹${m.price}/session` : '';
          const specialty = m.specialty ? ` (${m.specialty})` : '';
          return `- ${m.name}${specialty}${price} · Available: ${avail}`;
        }).join('\n');
        staffContext = `

AVAILABLE ${roleLabel.plural.toUpperCase()}:
${staffLines}

When a customer wants to book a specific ${roleLabel.singular.toLowerCase()}:
1. Confirm the ${roleLabel.singular.toLowerCase()} name + preferred date/time from the customer
2. Use [BOOK:date:time:customerName:${roleLabel.singular} - <Name>:notes] to create the booking
3. The system will notify them directly on WhatsApp for approval
4. Tell the customer: "Booking request bhej diya hai, woh confirm karenge jaldi."
5. Do NOT book a slot that falls outside their listed available hours.`;
      }
    } catch { /* ignore */ }

    // Trial lifetime cap: once hit, reply with an upgrade prompt and skip Gemini.
    if (isTrialBot && trialOutboundCount >= TRIAL_MESSAGE_LIMIT) {
      // Bilingual — customer probably wasn't messaging in English.
      const upgradeMsg =
        `Free trial khatam ho gaya 🎉 (${TRIAL_MESSAGE_LIMIT} replies done). ` +
        `Owner ko upgrade karna hoga taaki main aapki madad continue kar sakoon. ` +
        `ZapText try karne ke liye shukriya! 🙏\n\n` +
        `Free trial reached its limit. The owner needs to upgrade for me to keep helping.`;
      await sendWhatsAppMessage(phoneNumberId, customerPhone, upgradeMsg);
      await addConversationMessage({
        timestamp: getISTTimestamp(),
        client_id: client.client_id,
        customer_phone: customerPhone,
        direction: 'outgoing',
        message: upgradeMsg,
        message_type: 'text',
      });
      trialOutboundCount += 1;
      continue;
    }

    // Generate AI response with booking + payment + order + staff context
    let aiResponse = await generateBotResponse(
      client.system_prompt + availabilityContext + paymentContext + orderContext + staffContext,
      pastHistory,
      msg.text
    );

    // Trial bots: strip premium tags BEFORE tag processing so booking /
    // payment / order / cancel / stock side effects are never triggered.
    if (isTrialBot) {
      aiResponse = aiResponse.replace(/\[(BOOK|PAY|ORDER|CANCEL|STOCK):[^\]]+\]/g, '').trim();
    }

    // Process booking commands from AI response
    let finalResponse = aiResponse;

    const bookingMatch = aiResponse.match(/\[BOOK:(\d{4}-\d{2}-\d{2}):(\d{2}:\d{2}):([^:\]]+):([^:\]]*):?([^\]]*)\]/);
    if (bookingMatch) {
      const [, date, time, name, service, notes] = bookingMatch;
      try {
        // Validate date and time format
        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) throw new Error('Invalid date from AI');
        const [h, m] = time.split(':').map(Number);
        if (h < 0 || h > 23 || m < 0 || m > 59) throw new Error('Invalid time from AI');
        const safeName = (name || 'Customer').slice(0, 100);
        const safeService = (service || '').slice(0, 100);
        const safeNotes = (notes || '').slice(0, 200);
        const slotDuration = 30; // default

        // If the booking is for a specific staff member, mark it pending_approval
        // so the customer-facing "confirmed" status only flips once the staff
        // member types "approve BK_xxx". Detected from service tag prefix below.
        const roleLabel = STAFF_ROLE_LABELS[client.type] || DEFAULT_STAFF_LABEL;
        const staffNameMatch = safeService.match(new RegExp(`^${roleLabel.singular}\\s*[-–:]\\s*(.+)`, 'i'));
        const isStaffBooking = !!staffNameMatch;

        // For staff bookings, resolve trainer name -> staff_id BEFORE
        // createBooking so per-trainer availability check + per-trainer
        // calendar scoping kick in. Without this, the gym-wide
        // weekly_schedule blocks bookings even when the trainer is free
        // (cause of the spurious "slot already taken" reply when no
        // weekly_schedule was configured).
        let resolvedStaffId: string | null = null;
        let resolvedStaff: Awaited<ReturnType<typeof getActiveStaff>>[number] | undefined;
        if (staffNameMatch) {
          const staffName = staffNameMatch[1].trim();
          const activeMembers = await getActiveStaff(client.client_id);
          const needle = staffName.toLowerCase();
          resolvedStaff =
            activeMembers.find((m) => m.name.toLowerCase() === needle) ??
            activeMembers.find((m) => m.name.toLowerCase().startsWith(needle)) ??
            activeMembers.find((m) => m.name.toLowerCase().includes(needle));
          resolvedStaffId = resolvedStaff?.staff_id ?? null;
        }

        const newBooking = await createBooking({
          clientId: client.client_id,
          customerPhone,
          customerName: safeName,
          date,
          timeSlot: time,
          endTime: calculateEndTime(time, slotDuration),
          service: safeService,
          notes: safeNotes,
          status: isStaffBooking ? 'pending_approval' : 'confirmed',
          staffId: resolvedStaffId,
        });
        // Notify trainer directly if booking is for a specific trainer
        try {
          if (staffNameMatch) {
            const matched = resolvedStaff;
            if (matched?.whatsapp_phone) {
              // CRITICAL: use the REAL booking_id from the row we just inserted,
              // not Date.now(). The previous Date.now() id was never findable, so
              // approve/reject commands always returned "booking not found".
              const realBookingId = newBooking.booking_id;
              const staffBody =
                `📅 New booking request — ${client.business_name}\n\n` +
                `👤 Customer: ${safeName}\n` +
                `📞 Phone: +${customerPhone.replace(/\D/g, '')}\n` +
                `📅 Date: ${date}\n` +
                `🕐 Time: ${time}\n` +
                (safeService ? `💼 Service: ${safeService}\n` : '') +
                (safeNotes ? `📝 Notes: ${safeNotes}\n` : '') +
                (matched.price ? `💰 Fee: ₹${matched.price}/session\n` : '') +
                `\nTap a button below to respond — or just text "approve" / "reject".`;
              // Native WhatsApp buttons → no booking ID typing needed.
              // Fallback (plain text with explicit ID) is sent only if Meta
              // rejects the interactive payload.
              const fallbackText =
                staffBody +
                `\n\nManual fallback:\n` +
                `✅ approve ${realBookingId}\n` +
                `❌ reject ${realBookingId} <reason>`;
              await sendWhatsAppButtons(
                phoneNumberId,
                matched.whatsapp_phone,
                staffBody,
                [
                  { id: `appr|${realBookingId}`, title: '✅ Approve' },
                  { id: `rej|${realBookingId}`, title: '❌ Reject' },
                ],
                fallbackText
              );
            }
          }
        } catch (e) {
          console.error('Trainer booking notify failed:', e);
        }

        // Notify owner via WhatsApp
        const ownerMsg = `🔔 *New Booking!*\n\n👤 ${name}\n📞 ${customerPhone}\n📅 ${date}\n🕐 ${time}\n${service ? `💼 ${service}\n` : ''}`;
        await sendWhatsAppMessage(phoneNumberId, client.whatsapp_number.replace('+', ''), ownerMsg);
        // Notify owner via email
        try {
          const cc = await clerkClient();
          const owner = await cc.users.getUser(client.owner_user_id);
          const ownerEmail = owner.emailAddresses[0]?.emailAddress;
          const ownerName = `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || 'there';
          if (ownerEmail) {
            await sendTemplate(
              ownerEmail,
              tplNewBooking({
                ownerName,
                businessName: client.business_name,
                customerName: name || customerPhone,
                customerPhone,
                date,
                time,
                service: service || undefined,
              }),
              ownerName,
            );
          }
        } catch (e) {
          console.error('Booking email failed:', e);
        }
      } catch (e) {
        if ((e as Error).message === 'SLOT_TAKEN') {
          // Bilingual fallback — this string bypasses the LLM, so the
          // language rules in system_prompt can't translate it. Sending
          // both English and Hinglish lines lets either-language customers
          // read it without us having to detect language here.
          finalResponse =
            `Sorry, that slot was just taken. Could we look at another time?\n\n` +
            `Sorry, yeh slot abhi kisi ne le liya. Kya doosra time dekhein?`;
        }
      }
      finalResponse = finalResponse.replace(/\[BOOK:[^\]]+\]/, '').trim();
    }

    const cancelMatch = aiResponse.match(/\[CANCEL:([^\]]+)\]/);
    if (cancelMatch) {
      const cancelId = cancelMatch[1].trim();
      const targetBooking = await getBookingById(cancelId);
      if (
        targetBooking &&
        targetBooking.client_id === client.client_id &&
        targetBooking.customer_phone === customerPhone
      ) {
        await cancelBooking(cancelId, 'Cancelled by customer via WhatsApp');
        // Notify owner so they know the slot freed up — both WhatsApp and email.
        try {
          const ownerCancelMsg =
            `⚠️ *Booking cancelled by customer*\n\n` +
            `👤 ${targetBooking.customer_name || customerPhone}\n` +
            `📞 ${customerPhone}\n` +
            `📅 ${targetBooking.date}${targetBooking.time_slot ? ` · ${targetBooking.time_slot}` : ''}\n` +
            (targetBooking.service ? `💼 ${targetBooking.service}\n` : '') +
            `\nSlot khali ho gaya — koi aur le sakta hai.`;
          await sendWhatsAppMessage(
            phoneNumberId,
            client.whatsapp_number.replace('+', ''),
            ownerCancelMsg
          );
        } catch (e) {
          console.error('Cancel owner-notify (WhatsApp) failed:', e);
        }
        try {
          const cc = await clerkClient();
          const owner = await cc.users.getUser(client.owner_user_id);
          const ownerEmail = owner.emailAddresses[0]?.emailAddress;
          const ownerName = `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || 'there';
          if (ownerEmail) {
            await sendTemplate(
              ownerEmail,
              tplBookingCancelled({
                ownerName,
                businessName: client.business_name,
                customerName: targetBooking.customer_name || customerPhone,
                date: targetBooking.date,
                time: targetBooking.time_slot,
              }),
              ownerName,
            );
          }
        } catch (e) {
          console.error('Cancel owner-notify (email) failed:', e);
        }
      } else {
        console.warn('[CANCEL] scope-check failed', { cancelId, clientId: client.client_id, customerPhone });
      }
      finalResponse = finalResponse.replace(/\[CANCEL:[^\]]+\]/, '').trim();
    }

    // Order tag: [ORDER:total:items:address:notes]
    // items = comma-separated "QTYxNAME" tokens e.g. "2xBiryani,1xVeg Pulao"
    const orderMatch = aiResponse.match(/\[ORDER:(\d+(?:\.\d+)?):([^:\]]*):([^:\]]*):?([^\]]*)\]/);
    if (orderMatch) {
      const total = parseFloat(orderMatch[1]);
      const itemsRaw = (orderMatch[2] || '').slice(0, 300);
      const address = (orderMatch[3] || '').slice(0, 200);
      const extraNotes = (orderMatch[4] || '').slice(0, 200);

      const items = itemsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const itemCount = items.reduce((sum, it) => {
        const m = it.match(/^(\d+)\s*[xX*]/);
        return sum + (m ? parseInt(m[1], 10) : 1);
      }, 0);

      // Reserve inventory first — only commits decrements if ALL items are in stock.
      // If inventory isn't configured (no rows for this client), reservation matches nothing
      // and we skip this check; bot can still accept the order manually.
      let reservation: Awaited<ReturnType<typeof reserveOrder>> | null = null;
      try {
        const active = await getActiveInventory(client.client_id);
        if (active.length > 0 && items.length > 0) {
          reservation = await reserveOrder(client.client_id, items);
          if (!reservation.success) {
            // Roll back: tell customer what's short, skip creating the order
            const problems = reservation.lines
              .filter((l) => l.shortfall > 0 || !l.matchedSku)
              .map((l) => {
                if (!l.matchedSku) return `• "${l.requested}" — not on our menu`;
                return `• ${l.matchedName}: only ${l.stockBefore} left (you asked for ${l.qtyRequested})`;
              })
              .join('\n');
            const reply =
              `Sorry, some items are out of stock:\n${problems}\n\nWould you like to reduce the quantity or try something else?\n\n` +
              `Sorry boss 🙏 kuch items stock mein nahi. Kya aap quantity kam karna chahenge ya kuch aur try karein?`;
            await sendWhatsAppMessage(phoneNumberId, customerPhone, reply);
            await addConversationMessage({
              timestamp: getISTTimestamp(),
              client_id: client.client_id,
              customer_phone: customerPhone,
              direction: 'outgoing',
              message: reply,
              message_type: 'text',
            });
            finalResponse = finalResponse.replace(/\[ORDER:[^\]]+\]/, '').trim();
            continue; // skip order + pay for this message
          }
        }
      } catch (e) {
        console.error('Inventory reservation failed (continuing):', e);
      }

      try {
        const now = new Date();
        const todayIst = getTodayIST();
        const timeSlot = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const serviceLabel = `ORDER · ${itemCount} item${itemCount === 1 ? '' : 's'} · ₹${total.toFixed(2)}`;
        const notesParts: string[] = [];
        if (items.length) notesParts.push(`Items: ${items.join(', ')}`);
        if (address) notesParts.push(`Address: ${address}`);
        if (extraNotes) notesParts.push(extraNotes);

        await createBooking({
          clientId: client.client_id,
          customerPhone,
          customerName: customerPhone,
          date: todayIst,
          timeSlot,
          endTime: timeSlot,
          service: serviceLabel,
          notes: notesParts.join(' | '),
        });

        // Real-time WhatsApp to owner
        const itemsList = items.length ? items.map((i) => `  • ${i}`).join('\n') : '  (no items parsed)';
        const stockSummary = reservation?.success
          ? '\n\n📦 Stock updated:\n' +
            reservation.lines
              .map((l) => `  • ${l.matchedName}: ${l.stockBefore} → ${l.stockAfter}`)
              .join('\n')
          : '';
        const ownerMsg = `🛍️ *New Order!*\n\n📞 ${customerPhone}\n💰 *₹${total.toFixed(2)}* · ${itemCount} item${itemCount === 1 ? '' : 's'}\n\n${itemsList}${address ? `\n\n📍 ${address}` : ''}${extraNotes ? `\n\n📝 ${extraNotes}` : ''}${stockSummary}\n\n🕐 ${timeSlot} · ${todayIst}`;
        await sendWhatsAppMessage(phoneNumberId, client.whatsapp_number.replace('+', ''), ownerMsg);

        // Low-stock alerts (separate message so it stands out)
        if (reservation?.lowStockAlerts?.length) {
          const alertLines = reservation.lowStockAlerts
            .map((a) => `• ${a.name}: ${a.stock} left (threshold: ${a.threshold})`)
            .join('\n');
          await sendWhatsAppMessage(
            phoneNumberId,
            client.whatsapp_number.replace('+', ''),
            `⚠️ *Low stock alert*\n${alertLines}\n\nText *stock ${reservation.lowStockAlerts[0].sku} <qty>* to set new count.`
          );
        }

        // Email owner
        try {
          const cc = await clerkClient();
          const owner = await cc.users.getUser(client.owner_user_id);
          const ownerEmail = owner.emailAddresses[0]?.emailAddress;
          const ownerName = `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || 'there';
          if (ownerEmail) {
            const itemsHtml = items.length
              ? `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`
              : '<p>(no items parsed)</p>';
            await sendTemplate(
              ownerEmail,
              {
                subject: `🛍️ New order ₹${total.toFixed(2)} — ${client.business_name}`,
                html: `
                  <h2>🛍️ New order received</h2>
                  <p><strong>Business:</strong> ${client.business_name}</p>
                  <p><strong>Customer:</strong> ${customerPhone}</p>
                  <p><strong>Amount:</strong> ₹${total.toFixed(2)}</p>
                  <p><strong>Items (${itemCount}):</strong></p>
                  ${itemsHtml}
                  ${address ? `<p><strong>Delivery address:</strong> ${address}</p>` : ''}
                  ${extraNotes ? `<p><strong>Notes:</strong> ${extraNotes}</p>` : ''}
                  <p style="color:#6F6A5F;font-size:13px;margin-top:16px;">
                    Placed at ${timeSlot} on ${todayIst}. Payment screenshot will follow when the customer pays.
                  </p>
                `,
              },
              ownerName
            );
          }
        } catch (e) {
          console.error('Order email failed:', e);
        }
      } catch (e) {
        console.error('Order creation failed:', e);
      }

      finalResponse = finalResponse.replace(/\[ORDER:[^\]]+\]/, '').trim();
    }

    // Payment tag: [PAY:amount:note] — bot asks customer to pay X amount
    const payMatch = aiResponse.match(/\[PAY:(\d+(?:\.\d+)?):([^\]]*)\]/);
    if (payMatch) {
      const amount = parseFloat(payMatch[1]);
      const note = (payMatch[2] || 'Order').slice(0, 60);
      if (amount > 0 && client.upi_id) {
        const upiLink = buildUpiLink({
          upiId: client.upi_id,
          name: client.upi_name || client.business_name,
          amount,
          note,
        });
        await setPendingPayment(client.client_id, customerPhone, amount, note);
        finalResponse =
          finalResponse.replace(/\[PAY:[^\]]+\]/, '').trim() +
          `\n\n💳 Pay ₹${amount.toFixed(2)} here: ${upiLink}\nSend a screenshot once paid — we'll confirm ✓\n` +
          `Paid hone ke baad screenshot bhej dena — hum confirm kar denge.`;
      } else if (amount > 0 && !client.upi_id) {
        finalResponse =
          finalResponse.replace(/\[PAY:[^\]]+\]/, '').trim() +
          `\n\n💳 Amount: ₹${amount.toFixed(2)}. We'll contact you directly for payment.\n` +
          `Payment ke liye hum aapko seedha contact karenge.`;
      } else {
        finalResponse = finalResponse.replace(/\[PAY:[^\]]+\]/, '').trim();
      }
    }

    // Send response via WhatsApp
    await sendWhatsAppMessage(phoneNumberId, customerPhone, finalResponse);
    if (isTrialBot) trialOutboundCount += 1;

    // Log outgoing message
    await addConversationMessage({
      timestamp: getISTTimestamp(),
      client_id: client.client_id,
      customer_phone: customerPhone,
      direction: 'outgoing',
      message: finalResponse,
      message_type: 'text',
    });

    // Update analytics
    await updateAnalytics(client.client_id, customerPhone);
  }
}

// ─── Payment screenshot handler ───

type ClientForPayment = {
  client_id: string;
  business_name: string;
  whatsapp_number: string;
  upi_id?: string;
  upi_name?: string;
  owner_user_id: string;
};

async function handlePaymentScreenshot(
  phoneNumberId: string,
  client: ClientForPayment,
  customerPhone: string,
  imageId: string,
  caption: string
) {
  const ts = getISTTimestamp();
  const pending = await getPendingPayment(client.client_id, customerPhone);

  await addConversationMessage({
    timestamp: ts,
    client_id: client.client_id,
    customer_phone: customerPhone,
    direction: 'incoming',
    message: `[image] ${caption}`,
    message_type: 'image',
  });

  // No pending payment → just forward to owner as-is
  if (!pending) {
    await forwardImageToOwner(phoneNumberId, client, customerPhone, imageId, caption, null);
    const ack =
      `Image received ✓ I've forwarded it to the owner — they'll confirm soon 🙏\n\n` +
      `Image mil gayi ✓ Owner ko bhej di hai, wo confirm kar denge jaldi.`;
    await sendWhatsAppMessage(phoneNumberId, customerPhone, ack);
    await addConversationMessage({
      timestamp: getISTTimestamp(),
      client_id: client.client_id,
      customer_phone: customerPhone,
      direction: 'outgoing',
      message: ack,
      message_type: 'text',
    });
    return;
  }

  // Pending payment → download + verify + forward
  let check: Awaited<ReturnType<typeof verifyPaymentScreenshot>> | null = null;
  const media = await downloadWhatsAppMedia(imageId);
  if (media && client.upi_id) {
    check = await verifyPaymentScreenshot(media.base64, media.mimeType, {
      upiId: client.upi_id,
      amount: pending.amount,
    });
  }

  await forwardImageToOwner(phoneNumberId, client, customerPhone, imageId, caption, check);

  // Never auto-confirm payment to customer from AI screenshot check — Gemini
  // can be fooled by edited/prompt-injected screenshots. Owner must confirm
  // via the *paid <phone>* command. AI result is only a hint for the owner.
  const reply = check?.matchesExpected
    ? `Screenshot received ✓ The owner will confirm shortly — you'll get an update soon 🙏\n` +
      `Screenshot mil gayi, owner confirm kar denge — thodi der mein update milega.`
    : check
      ? `Screenshot received — the owner will check it manually and confirm 🤔\n` +
        `Screenshot mila, owner manually check karenge aur confirm karenge.`
      : `Screenshot received ✓ Forwarded to the owner for manual check 🙏\n` +
        `Screenshot mil gayi, owner ko bhej di hai manual check ke liye.`;

  await sendWhatsAppMessage(phoneNumberId, customerPhone, reply);
  await addConversationMessage({
    timestamp: getISTTimestamp(),
    client_id: client.client_id,
    customer_phone: customerPhone,
    direction: 'outgoing',
    message: reply,
    message_type: 'text',
  });
}

async function forwardImageToOwner(
  phoneNumberId: string,
  client: ClientForPayment,
  customerPhone: string,
  imageId: string,
  customerCaption: string,
  check: Awaited<ReturnType<typeof verifyPaymentScreenshot>> | null
) {
  const ownerPhone = client.whatsapp_number.replace('+', '');
  const pending = await getPendingPayment(client.client_id, customerPhone);

  const header = `💰 Payment screenshot from ${customerPhone}`;
  const expected = pending ? `\nExpected: ₹${pending.amount.toFixed(2)} — ${pending.note}` : '';
  const verdict = check
    ? check.matchesExpected
      ? `\n✅ Auto-verified: ₹${check.amountDetected} to ${check.upiIdDetected}${
          check.txnIdDetected ? ` (Txn: ${check.txnIdDetected})` : ''
        }`
      : `\n⚠️ Needs your check:\n${check.reasons.slice(0, 4).map((r) => `• ${r}`).join('\n')}`
    : '';
  const cap = `${header}${expected}${verdict}${customerCaption ? `\n\nCustomer note: ${customerCaption}` : ''}`;

  // Try sending the image via WhatsApp to owner. WhatsApp inbound media IDs
  // aren't directly forwardable — we attempt `link: imageId` which may fail on
  // some tenancies. Fall back to text if it does.
  const mediaUrl = `https://graph.facebook.com/v21.0/${imageId}`;
  const sent = await sendWhatsAppImage(phoneNumberId, ownerPhone, mediaUrl, cap);
  if (!sent.success) {
    await sendWhatsAppMessage(
      phoneNumberId,
      ownerPhone,
      `${cap}\n\n(Image preview couldn't auto-forward — check dashboard for the screenshot.)`,
    );
  }

  // Also email the owner so they have a permanent record
  try {
    const cc = await clerkClient();
    const owner = await cc.users.getUser(client.owner_user_id);
    const ownerEmail = owner.emailAddresses[0]?.emailAddress;
    if (ownerEmail) {
      await sendTemplate(
        ownerEmail,
        {
          subject: `💰 Payment screenshot — ${client.business_name}`,
          html: `
            <h2>Payment screenshot received</h2>
            <p><strong>From:</strong> ${customerPhone}</p>
            ${pending ? `<p><strong>Expected:</strong> ₹${pending.amount.toFixed(2)} — ${pending.note}</p>` : ''}
            ${check ? `
              <h3>${check.matchesExpected ? '✅ Auto-verified' : '⚠️ Needs manual check'}</h3>
              <ul>
                <li>Amount detected: ${check.amountDetected ?? 'n/a'}</li>
                <li>UPI detected: ${check.upiIdDetected ?? 'n/a'}</li>
                <li>Txn ID: ${check.txnIdDetected ?? 'n/a'}</li>
                ${check.reasons.map((r) => `<li>${r}</li>`).join('')}
              </ul>
            ` : ''}
            ${customerCaption ? `<p><strong>Customer note:</strong> ${customerCaption}</p>` : ''}
            <p>Check your WhatsApp on ${client.whatsapp_number} for the screenshot.</p>
          `,
        },
        owner.firstName || 'there',
      );
    }
  } catch (e) {
    console.error('Payment email failed:', e);
  }
}

// ─── Owner-side WhatsApp control commands ───
// Owner texts their own bot number. Recognized:
//   cancel <BK_...> [reason]   -> cancel booking + notify customer
//   pause                      -> stop AI replies (auto "we're offline" to customers)
//   resume                     -> re-enable AI
//   status                     -> bot status snapshot
//   help                       -> list commands
// Returns true if message was handled as a command.
async function handleOwnerCommand(
  phoneNumberId: string,
  clientId: string,
  ownerPhoneDigits: string,
  text: string
): Promise<boolean> {
  const normalized = text.trim().toLowerCase();

  // cancel <id> [reason...]
  const cancelMatch = normalized.match(/^cancel\s+(\S+)(?:\s+(.+))?$/);
  if (cancelMatch) {
    const [, rawId, reasonPart] = cancelMatch;
    // Re-pull the original case id from the raw text
    const idMatch = text.match(/cancel\s+(\S+)/i);
    const bookingId = idMatch ? idMatch[1] : rawId;
    const reason = (reasonPart || '').slice(0, 200);

    const booking = await getBookingById(bookingId);
    if (!booking || booking.client_id !== clientId) {
      await sendWhatsAppMessage(phoneNumberId, ownerPhoneDigits, `❌ Booking ${bookingId} not found for this bot.`);
      return true;
    }
    const ok = await cancelBooking(bookingId, reason);
    if (!ok) {
      await sendWhatsAppMessage(phoneNumberId, ownerPhoneDigits, `❌ Couldn't cancel ${bookingId}.`);
      return true;
    }
    // Tell the customer
    try {
      if (booking.customer_phone) {
        const reasonLine = reason ? `\nReason: ${reason}` : '';
        const isOrder = (booking.service || '').startsWith('ORDER');
        const msg =
          `🙏 Sorry, your ${isOrder ? 'order' : 'booking'} for ${booking.date}` +
          `${booking.time_slot ? ` at ${booking.time_slot}` : ''} has been cancelled.${reasonLine}\n\n` +
          `Reply here and we'll help you rebook.`;
        await sendWhatsAppMessage(phoneNumberId, booking.customer_phone, msg);
      }
    } catch (e) {
      console.error('Cancel notify customer failed:', e);
    }
    await sendWhatsAppMessage(
      phoneNumberId,
      ownerPhoneDigits,
      `✅ Cancelled ${bookingId} and notified ${booking.customer_phone}${reason ? ` (reason: ${reason})` : ''}.`
    );
    return true;
  }

  // paid <customer_phone>
  // Owner explicitly confirms a payment after viewing the forwarded screenshot.
  // Clears the pending state and tells the customer.
  const paidMatch = normalized.match(/^paid\s+(\+?\d{10,15})$/);
  if (paidMatch) {
    const custDigits = paidMatch[1].replace(/\D/g, '');
    const pending = await getPendingPayment(clientId, custDigits);
    if (!pending) {
      await sendWhatsAppMessage(
        phoneNumberId,
        ownerPhoneDigits,
        `⚠️ No pending payment for ${custDigits}. Maybe already confirmed or expired.`
      );
      return true;
    }
    await clearPendingPayment(clientId, custDigits);
    await sendWhatsAppMessage(
      phoneNumberId,
      custDigits,
      `Payment confirmed ✓ ₹${pending.amount.toFixed(2)} received. Thanks! 🙌`
    );
    await sendWhatsAppMessage(
      phoneNumberId,
      ownerPhoneDigits,
      `✅ Marked paid for ${custDigits} (₹${pending.amount.toFixed(2)}). Customer notified.`
    );
    return true;
  }

  if (normalized === 'pause' || normalized === 'pause bot') {
    await updateClientField(clientId, 'status', 'paused');
    await sendWhatsAppMessage(
      phoneNumberId,
      ownerPhoneDigits,
      `⏸ Bot paused. Customers will see "temporarily offline" until you text *resume*.`
    );
    return true;
  }

  if (normalized === 'resume' || normalized === 'resume bot' || normalized === 'start' || normalized === 'unpause') {
    await updateClientField(clientId, 'status', 'active');
    await sendWhatsAppMessage(phoneNumberId, ownerPhoneDigits, `▶️ Bot resumed. Back to handling customers.`);
    return true;
  }

  if (normalized === 'status' || normalized === 'status?') {
    try {
      const { getClientById } = await import('@/lib/google-sheets');
      const client = await getClientById(clientId);
      const statusLine = client ? `Status: ${client.status}` : 'Status: unknown';
      const upiLine = client?.upi_id ? `UPI: ${client.upi_id}` : 'UPI: not set';
      const formatLine = client?.export_format ? `Export: ${client.export_format}` : 'Export: csv (default)';
      await sendWhatsAppMessage(
        phoneNumberId,
        ownerPhoneDigits,
        `📊 *${client?.business_name || 'Bot'}*\n${statusLine}\n${upiLine}\n${formatLine}\n\nType *help* for commands.`
      );
    } catch {
      await sendWhatsAppMessage(phoneNumberId, ownerPhoneDigits, 'Status check failed.');
    }
    return true;
  }

  if (normalized === 'help' || normalized === 'commands' || normalized === '?') {
    await sendWhatsAppMessage(
      phoneNumberId,
      ownerPhoneDigits,
      `🤖 *Owner commands* (just text this number):\n\n` +
        `• *cancel BK_xxx [reason]* — cancel a booking/order + notify customer\n` +
        `• *pause* — stop AI replies\n` +
        `• *resume* — turn AI back on\n` +
        `• *status* — bot snapshot\n` +
        `• *stock* — show all inventory\n` +
        `• *stock <item> <qty>* — set absolute stock (e.g. "stock biryani 50")\n` +
        `• *stock <item> +N* or *-N* — add/subtract (e.g. "stock biryani -10")\n` +
        `• *help* — this message\n\n` +
        `_Any other message won't trigger commands._`
    );
    return true;
  }

  // stock — list all active inventory
  if (normalized === 'stock' || normalized === 'inventory') {
    try {
      const { getActiveInventory } = await import('@/lib/inventory');
      const active = await getActiveInventory(clientId);
      if (!active.length) {
        await sendWhatsAppMessage(
          phoneNumberId,
          ownerPhoneDigits,
          `📦 No inventory yet. Add items in the dashboard (Client app → Inventory).`
        );
        return true;
      }
      const lines = active
        .map((i) => `• ${i.name}: *${i.stock}*${i.stock === 0 ? ' (OUT OF STOCK)' : ''}`)
        .join('\n');
      await sendWhatsAppMessage(
        phoneNumberId,
        ownerPhoneDigits,
        `📦 *Current stock*\n\n${lines}\n\n` +
          `Reply *stock <name> <qty>* to set, *stock <name> -N* to subtract.`
      );
    } catch {
      await sendWhatsAppMessage(phoneNumberId, ownerPhoneDigits, 'Could not load inventory.');
    }
    return true;
  }

  // stock <item> <qty> | stock <item> +N | stock <item> -N
  const stockMatch = normalized.match(/^stock\s+(.+?)\s+([+-]?\d+)\s*$/);
  if (stockMatch) {
    const rawName = stockMatch[1];
    const numText = stockMatch[2];
    const isDelta = /^[+-]/.test(numText);
    const num = parseInt(numText, 10);
    try {
      const { getActiveInventory, findBestMatch, setStock, adjustStock, slugify } = await import('@/lib/inventory');
      const active = await getActiveInventory(clientId);
      // Prefer exact sku match on the raw name; fall back to fuzzy
      const bySku = active.find((i) => i.sku === slugify(rawName));
      const match = bySku || findBestMatch(active, rawName);
      if (!match) {
        await sendWhatsAppMessage(
          phoneNumberId,
          ownerPhoneDigits,
          `❌ Couldn't find "${rawName}" in inventory. Text *stock* to see exact names.`
        );
        return true;
      }
      const before = match.stock;
      const updated = isDelta
        ? (await adjustStock(clientId, match.sku, num)).item
        : await setStock(clientId, match.sku, num);
      if (!updated) {
        await sendWhatsAppMessage(phoneNumberId, ownerPhoneDigits, `❌ Update failed for ${match.name}.`);
        return true;
      }
      await sendWhatsAppMessage(
        phoneNumberId,
        ownerPhoneDigits,
        `✅ *${updated.name}*: ${before} → *${updated.stock}*${
          updated.stock === 0 ? ' (OUT OF STOCK — bot will refuse new orders)' : ''
        }`
      );
    } catch (e) {
      console.error('stock cmd error:', e);
      await sendWhatsAppMessage(phoneNumberId, ownerPhoneDigits, 'Stock update failed.');
    }
    return true;
  }

  return false;
}

// ─── Trainer-side command handler ───
// Trainer texts the bot from their registered phone.
// Only allows: approve/reject bookings + availability updates + schedule view.
import type { StaffMember } from '@/lib/types';

async function handleStaffCommand(
  phoneNumberId: string,
  trainer: StaffMember,
  text: string,
  clientId: string,
  // When the inbound was a native WhatsApp button tap, this is the
  // button.id we sent — e.g. "appr|BK_xxx" or "rej|BK_xxx". Lets the
  // trainer respond by tapping instead of typing the booking ID.
  interactiveButtonId?: string
): Promise<boolean> {
  const normalized = text.trim().toLowerCase();
  const trainerPhone = trainer.whatsapp_phone;

  // ─── Resolve approve/reject intent + booking id ──────────────────────
  // Source priority: (1) button tap id, (2) "approve <id>" / "reject <id>",
  // (3) bare "approve"/"reject"/"yes"/"no"/"ok"/"✅"/"❌" → smart-fallback
  // to the trainer's oldest pending_approval booking.
  let intent: 'approve' | 'reject' | null = null;
  let resolvedBookingId: string | null = null;
  let rejectReason = '';

  if (interactiveButtonId) {
    const [prefix, idPart] = interactiveButtonId.split('|');
    if (prefix === 'appr' && idPart) { intent = 'approve'; resolvedBookingId = idPart; }
    else if (prefix === 'rej' && idPart) { intent = 'reject'; resolvedBookingId = idPart; }
  }
  if (!intent) {
    const approveWithIdMatch = normalized.match(/^approve\s+(\S+)/);
    const rejectWithIdMatch = normalized.match(/^reject\s+(\S+)(?:\s+(.+))?/);
    const approveBareMatch = /^(approve|approved|yes|ok|okay|haan|✅|👍)$/.test(normalized);
    const rejectBareMatch = normalized === 'reject' || normalized === 'no' || normalized === 'nahi'
      || normalized === '❌' || normalized === '👎';

    if (approveWithIdMatch) {
      intent = 'approve';
      resolvedBookingId = text.match(/approve\s+(\S+)/i)?.[1] || approveWithIdMatch[1];
    } else if (rejectWithIdMatch) {
      intent = 'reject';
      resolvedBookingId = text.match(/reject\s+(\S+)/i)?.[1] || rejectWithIdMatch[1];
      rejectReason = rejectWithIdMatch[2] || '';
    } else if (approveBareMatch) {
      intent = 'approve';
    } else if (rejectBareMatch) {
      intent = 'reject';
    }
  }

  if (intent && !resolvedBookingId) {
    // Smart-fallback: find this trainer's pending_approval bookings.
    // Exactly 1 → confirm/reject it. 0 → tell them. >1 → ask which.
    const allForStaff = await getBookingsForStaff(trainer.staff_id);
    const pending = allForStaff
      .filter((b) => b.status === 'pending_approval')
      .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    if (pending.length === 0) {
      await sendWhatsAppMessage(phoneNumberId, trainerPhone,
        `No pending booking requests right now. ✨\n\n` +
        `Koi pending booking request nahi hai abhi.`);
      return true;
    }
    if (pending.length === 1) {
      resolvedBookingId = pending[0].booking_id;
    } else {
      // Multiple pending — list them with short references so trainer can
      // reply "approve 1" or "reject 2 trainer busy". We use a 1-based
      // index so it reads naturally.
      const lines = pending
        .slice(0, 5)
        .map((b, i) =>
          `${i + 1}. ${b.date} ${b.time_slot} · ${b.customer_name || b.customer_phone}`
            + ` — ID: ${b.booking_id.slice(0, 12)}…`)
        .join('\n');
      await sendWhatsAppMessage(phoneNumberId, trainerPhone,
        `You have ${pending.length} pending booking requests. Reply with the FULL ID, e.g. *${intent} ${pending[0].booking_id}*\n\n${lines}\n\n` +
        `Aapke ${pending.length} pending requests hain. Full ID ke saath reply karein, jaise *${intent} ${pending[0].booking_id}*.`);
      return true;
    }
  }

  if (intent === 'approve' && resolvedBookingId) {
    const booking = await getBookingById(resolvedBookingId);
    if (!booking || booking.client_id !== clientId) {
      await sendWhatsAppMessage(phoneNumberId, trainerPhone,
        `❌ Booking ${resolvedBookingId} not found.\n` +
        `Booking nahi mili.`);
      return true;
    }
    // Flip pending_approval → confirmed in the DB. Idempotent if already confirmed.
    await approveBooking(resolvedBookingId);
    // Notify the customer
    try {
      const { getClientById } = await import('@/lib/google-sheets');
      const client = await getClientById(clientId);
      if (client && booking.customer_phone) {
        const msg =
          `✅ Your booking is confirmed!\n\n` +
          `🏋️ Trainer: ${trainer.name}\n` +
          `📅 ${booking.date} at ${booking.time_slot}\n\n` +
          `See you there! 💪`;
        await sendWhatsAppMessage(client.phone_number_id, booking.customer_phone, msg);
      }
    } catch (e) { console.error('Trainer approve notify failed:', e); }
    await sendWhatsAppMessage(phoneNumberId, trainerPhone,
      `✅ Confirmed — customer notified.\n` +
      `${booking.customer_name || booking.customer_phone} · ${booking.date} ${booking.time_slot}\n` +
      `Customer ko bata diya.`);
    return true;
  }

  if (intent === 'reject' && resolvedBookingId) {
    const reason = rejectReason || 'Trainer unavailable';
    const booking = await getBookingById(resolvedBookingId);
    if (!booking || booking.client_id !== clientId) {
      await sendWhatsAppMessage(phoneNumberId, trainerPhone,
        `❌ Booking ${resolvedBookingId} not found.\n` +
        `Booking nahi mili.`);
      return true;
    }
    await cancelBooking(resolvedBookingId, `Rejected by trainer ${trainer.name}: ${reason}`);
    try {
      const { getClientById } = await import('@/lib/google-sheets');
      const client = await getClientById(clientId);
      if (client && booking.customer_phone) {
        const msg =
          `🙏 Sorry, your booking with ${trainer.name} on ${booking.date} at ${booking.time_slot} ` +
          `couldn't be confirmed.\nReason: ${reason}\n\nPlease reply to rebook with another slot.`;
        await sendWhatsAppMessage(client.phone_number_id, booking.customer_phone, msg);
      }
    } catch (e) { console.error('Trainer reject notify failed:', e); }
    await sendWhatsAppMessage(phoneNumberId, trainerPhone,
      `✅ Declined — customer notified.\n` +
      `${booking.customer_name || booking.customer_phone} · ${booking.date} ${booking.time_slot}\n` +
      `Customer ko bata diya.`);
    return true;
  }

  // availability update: "avail mon-fri 9am-6pm"
  if (normalized.startsWith('avail') || normalized.startsWith('availability')) {
    const parsed = parseAvailabilityCommand(text);
    if (parsed) {
      await upsertStaff({ ...trainer, availability: parsed });
      const days = (DAYS as readonly string[]).filter((d) => ((parsed as unknown) as Record<string, unknown[]>)[d]?.length > 0);
      await sendWhatsAppMessage(phoneNumberId, trainerPhone,
        `✅ Availability updated!\nActive days: ${days.map((d) => d.slice(0,3)).join(', ') || 'none'}\n\nText *schedule* to confirm.`);
    } else {
      await sendWhatsAppMessage(phoneNumberId, trainerPhone,
        `❌ Couldn't parse. Try: *avail mon-fri 9am-6pm* or *avail mon wed fri 8am-5pm*`);
    }
    return true;
  }

  // off today / off <date>
  if (normalized.startsWith('off ') || normalized === 'off today') {
    await sendWhatsAppMessage(phoneNumberId, trainerPhone,
      `⏸ Got it — mark yourself off in the dashboard or text *avail* with your new schedule.`);
    return true;
  }

  // schedule — show current availability
  if (normalized === 'schedule' || normalized === 'availability' || normalized === 'avail') {
    const { formatAvailabilityForBot } = await import('@/lib/trainers');
    const avail = formatAvailabilityForBot(trainer);
    await sendWhatsAppMessage(phoneNumberId, trainerPhone,
      `📅 *${trainer.name}'s schedule*\n${avail}\n\nText *avail mon-fri 9am-6pm* to update.`);
    return true;
  }

  // help
  if (normalized === 'help' || normalized === '?') {
    await sendWhatsAppMessage(phoneNumberId, trainerPhone,
      `🏋️ *Trainer commands*:\n\n` +
      `• Tap *✅ Approve* / *❌ Reject* on a booking request — no typing needed\n` +
      `• *approve* / *yes* / *✅* — confirm your only pending request\n` +
      `• *reject* / *no* / *❌* — decline your only pending request\n` +
      `• *approve BK_xxx* — confirm a specific booking (when you have many)\n` +
      `• *reject BK_xxx reason* — decline a specific booking\n` +
      `• *avail mon-fri 9am-6pm* — update schedule\n` +
      `• *schedule* — see your current availability\n` +
      `• *help* — this list`);
    return true;
  }

  // Any other message from trainer — politely redirect
  await sendWhatsAppMessage(phoneNumberId, trainerPhone,
    `Hi ${trainer.name}! 👋 I only process trainer commands here.\nText *help* for the list.`);
  return true; // consumed — don't pass to customer AI flow
}
