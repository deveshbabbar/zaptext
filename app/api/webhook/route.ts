import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhook, parseWebhookPayload, sendWhatsAppMessage } from '@/lib/whatsapp';
import { getClientByPhoneNumberId, getConversationHistory, addConversationMessage, updateAnalytics } from '@/lib/google-sheets';
import { generateBotResponse } from '@/lib/gemini';
import { getISTTimestamp } from '@/lib/utils';
import { getAvailableSlots, createBooking, cancelBooking, getBookingsByCustomer, getTodayIST, getDateOffset, calculateEndTime } from '@/lib/booking';
import { sendTemplate, tplNewBooking } from '@/lib/email';
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

async function processMessages(phoneNumberId: string, messages: Array<{ from: string; text?: string; type: string }>) {
  // Look up which client this message belongs to
  const client = await getClientByPhoneNumberId(phoneNumberId);
  if (!client || client.status !== 'active') return;

  for (const msg of messages) {
    const timestamp = getISTTimestamp();
    const customerPhone = msg.from;

    // Handle non-text messages
    if (msg.type !== 'text' || !msg.text) {
      const fallback = 'Abhi main sirf text messages samajh sakta hoon. Kya aap text mein bata sakte hain? 🙏';
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

    // Generate AI response with booking context
    const aiResponse = await generateBotResponse(
      client.system_prompt + availabilityContext,
      pastHistory,
      msg.text
    );

    // Process booking commands from AI response
    let finalResponse = aiResponse;

    const bookingMatch = aiResponse.match(/\[BOOK:([^\]]+)\]/);
    if (bookingMatch) {
      const parts = bookingMatch[1].split(':');
      const [date, time, name, service, ...notesParts] = parts;
      try {
        const slotDuration = 30; // default
        await createBooking({
          clientId: client.client_id,
          customerPhone,
          customerName: name || 'Customer',
          date,
          timeSlot: time,
          endTime: calculateEndTime(time, slotDuration),
          service: service || '',
          notes: notesParts.join(':') || '',
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
