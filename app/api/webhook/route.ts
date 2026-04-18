import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhook, parseWebhookPayload, sendWhatsAppMessage, sendWhatsAppImage, isMessageProcessed } from '@/lib/whatsapp';
import { getClientByPhoneNumberId, getConversationHistory, addConversationMessage, updateAnalytics } from '@/lib/google-sheets';
import { generateBotResponse } from '@/lib/gemini';
import { getISTTimestamp } from '@/lib/utils';
import { getAvailableSlots, createBooking, cancelBooking, getBookingsByCustomer, getTodayIST, getDateOffset, calculateEndTime } from '@/lib/booking';
import { sendTemplate, tplNewBooking } from '@/lib/email';
import {
  buildUpiLink,
  downloadWhatsAppMedia,
  verifyPaymentScreenshot,
  setPendingPayment,
  getPendingPayment,
  clearPendingPayment,
} from '@/lib/payments';
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
    const body = await request.json();
    const payload = parseWebhookPayload(body);

    // Always return 200 to WhatsApp immediately
    if (!payload) {
      return NextResponse.json({ status: 'ok' });
    }

    // Process messages asynchronously (don't block the response)
    processMessages(payload.phoneNumberId, payload.messages).catch(console.error);

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ status: 'ok' });
  }
}

async function processMessages(phoneNumberId: string, messages: Array<{ id: string; from: string; text?: string; type: string; imageId?: string; caption?: string }>) {
  // Look up which client this message belongs to
  const client = await getClientByPhoneNumberId(phoneNumberId);
  if (!client || client.status !== 'active') return;

  for (const msg of messages) {
    // Skip duplicate messages (WhatsApp may retry delivery)
    if (msg.id && isMessageProcessed(msg.id)) {
      console.log(`[Webhook] Skipping duplicate message: ${msg.id}`);
      continue;
    }
    const timestamp = getISTTimestamp();
    const customerPhone = msg.from;

    // Handle image messages — may be a payment screenshot
    if (msg.type === 'image' && msg.imageId) {
      await handlePaymentScreenshot(phoneNumberId, client, customerPhone, msg.imageId, msg.caption || '');
      continue;
    }

    // Handle other non-text messages
    if (msg.type !== 'text' || !msg.text) {
      const fallback = 'Abhi main sirf text aur payment screenshot samajh sakta hoon. Kya aap text mein bata sakte hain? 🙏';
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

    // Order context: teach bot the [ORDER:] tag for food/product orders (restaurant, D2C, etc.)
    const orderCapable = ['restaurant', 'd2c'].includes(client.type);
    let orderContext = '';
    if (orderCapable) {
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
- Never emit both with the same content on conflicting lines; just place them in the same reply.`;
    }

    // Generate AI response with booking + payment + order context
    const aiResponse = await generateBotResponse(
      client.system_prompt + availabilityContext + paymentContext + orderContext,
      pastHistory,
      msg.text
    );

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
        await createBooking({
          clientId: client.client_id,
          customerPhone,
          customerName: safeName,
          date,
          timeSlot: time,
          endTime: calculateEndTime(time, slotDuration),
          service: safeService,
          notes: safeNotes,
        });
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
          finalResponse = 'Sorry, yeh slot abhi kisi ne le liya. Kya doosra time dekhein?';
        }
      }
      finalResponse = finalResponse.replace(/\[BOOK:[^\]]+\]/, '').trim();
    }

    const cancelMatch = aiResponse.match(/\[CANCEL:([^\]]+)\]/);
    if (cancelMatch) {
      await cancelBooking(cancelMatch[1]);
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
        const ownerMsg = `🛍️ *New Order!*\n\n📞 ${customerPhone}\n💰 *₹${total.toFixed(2)}* · ${itemCount} item${itemCount === 1 ? '' : 's'}\n\n${itemsList}${address ? `\n\n📍 ${address}` : ''}${extraNotes ? `\n\n📝 ${extraNotes}` : ''}\n\n🕐 ${timeSlot} · ${todayIst}`;
        await sendWhatsAppMessage(phoneNumberId, client.whatsapp_number.replace('+', ''), ownerMsg);

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
        setPendingPayment(client.client_id, customerPhone, amount, note);
        finalResponse =
          finalResponse.replace(/\[PAY:[^\]]+\]/, '').trim() +
          `\n\n💳 Pay ₹${amount.toFixed(2)} here: ${upiLink}\nPaid hone ke baad screenshot bhej dena — hum confirm kar denge ✓`;
      } else if (amount > 0 && !client.upi_id) {
        finalResponse =
          finalResponse.replace(/\[PAY:[^\]]+\]/, '').trim() +
          `\n\n💳 Amount: ₹${amount.toFixed(2)}. Payment ke liye hum aapko seedha contact karenge.`;
      } else {
        finalResponse = finalResponse.replace(/\[PAY:[^\]]+\]/, '').trim();
      }
    }

    // Send response via WhatsApp
    await sendWhatsAppMessage(phoneNumberId, customerPhone, finalResponse);

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
  const pending = getPendingPayment(client.client_id, customerPhone);

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
    const ack = 'Image mil gayi ✓ Owner ko bhej di hai. Wo confirm kar denge jaldi 🙏';
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

  let reply: string;
  if (check?.matchesExpected) {
    reply = `Payment confirmed ✓ ₹${pending.amount.toFixed(2)} received${
      check.txnIdDetected ? ` (Txn: ${check.txnIdDetected})` : ''
    }. Thanks boss! 🙌`;
    clearPendingPayment(client.client_id, customerPhone);
  } else if (check) {
    reply = `Screenshot mila, but verify nahi ho paya 🤔 Owner ko manually check karne bhej diya — thodi der mein confirm ho jayega.`;
  } else {
    reply = `Screenshot mil gayi ✓ Owner ko bhej di hai manual check ke liye 🙏`;
  }

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
  const pending = getPendingPayment(client.client_id, customerPhone);

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
