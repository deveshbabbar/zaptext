import { NextRequest, NextResponse, after } from 'next/server';
import { verifyWebhook, verifyWebhookSignature, parseWebhookPayload, parseTemplateStatusEvent, sendWhatsAppMessage, sendWhatsAppImage, sendWhatsAppButtons, sendWhatsAppList, isMessageProcessed } from '@/lib/whatsapp';
import { db } from '@/lib/db';
import { template_submissions } from '@/lib/db/schema';
import { generateSystemPrompt } from '@/lib/prompt-generator';
import type { ClientConfig } from '@/lib/types';
import { getClientByPhoneNumberId, getConversationHistory, addConversationMessage, updateAnalytics, updateClientField, hasRecentInboundMessage, hasRecentWelcomeMenuSent, getOutboundCountThisMonth, getOutboundCountForOwner } from '@/lib/google-sheets';
import { getWelcomeMenu } from '@/lib/welcome-menu';
import { getActiveSubscription, isTrialPlan, TRIAL_MESSAGE_LIMIT } from '@/lib/subscription';
import { resolvePlanKey } from '@/lib/plans';
import { canUse, checkMessageQuota } from '@/lib/feature-gates';
import { isCustomerPaused } from '@/lib/db/paused-customers';
import { markMessageProcessedIfNew } from '@/lib/db/processed-messages';
import { incrementUsageAtomic, monthKey } from '@/lib/db/usage-counters';
import { recordConsentEvent } from '@/lib/db/consent-log';
import { generateBotResponse, transcribeAudio } from '@/lib/gemini';
import { getISTTimestamp } from '@/lib/utils';
import { getAvailableSlots, createBooking, cancelBooking, getBookingsByCustomer, getBookingById, getTodayIST, getDateOffset, calculateEndTime, approveBooking, getBookingsForStaff, getStalePendingBookings } from '@/lib/booking';
import { countActiveKitchenOrders } from '@/lib/db/restaurant-dine-in';
import { classifyPriority } from '@/lib/conversation-priority';
import { sendTemplate, tplNewBooking, tplBookingCancelled } from '@/lib/email';
import {
  buildUpiLink,
  downloadWhatsAppMedia,
  verifyPaymentScreenshot,
  setPendingPayment,
  getPendingPayment,
  clearPendingPayment,
} from '@/lib/payments';
import { buildPublicMenuUrl } from '@/lib/storefront-slug';
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
import { handleGroceryOwnerMessage } from '@/lib/grocery/owner-handler';
import { handleGroceryCustomerMessage } from '@/lib/grocery/customer-handler';

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

    // Verify Meta signed this request.
    //
    // Production enforces strictly: if WHATSAPP_APP_SECRET is unset, reject
    // EVERY incoming webhook. Previously we logged a warning and accepted —
    // that meant a misconfigured deploy silently allowed anyone to inject
    // fake "customer" messages, trigger AI replies, or burn Groq quota.
    // In non-production (dev/preview) we keep the soft-warn so local
    // tunnelled testing without a secret still works.
    {
      const appSecret = process.env.WHATSAPP_APP_SECRET;
      const isProd = process.env.NODE_ENV === 'production';
      if (!appSecret) {
        if (isProd) {
          console.error('[webhook] WHATSAPP_APP_SECRET is not set — refusing to process webhook in production. Set this env var.');
          return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
        }
        console.warn('[webhook] WHATSAPP_APP_SECRET not set — skipping HMAC verify (dev/preview only).');
      } else {
        const sig = request.headers.get('x-hub-signature-256');
        if (!verifyWebhookSignature(rawBody, sig)) {
          console.warn('[webhook] HMAC signature mismatch — rejecting request');
          return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
        }
      }
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ status: 'ok' });
    }

    // Meta sends template approval/rejection events on the same webhook URL.
    // Detect and dispatch first; messages parser only fires when this is
    // not a template event.
    const tplEvent = parseTemplateStatusEvent(body);
    if (tplEvent) {
      after(async () => {
        try {
          await db
            .insert(template_submissions)
            .values({
              waba_id: tplEvent.wabaId,
              template_name: tplEvent.templateName,
              language: tplEvent.language,
              category: 'UTILITY', // unknown from this event; preserved on conflict
              status: tplEvent.status,
              meta_template_id: tplEvent.metaTemplateId,
              last_error: tplEvent.reason,
              updated_at: new Date(),
            })
            .onConflictDoUpdate({
              target: [
                template_submissions.waba_id,
                template_submissions.template_name,
                template_submissions.language,
              ],
              set: {
                status: tplEvent.status,
                meta_template_id: tplEvent.metaTemplateId,
                last_error: tplEvent.reason,
                updated_at: new Date(),
              },
            });
          console.log(`[template-status] ${tplEvent.templateName}/${tplEvent.language} -> ${tplEvent.status}`);
        } catch (err) {
          console.error('[template-status] DB upsert failed:', err);
        }
      });
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
      // Inline stale-pending sweep — runs piggybacking on every webhook
      // invocation so during active hours, abandoned booking-approvals
      // get cleaned up within minutes (vs waiting for the daily evening
      // cron). Zero impact on user-visible latency because we're already
      // past the response. Cheap: getStalePendingBookings is an indexed
      // query that returns 0 rows in the common case.
      try {
        await sweepStalePendings();
      } catch (err) {
        console.error('[stale-sweep] failed (non-fatal):', err);
      }
    });

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    // Top-level catastrophic failure (e.g. JSON parse blew up before we
    // could schedule processMessages, signature read failed, etc.). Return
    // 500 so Meta retries — previously we returned 200, which meant Meta
    // marked the message delivered and moved on, silently losing customer
    // messages on transient infra blips. processMessages() itself runs
    // inside `after()` with its own try/catch (above), so post-response
    // failures don't bubble here and won't trigger Meta retries.
    console.error('[webhook] top-level error', error);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}

async function processMessages(phoneNumberId: string, messages: Array<{ id: string; from: string; text?: string; type: string; imageId?: string; caption?: string; audioId?: string; audioMimeType?: string; interactiveButtonId?: string; interactiveButtonTitle?: string; interactiveListId?: string; interactiveListTitle?: string; locationLat?: number; locationLng?: number; locationName?: string; locationAddress?: string }>) {
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
  const ownerSubscription = await getActiveSubscription(client.owner_user_id).catch((err) => {
    console.error('[webhook] getActiveSubscription failed', { ownerId: client.owner_user_id, err });
    return null;
  });
  const isTrialBot = !!ownerSubscription && isTrialPlan(ownerSubscription.plan);
  // Resolved plan key — used by feature-gates below to decide which AI
  // tags (BOOK / PAY / etc.) are silently stripped before they fire.
  // Defaults to 'trial' (most restrictive) when no active sub.
  const planKey = resolvePlanKey(ownerSubscription?.plan);
  // Trial uses LIFETIME count (50 hard cap). Paid plans use CURRENT-MONTH
  // count (resets on the 1st). Both run a single small SQL query so the
  // hot path stays fast.
  let trialOutboundCount = 0;
  let monthlyOutboundCount = 0;
  if (isTrialBot) {
    // PER-OWNER count, summed across every bot the same Clerk user owns.
    // Previously this was per-bot (getClientConversations(client.client_id))
    // which let a single owner reset their 50-message trial cap by
    // creating a second bot — each bot started its own 0-counter.
    trialOutboundCount = await getOutboundCountForOwner(client.owner_user_id).catch(() => 0);
  } else {
    monthlyOutboundCount = await getOutboundCountThisMonth(client.client_id).catch(() => 0);
  }

  // Subscription-expired gate: client.status is 'active' but owner has no
  // active plan (paid plan lapsed, or trial not yet started). We don't burn
  // Gemini quota on a non-paying account — send a polite single-shot reply
  // and stop. Owner messages bypass so they can still issue control commands.
  const ownerDigits = client.whatsapp_number.replace(/\D/g, '');
  const isSubscriptionExpired = !ownerSubscription;

  for (const msg of messages) {
    // Skip duplicate messages — Meta retries the same message_id when our
    // 200 OK doesn't reach them in time. Old in-memory check was wiped on
    // cold starts, so retries hitting a fresh lambda reprocessed and caused
    // duplicate orders/bookings. Postgres-backed check survives cold starts
    // and concurrent invocations alike — first writer wins.
    if (msg.id) {
      let isNew = true;
      try {
        isNew = await markMessageProcessedIfNew(msg.id);
      } catch (err) {
        // If the dedup table isn't reachable, fall back to the in-memory
        // best-effort check rather than blocking the entire webhook.
        console.error('[Webhook] dedup check failed, falling back to in-memory:', err);
        isNew = !isMessageProcessed(msg.id);
      }
      if (!isNew) {
        console.log(`[Webhook] Skipping duplicate message: ${msg.id}`);
        continue;
      }
    }
    const timestamp = getISTTimestamp();
    const customerPhone = msg.from;

    // Owner-side control commands (text from owner's own number -> their own bot)
    const senderDigits = (msg.from || '').replace(/\D/g, '');
    const isOwner = senderDigits && ownerDigits && senderDigits === ownerDigits;

    // ─── Grocery vertical: owner + customer routing ───────────────────
    // Only fires for clients with type === 'grocery' (no other vertical is
    // affected). Owner side: route to the catalog updater; if not handled,
    // fall through so generic owner-control words (menu/help/list/status/
    // orders) still hit handleOwnerCommand. Customer side: grocery owns the
    // entire flow — catalog browsing, ordering, slot pick, payment — and
    // does NOT fall through to the generic per-vertical AI pipeline.
    if (client.type === 'grocery') {
      const clientLite = {
        client_id: client.client_id,
        whatsapp_number: client.whatsapp_number,
        business_name: client.business_name ?? '',
      };
      if (isOwner) {
        const handled = await handleGroceryOwnerMessage(phoneNumberId, clientLite, {
          from: msg.from,
          type: msg.type,
          text: msg.text,
          audioId: msg.audioId,
          audioMimeType: msg.audioMimeType,
        });
        if (handled) {
          await addConversationMessage({
            timestamp,
            client_id: client.client_id,
            customer_phone: customerPhone,
            direction: 'incoming',
            message: msg.text || `[${msg.type}]`,
            message_type: msg.type,
          });
          continue;
        }
        // not handled → fall through to handleOwnerCommand below
      } else {
        // Customer-side: grocery handler fully owns this branch. Map the
        // flat webhook msg shape into customer-handler's InboundMessageLite
        // (text/interactive/audio nested objects mirror Meta's raw payload).
        const interactiveId =
          msg.interactiveButtonId ?? msg.interactiveListId ?? undefined;
        const interactiveTitle =
          msg.interactiveButtonTitle ?? msg.interactiveListTitle ?? '';
        const interactivePayload =
          msg.type === 'interactive' && interactiveId
            ? {
                type: msg.interactiveListId ? ('list_reply' as const) : ('button_reply' as const),
                ...(msg.interactiveListId
                  ? { list_reply: { id: interactiveId, title: interactiveTitle } }
                  : { button_reply: { id: interactiveId, title: interactiveTitle } }),
              }
            : undefined;
        await handleGroceryCustomerMessage(phoneNumberId, clientLite, {
          from: msg.from,
          type: msg.type,
          text: msg.text ? { body: msg.text } : undefined,
          interactive: interactivePayload,
          audio:
            msg.audioId
              ? { id: msg.audioId, mime_type: msg.audioMimeType ?? '' }
              : undefined,
        });
        await addConversationMessage({
          timestamp,
          client_id: client.client_id,
          customer_phone: customerPhone,
          direction: 'incoming',
          message: msg.text || `[${msg.type}]`,
          message_type: msg.type,
        });
        continue;
      }
    }

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

    // Handle voice notes / audio messages — transcribe via Gemini, then
    // treat the transcript as if the customer typed it. Lets Indian SMB
    // customers send voice in Hindi/Hinglish/regional languages and the
    // bot still replies correctly. Falls back to a polite "please type"
    // message if transcription fails (no GEMINI_API_KEY, network error,
    // unintelligible audio, etc.).
    let inboundAlreadyLogged = false;
    // Conversation priority (Work Item 7). Classified once per inbound
    // turn using lib/conversation-priority.ts. Stored on the inbound
    // conversations row + used to inject an escalationContext block into
    // the bot prompt for urgent threads. Defaults 'normal' for non-text
    // turns (location pins, payment screenshots — those routes have their
    // own log path and don't need classification).
    let inboundPriority: 'normal' | 'attention' | 'urgent' = 'normal';
    let inboundPriorityMatched: string[] = [];
    if (msg.type === 'audio' && msg.audioId) {
      let transcript = '';
      try {
        const media = await downloadWhatsAppMedia(msg.audioId);
        if (media) {
          transcript = await transcribeAudio(
            media.base64,
            msg.audioMimeType || media.mimeType
          );
        }
      } catch (e) {
        console.error('[webhook] voice-note transcription failed:', e);
      }
      if (transcript) {
        // Substitute the transcript in-place so the existing AI path
        // downstream sees this exactly like a typed message. The 🎙️
        // prefix in the stored row lets the operator UI distinguish
        // voice from typed without us needing a separate message_type.
        msg.text = transcript;
        msg.type = 'text';
        const voicePriority = classifyPriority(transcript);
        inboundPriority = voicePriority.level;
        inboundPriorityMatched = voicePriority.matched;
        await addConversationMessage({
          timestamp,
          client_id: client.client_id,
          customer_phone: customerPhone,
          direction: 'incoming',
          message: `🎙️ ${transcript}`,
          message_type: 'audio',
          priority_level: inboundPriority,
        });
        // Mark inbound as logged so the fall-through "Log incoming message"
        // step below doesn't double-insert the same turn as text. Without
        // this flag the operator UI showed every voice note twice (once as
        // 🎙️ audio, once as plain text) and the conversation history fed
        // back to the AI duplicated the customer's last turn.
        inboundAlreadyLogged = true;
        // Fall through — the rest of the loop body now handles msg.text
        // exactly as it would for a typed message.
      } else {
        const fallback =
          'Maaf kijiye, aapka voice note clear nahi suna. Kya aap text mein bhej sakte hain? 🙏';
        await addConversationMessage({
          timestamp,
          client_id: client.client_id,
          customer_phone: customerPhone,
          direction: 'incoming',
          message: '[voice note — transcription failed]',
          message_type: 'audio',
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
    }

    // Handle other non-text messages — but let interactive list-reply
    // taps through (the parser synthesizes msg.text from the row title,
    // so they're effectively text from this point on).
    const isListReplyTap = msg.type === 'interactive' && !!msg.interactiveListId;
    if ((msg.type !== 'text' && !isListReplyTap) || !msg.text) {
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

    // Log incoming message (skip if the voice-note branch above already
    // logged this turn — otherwise the same customer turn shows up twice
    // in the operator UI and in the prompt's conversation history).
    if (!inboundAlreadyLogged) {
      const textPriority = classifyPriority(msg.text);
      inboundPriority = textPriority.level;
      inboundPriorityMatched = textPriority.matched;
      await addConversationMessage({
        timestamp,
        client_id: client.client_id,
        customer_phone: customerPhone,
        direction: 'incoming',
        message: msg.text,
        message_type: 'text',
        priority_level: inboundPriority,
      });
    }

    // ─── Marketing opt-out keyword detector ───────────────────────────
    // DPDPA §6 + Meta opt-out: every business message recipient must be
    // able to unsubscribe with a simple keyword. Fires before any AI
    // step so the customer is never charged for an opt-out reply via
    // wasted Groq calls — and we log the consent_log row for evidence.
    if (msg.type === 'text' && msg.text) {
      const stopMatch = /^\s*(stop|unsubscribe|ruko|बंद|बंद\s*करो|stop\s*karo|band\s*karo)\s*$/i.test(msg.text.trim());
      if (stopMatch) {
        void recordConsentEvent({
          client_id: client.client_id,
          customer_phone: customerPhone,
          event_type: 'marketing_opt_out',
          source: 'webhook-keyword',
          business_name_shown: client.business_name,
          categories: [],
        });
        const ack =
          `Got it — you won't receive offers or specials from ${client.business_name}. ` +
          `You can still message us for orders, and we'll always reply.\n\n` +
          `Theek hai — aapko ${client.business_name} se offers / specials nahi aayenge. ` +
          `Order ke liye message kar sakte hain, hum reply zaroor karenge.`;
        await sendWhatsAppMessage(phoneNumberId, customerPhone, ack);
        await addConversationMessage({
          timestamp: getISTTimestamp(),
          client_id: client.client_id,
          customer_phone: customerPhone,
          direction: 'outgoing',
          message: ack,
          message_type: 'text',
        });
        continue;
      }
    }

    // ─── Restaurant: inbound location share → menu link with lat/lng ──
    // Customer tapped 📎 → Location in WhatsApp and shared their pin.
    // We pre-route to the right outlet (haversine zone math) and send
    // the menu URL carrying ?lat=&lng= so the page can pre-fill the
    // form + show the assigned outlet's map marker. Bypasses the AI
    // entirely — this is a deterministic flow with no language risk.
    if (
      client.type === 'restaurant'
      && msg.type === 'location'
      && typeof msg.locationLat === 'number'
      && typeof msg.locationLng === 'number'
    ) {
      const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') || 'https://www.zaptext.shop';
      const phoneDigits = (msg.from || '').replace(/\D/g, '');
      const params = new URLSearchParams();
      if (phoneDigits) params.set('p', phoneDigits);
      params.set('lat', String(msg.locationLat));
      params.set('lng', String(msg.locationLng));
      const menuUrl = buildPublicMenuUrl(client, { appOrigin: origin, query: params });

      // Try to compute the assigned outlet so the customer sees an
      // immediate "Your order will be prepared at <outlet>" line.
      // Failure here is non-fatal — the link itself still works.
      let outletLine = '';
      try {
        const { getOutletsForClient, assignOutletByLocation } = await import('@/lib/db/outlets');
        const outlets = await getOutletsForClient(client.client_id);
        if (outlets.length > 1) {
          const assigned = assignOutletByLocation(outlets, msg.locationLat, msg.locationLng);
          if (assigned) {
            if (assigned.inZone) {
              outletLine = `\nYour order will be prepared at our ${assigned.outlet.name} outlet (${assigned.distanceKm.toFixed(1)} km away).`;
            } else {
              outletLine = `\nNearest outlet (${assigned.outlet.name}) is ${assigned.distanceKm.toFixed(1)} km away — outside our delivery zones. Takeaway from there is still an option.`;
            }
          }
        }
      } catch (err) {
        console.error('[location] outlet assignment failed (non-fatal)', err);
      }

      const reply =
        `Got it 📍${outletLine}\n\nTap below to view the menu and place your order:\n${menuUrl}\n\n` +
        `Tap items → pick delivery / takeaway / dine-in → place order. Confirmation comes back on WhatsApp.`;
      await addConversationMessage({
        timestamp,
        client_id: client.client_id,
        customer_phone: customerPhone,
        direction: 'incoming',
        message: `📍 ${msg.locationLat.toFixed(5)}, ${msg.locationLng.toFixed(5)}${msg.locationAddress ? ` — ${msg.locationAddress}` : ''}`,
        message_type: 'location',
      });
      await sendWhatsAppMessage(phoneNumberId, customerPhone, reply);
      await addConversationMessage({
        timestamp: getISTTimestamp(),
        client_id: client.client_id,
        customer_phone: customerPhone,
        direction: 'outgoing',
        message: reply,
        message_type: 'text',
      });
      continue;
    }

    // ─── Restaurant: welcome-menu "See the menu" tap short-circuit ───
    // When a customer taps a list-reply row with id 'menu' / 'services' /
    // 'order' we know exactly what to send — the public menu link — so
    // bypass the AI entirely. Previously this leaned on the AI emitting
    // a literal [MENU_LINK] token; the model occasionally paraphrased it
    // and the customer got an unhelpful reply with no link.
    if (
      client.type === 'restaurant'
      && isListReplyTap
      && (msg.interactiveListId === 'menu'
          || msg.interactiveListId === 'services'
          || msg.interactiveListId === 'order')
    ) {
      // 2-min double-tap guard. If this phone placed a non-cancelled
      // order in the last 2 minutes, send the menu link with the
      // ?new=1 bypass flag pre-set — the /m page will surface the
      // "Place a different order" intercept which gives the customer
      // an explicit "yes I want another" confirmation. Stops spam
      // accidental-tap dupes without trapping a genuine second order.
      const { getRecentOrderForCustomer } = await import('@/lib/db/restaurant-dine-in');
      const recent = await getRecentOrderForCustomer(client.client_id, customerPhone).catch(() => null);
      const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') || 'https://www.zaptext.shop';
      const phoneDigits = (msg.from || '').replace(/\D/g, '');
      if (recent) {
        const params = new URLSearchParams();
        if (phoneDigits) params.set('p', phoneDigits);
        params.set('new', '1');
        const menuUrl = buildPublicMenuUrl(client, { appOrigin: origin, query: params });
        const dupeReply =
          `You just placed an order with us — the kitchen is on it.\n\n` +
          `Need to add items? Just reply here and we'll update the order.\n` +
          `Or, if this is a DIFFERENT order (someone else / different address), tap below to place a new one:\n${menuUrl}`;
        await sendWhatsAppMessage(phoneNumberId, customerPhone, dupeReply);
        await addConversationMessage({
          timestamp: getISTTimestamp(),
          client_id: client.client_id,
          customer_phone: customerPhone,
          direction: 'outgoing',
          message: dupeReply,
          message_type: 'text',
        });
        continue;
      }
      const menuUrl = buildPublicMenuUrl(client, {
        appOrigin: origin,
        query: phoneDigits ? new URLSearchParams({ p: phoneDigits }) : undefined,
      });
      const reply =
        `Yahaan se menu dekho aur order karo 👇\n${menuUrl}\n\n` +
        `Tap items → pick delivery / takeaway / dine-in → place order. Confirmation WhatsApp pe aa jayegi.`;
      await sendWhatsAppMessage(phoneNumberId, customerPhone, reply);
      await addConversationMessage({
        timestamp: getISTTimestamp(),
        client_id: client.client_id,
        customer_phone: customerPhone,
        direction: 'outgoing',
        message: reply,
        message_type: 'text',
      });
      continue;
    }

    // ─── Restaurant dine-in intercept ─────────────────────────────────
    // ─── Reorder shortcut ────────────────────────────────────────────
    // Customer types "reorder" / "phir wahi" / "same as last time" /
    // "repeat order" → fetch their most-recent non-cancelled order from
    // dine_in_orders and send it back with the menu link to confirm.
    // Saves them re-typing or re-tapping items. Fires before the AI so
    // we don't burn a Groq call on a deterministic reply.
    if (client.type === 'restaurant' && msg.type === 'text' && msg.text) {
      const lower = msg.text.trim().toLowerCase();
      const REORDER_PATTERNS = [
        /^reorder$/, /^re-order$/,
        /^repeat( my)? (last )?order$/,
        /^same as last( time| order)?$/,
        /^phir wahi$/, /^wahi order$/, /^pichla order$/,
        /^last order$/,
      ];
      if (REORDER_PATTERNS.some((re) => re.test(lower))) {
        try {
          const { getLastOrderForCustomer } = await import('@/lib/db/restaurant-dine-in');
          const last = await getLastOrderForCustomer(client.client_id, customerPhone);
          if (last) {
            const itemsLine = last.items.map((it) => `• ${it.qty}× ${it.name}`).join('\n');
            const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') || 'https://www.zaptext.shop';
            const menuUrl = buildPublicMenuUrl(client, {
              appOrigin: origin,
              query: new URLSearchParams({ p: customerPhone }),
            });
            const reply = [
              `Last time you ordered:`,
              itemsLine,
              `Total: ₹${Math.round(last.total).toLocaleString('en-IN')}`,
              ``,
              `Tap here to repeat or change anything 👇`,
              menuUrl,
              ``,
              `Pichli baar yeh order tha:`,
              itemsLine,
              `Total: ₹${Math.round(last.total).toLocaleString('en-IN')}`,
              `Wahi dohrana hai ya kuch change? Tap karo 👆`,
            ].join('\n');
            await sendWhatsAppMessage(phoneNumberId, customerPhone, reply);
            await addConversationMessage({
              timestamp, client_id: client.client_id, customer_phone: customerPhone,
              direction: 'incoming', message: msg.text, message_type: msg.type,
            });
            await addConversationMessage({
              timestamp: getISTTimestamp(), client_id: client.client_id, customer_phone: customerPhone,
              direction: 'outgoing', message: reply, message_type: 'text',
            });
            continue;
          }
          // No prior order → fall through to normal flow (AI will offer menu link).
        } catch (err) {
          console.error('[reorder] lookup failed — falling through', err);
        }
      }
    }

    // QR-scan greeting, session open/refresh, CLOSE / home-delivery
    // confirmation gate. Fires only for restaurant bots; returns
    // handled=true with a bilingual reply when it owns the message.
    if (client.type === 'restaurant') {
      try {
        const { handleDineInIncoming } = await import('@/lib/restaurant/dine-in-handler');
        // Respect bot's configured languages if set to English-only;
        // otherwise default to bilingual (safe for first-time scanners).
        let botLanguages: string[] | undefined;
        try {
          if (client.knowledge_base_json) {
            const kbObj = JSON.parse(client.knowledge_base_json) as Record<string, unknown>;
            if (Array.isArray(kbObj.languages)) {
              botLanguages = (kbObj.languages as unknown[]).filter((v): v is string => typeof v === 'string');
            }
          }
        } catch { /* ignore — bilingual default */ }
        const dineRes = await handleDineInIncoming({
          client_id: client.client_id,
          client_type: client.type,
          business_name: client.business_name,
          customer_phone: customerPhone,
          message: msg.text,
          languages: botLanguages,
        });
        if (dineRes.handled && dineRes.reply) {
          await sendWhatsAppMessage(phoneNumberId, customerPhone, dineRes.reply);
          await addConversationMessage({
            timestamp: getISTTimestamp(),
            client_id: client.client_id,
            customer_phone: customerPhone,
            direction: 'outgoing',
            message: dineRes.reply,
            message_type: 'text',
          });
          if (dineRes.suppressAi) continue;
        }
      } catch (err) {
        console.error('[dine-in] intercept failed — falling through to AI', err);
      }
    }

    // ─── Live-takeover pause check ────────────────────────────────────
    // If the owner has clicked "Take over" for this customer in the
    // dashboard, we LOG the inbound (so they see it in the thread view)
    // but do NOT run AI. The owner is responsible for replying via the
    // /api/client/conversations/send endpoint.
    if (await isCustomerPaused(client.client_id, customerPhone).catch(() => false)) {
      console.log(`[paused-customer] AI skipped for ${client.client_id}/${customerPhone}`);
      continue;
    }

    // ─── Welcome menu ─────────────────────────────────────────────────
    // First message in the last 7 days (and not itself a list-tap)?
    // Send the configured welcome menu and skip AI for THIS turn — the
    // customer's chosen option will arrive as the next inbound (a
    // list_reply) and flow through normally with msg.text = the row
    // title and msg.interactiveListId = the row id.
    const incomingTs = new Date(timestamp);
    if (!isListReplyTap) {
      // Two-layer first-contact check:
      //   (a) hasRecentInboundMessage — primary signal. Fails open if two
      //       inbound rows share a wall-clock timestamp (rare but observed
      //       on bursty / replayed webhooks).
      //   (b) hasRecentWelcomeMenuSent — defensive guard. Even if (a)
      //       mis-detects, the menu won't re-fire if we already sent one
      //       to this customer in the last 7 days. Prevents the
      //       "option chooser opens again on every message" bug.
      const [hasPriorInbound, alreadySentMenu] = await Promise.all([
        hasRecentInboundMessage(client.client_id, customerPhone, 7, incomingTs),
        hasRecentWelcomeMenuSent(client.client_id, customerPhone, 7).catch(() => false),
      ]);
      const isFirstContact = !hasPriorInbound && !alreadySentMenu;
      if (isFirstContact) {
        // DPDPA 2023 §6 evidence: the customer's first inbound message
        // in our 7-day window opens the 24-h customer service window
        // and constitutes consent to a transactional reply. NOT a
        // marketing opt-in. Log fire-and-forget so a DB hiccup never
        // delays the welcome menu.
        void recordConsentEvent({
          client_id: client.client_id,
          customer_phone: customerPhone,
          event_type: 'inbound_csw',
          source: 'webhook',
          business_name_shown: client.business_name,
          categories: ['transactional'],
        });
        try {
          const menu = await getWelcomeMenu(client);
          if (menu) {
            const fallback =
              `${menu.header}\n\n${menu.body}\n\n` +
              menu.items.map((i, idx) => `${idx + 1}. ${i.label}`).join('\n');
            await sendWhatsAppList(
              phoneNumberId,
              customerPhone,
              menu.header,
              menu.body,
              menu.footer,
              menu.buttonText,
              menu.items.map((i) => ({ id: i.id, title: i.label, description: i.description })),
              fallback
            );
            await addConversationMessage({
              timestamp: getISTTimestamp(),
              client_id: client.client_id,
              customer_phone: customerPhone,
              direction: 'outgoing',
              message: `[welcome-menu] ${menu.items.map((i) => i.label).join(' | ')}`,
              message_type: 'interactive',
            });
            continue; // skip AI for the first-contact turn
          }
        } catch (err) {
          console.error('[welcome-menu] failed; falling back to AI', err);
        }
      }
    }

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

    // Only inject booking context when the plan actually has bookings
    // enabled. Without this gate, trial bots got a full BOOKING INSTRUCTIONS
    // block in the prompt, AI would emit [BOOK:] tags, and the
    // feature-gate strip-step would chop them out — leaving the customer
    // with sentences like "Great! Let me confirm: " and nothing else.
    // Skipping the inject is cleaner than stripping the output.
    const bookingsEnabled = canUse(planKey, 'bookings').allowed;
    let availabilityContext = '';
    if (isBookingRelated && bookingsEnabled) {
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

    // Payment context: teach bot the [PAY:] tag only when UPI is configured
    // AND the plan permits payment tags (otherwise the strip-step removes
    // [PAY:] downstream and leaves a half-finished response).
    const paymentsEnabled = canUse(planKey, 'payments').allowed;
    let paymentContext = '';
    if (client.upi_id && paymentsEnabled) {
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
    // Gated on plan having inventory enabled — same rationale as booking
    // and payment contexts above (avoids prompts that promise tags the
    // strip-step will silently remove).
    const inventoryEnabled = canUse(planKey, 'inventory').allowed;
    const orderCapable = !isTrialBot && inventoryEnabled;
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
          // Zomato / Swiggy convention (verified Nov 2026 across their apps):
          //   stock 0                                  → "Sold out" / "Currently unavailable"
          //   0 < stock ≤ low_stock_threshold (or ≤ 5) → "Only N left" / "Few left" (urgency cue)
          //   stock > threshold                        → no badge (just available — exposing
          //                                              large exact counts feels weird to a
          //                                              customer; "23 left" reads as inventory
          //                                              software, not a menu)
          //   time-windowed                            → "Available HH:MM–HH:MM"
          // We mirror this in the prompt so the AI can speak the same way the
          // customer is used to hearing from food/grocery apps.
          const lowDefault = 5;
          const lines = active.map((i) => {
            const priceBit = i.price > 0 ? ` · ₹${i.price}` : '';
            const availableNow = isItemAvailableNow(i, now);
            const windowNote = formatAvailabilityHuman(i);
            // Items with tracks_stock=false ignore the stock counter (services,
            // unlimited-prep menu items, etc.). Treat them as "available" so the
            // AI doesn't accidentally refuse them.
            const tracksStock = i.tracks_stock !== false;

            if (tracksStock && i.stock === 0) {
              return `- ${i.name}${priceBit}: SOLD OUT — tell the customer "Sorry, abhi ${i.name} sold out hai" and suggest an alternative.`;
            }
            if (!availableNow) {
              return `- ${i.name}${priceBit}: UNAVAILABLE NOW (only ${windowNote}) — say "${i.name} abhi available nahi hai, ${windowNote} ke beech milta hai".`;
            }
            const threshold = i.low_stock_threshold && i.low_stock_threshold > 0
              ? i.low_stock_threshold
              : lowDefault;
            const winSuffix = windowNote === 'always available' ? '' : ` · ${windowNote}`;
            if (tracksStock && i.stock > 0 && i.stock <= threshold) {
              // Low-stock urgency cue — mirror Zomato's "Only N left" badge.
              const urgency = i.stock === 1
                ? `LAST ONE LEFT — say "bas 1 hi bacha hai, jaldi karein"`
                : `ONLY ${i.stock} LEFT — say "sirf ${i.stock} bache hain, jaldi karein"`;
              return `- ${i.name}${priceBit}${winSuffix} :: ${urgency}.`;
            }
            // Normal availability — DON'T mention the exact stock count to the
            // customer (Zomato/Swiggy never say "23 plates left"). Internally we
            // still track it for the [ORDER:] reservation; the AI just confirms
            // "available" / "in stock".
            return `- ${i.name}${priceBit}${winSuffix} :: available (tracking stock internally${tracksStock ? `: ${i.stock}` : ': untracked'} — do NOT mention this number to the customer).`;
          });
          stockBlock =
            `\nCURRENT IST TIME: ${istNow}` +
            `\nLIVE STOCK — Zomato/Swiggy-style availability rules:` +
            `\n  • SOLD OUT items: refuse the order politely and suggest an alternative from the available list.` +
            `\n  • ONLY N LEFT (low-stock): proactively tell the customer ("sirf 2 bache hain, jaldi karein") so they don't get disappointed mid-order. This is what Swiggy / Zomato do.` +
            `\n  • UNAVAILABLE NOW (time-windowed): name the exact window the item returns ("breakfast 7–11 AM milta hai").` +
            `\n  • Normal availability: just say it's available. NEVER quote large exact stock counts to a customer — "23 left" sounds like a warehouse, not a menu.` +
            `\n  • When the customer asks "is X available?" — answer in 1 short line using the rules above, in the customer's language.` +
            `\n  • For VOICE NOTES the customer sends: reply in the SAME conversational style — do NOT switch to a numbered list, just say "haan, butter chicken available hai, ₹449" naturally.` +
            `\nITEMS:\n${lines.join('\n')}\n`;
        }
      } catch {
        // ignore
      }
      orderContext = `

ORDER INSTRUCTIONS (food / product orders):

═══ MANDATORY ORDER FLOW — NEVER SHORTCUT THIS ═══

For EVERY order (voice, text, list-reply — all routes), you MUST collect
these four data points IN THIS ORDER before saying the order is placed:

  STEP 1. ITEMS + QUANTITIES — confirm the dish names and counts, and
          repeat back the subtotal in ₹.
          Example: "Got it — 1 × Chicken 65 (₹189). Anything else?"

  STEP 2. SERVICE MODE — explicitly ASK: "Dine-in, takeaway, or delivery?"
          This question is REQUIRED. Do not skip it even if the customer
          seems eager to finish. The customer's "no, that's all" answers
          STEP 1 (no more items), NOT step 2 — you still need their mode.

  STEP 3. ADDRESS (delivery only) — if step 2 = delivery, ask "Please
          share your delivery address with pincode." If step 2 = dine-in,
          ask "Which table?" or "Walk-in or reservation?". If step 2 =
          takeaway, ask "Approximate pickup time?".

  STEP 4. PAYMENT METHOD MENTION — once you have steps 1-3, say
          (translated to customer's language): "Cash on delivery — paise
          delivery boy ko de dijiyega" (for delivery) or "Cash at the
          counter — venue par cash payment" (for dine-in/takeaway). This
          bot is COD-ONLY right now; never share UPI / Razorpay / online
          payment links.

ONLY AFTER all four steps are complete in the SAME conversation, emit
the [ORDER:...] tag in the SAME reply as your final confirmation. Never
in separate messages.

═══ THE [ORDER:...] TAG — strict format ═══

Use EXACTLY this tag: [ORDER:total:items:address:notes]
  - total: numeric rupee amount (no currency symbol, no commas)
  - items: comma-separated quantity×name tokens, e.g. "2xDum Biryani,1xVeg Pulao"
  - address: delivery address (for delivery orders) OR "table N" / "walk-in" / "takeaway 8pm" (otherwise)
  - notes: optional (e.g. "extra spicy", "no onion", "low salt")

  Example (delivery):  [ORDER:560:2xDum Biryani,1xVeg Pulao:Koramangala 5th Block 560034:extra spicy]
  Example (dine-in):   [ORDER:320:1xMasala Dosa,1xFilter Coffee:table 4:]
  Example (takeaway):  [ORDER:189:1xChicken 65:takeaway 7:30pm:]

The webhook PARSES the tag and writes to the orders table, fires owner
notifications, decrements inventory. WITHOUT the tag, nothing happens
server-side — no order row, no email, no dashboard update.

═══ HARD RULES (zero tolerance) ═══

- NEVER say "your order is placed" / "order pakka" / "order confirmed"
  / "order ho gaya" / any equivalent phrasing — IN ANY LANGUAGE — UNLESS
  the same reply ALSO contains a properly-formed [ORDER:...] tag.
  If you write "order placed" without the tag, the customer thinks the
  order went through but nothing happens server-side. This is the most
  damaging bug — DO NOT do it.

- NEVER emit [ORDER:...] until ALL of: items confirmed, service mode
  asked, address captured (for delivery). An [ORDER:...] tag with empty
  address on a delivery order = bot is bypassing step 3 = wrong.

- If the customer says "1 plate chicken 65 chahiye" and then says "no
  bas yahi" / "nothing else" / "that's all", that ONLY means they don't
  want more items. You STILL have to ask the mode + address. Reply:
  "Theek hai, total ₹189. Aap dine-in, takeaway ya delivery chahte hain?"

- Use [ORDER:] ONCE per completed order. Never emit two tags in the
  same reply. Never emit a tag for a partial order ("I'll add more in
  the next message" is fine — don't tag until they're done).

ITEM-MATCHING RULES (CRITICAL — voice transcripts and typed messages are messy, be generous):
- The LIVE STOCK list below is the authoritative menu. EVERY item the customer can possibly order is in that list. If the list shows "Chicken 65" with stock > 0, that item IS available — never tell the customer it doesn't exist.
- Match customer's wording FUZZILY against the LIVE STOCK list. Examples that should ALL resolve to "Chicken 65":
    "chicken 65" / "chicken sixty five" / "chicken sixty-five" / "1 plate chicken 65" /
    "ek chicken 65" / "chiken 65" / "chicken sixty 5" / "chicken sixtyfive" /
    "chicken six five" (voice mis-spacing)
- Spoken-number variants ALWAYS map to digit variants in the menu: "sixty five" = "65", "two-fifty" = "250", "half plate" / "full plate" / "ek plate" / "one plate" are quantity modifiers, NOT separate items.
- Voice-note transcripts have ASR artifacts (missing letters, wrong words, no punctuation). Be charitable — if a customer says "manuth seekh kbab", match it to "Mutton Seekh Kebab" via overlap on key tokens (mutton / seekh / kebab). Confirm the exact item by name when you reply ("got it — Mutton Seekh Kebab").
- ONLY refuse with "item not available" when NO item in the LIVE STOCK list could plausibly match what the customer asked for (e.g. customer asks for "sushi" and the restaurant is Punjabi). In that case suggest 2-3 alternatives from the list.
- When you EMIT the [ORDER:...] tag, use the CANONICAL name from the LIVE STOCK list (so inventory decrement works) — but in your conversational reply to the customer, mirror their wording naturally.
- Never confirm or [ORDER:] an item that shows SOLD OUT in the LIVE STOCK list. Politely say it's sold out and suggest an alternative from the available items.${stockBlock}`;
    }

    // Staff context: inject active staff/trainers/doctors etc. into bot prompt.
    //
    // We always emit this block — even when zero staff are active. Soft-deleted
    // staff still leave their names in past assistant messages (the LLM sees
    // them via conversation history), and LLMs strongly pattern-match on prior
    // assistant turns. Silently omitting the section when activeStaff is empty
    // leaves the model with positive evidence ("earlier I said we have X") and
    // no negative evidence to override it — that's how a removed trainer keeps
    // getting mentioned. The empty-state block is the negative signal.
    let staffContext = '';
    // Hoisted so the prompt-generator step below can use it to scrub the gym
    // KB's free-text personalTraining.trainerInfo (which would otherwise leak
    // a removed trainer's name even when the AVAILABLE TRAINERS section is
    // empty).
    let activeStaffCount = 0;
    try {
      const activeStaff = await getActiveStaff(client.client_id);
      activeStaffCount = activeStaff.length;
      const roleLabel = STAFF_ROLE_LABELS[client.type] || DEFAULT_STAFF_LABEL;
      if (activeStaff.length > 0) {
        const staffLines = activeStaff.map((m) => {
          const avail = formatAvailabilityForBot(m);
          const price = m.price > 0 ? ` · ₹${m.price}/session` : '';
          const specialty = m.specialty ? ` (${m.specialty})` : '';
          return `- ${m.name}${specialty}${price} · Available: ${avail}`;
        }).join('\n');
        staffContext = `

AVAILABLE ${roleLabel.plural.toUpperCase()} (AUTHORITATIVE — overrides any earlier message in this chat):
${staffLines}

If earlier messages in this conversation mentioned a ${roleLabel.singular.toLowerCase()} name NOT in the list above, that person is no longer available — do NOT mention them again. Only the names above are valid.

When a customer wants to book a specific ${roleLabel.singular.toLowerCase()}:
1. Confirm the ${roleLabel.singular.toLowerCase()} name + preferred date/time from the customer
2. Use [BOOK:date:time:customerName:${roleLabel.singular} - <Name>:notes] to create the booking
3. The system will notify them directly on WhatsApp for approval
4. Tell the customer: "Booking request bhej diya hai, woh confirm karenge jaldi."
5. Do NOT book a slot that falls outside their listed available hours.`;
      } else {
        staffContext = `

AVAILABLE ${roleLabel.plural.toUpperCase()} (AUTHORITATIVE — overrides any earlier message in this chat):
(none — there are currently NO active ${roleLabel.plural.toLowerCase()} for this business)

CRITICAL: If earlier messages in this conversation mentioned a specific ${roleLabel.singular.toLowerCase()} by name (e.g. "our trainer is X", "₹2000/session with Y", any schedule like "09:00–18:00 Monday to Sunday"), that person has been removed and is NO LONGER available. Do NOT repeat their name, price, or schedule. Do NOT confirm to the customer that any specific ${roleLabel.singular.toLowerCase()} exists, even if you previously said so in this chat.

If the customer asks about a ${roleLabel.singular.toLowerCase()}, follow the empty-trainers rule in the system prompt and direct them to the owner. Do not invent or recall names from earlier in the chat.`;
      }
    } catch { /* ignore */ }

    // Plan quota check via feature-gates. Trial = hard lifetime cap (refuse
    // to send beyond TRIAL_MESSAGE_LIMIT). Paid plans = soft monthly cap
    // (allow with overage warning logged; metered billing TBD when the
    // overage invoicing system ships).
    const used = isTrialBot ? trialOutboundCount : monthlyOutboundCount;
    const quota = checkMessageQuota(planKey, used);
    if (!quota.allowed && quota.hardCap) {
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
    if (!isTrialBot && quota.remaining === 0) {
      // Paid plan over cap — service continues but we log so overage can
      // be reconciled at month end. Owner-facing dashboard banner TBD.
      console.warn(`[quota-overage] client=${client.client_id} plan=${planKey} used=${used} cap=${quota.cap}`);
    }

    // Generate the system prompt FRESH from the bot's knowledge_base_json
    // on every message — so any change to lib/prompt-generator.ts (e.g.
    // tightening language rules) reaches every active bot immediately,
    // without needing to re-save settings or run a regen script. The
    // stored client.system_prompt column is now a snapshot for admin
    // viewing only, never the source of truth at runtime.
    //
    // Fallback: if knowledge_base_json is empty or corrupt (legacy or
    // mid-migration bots), fall back to the stored prompt so the bot
    // doesn't go dark.
    let basePrompt = client.system_prompt;
    try {
      const kb = client.knowledge_base_json
        ? (JSON.parse(client.knowledge_base_json) as ClientConfig)
        : null;
      if (kb && (kb as { type?: string }).type) {
        // Hydrate the KB with client-row fields so the prompt generator
        // never interpolates `undefined` into the WELCOME MESSAGE TEMPLATE
        // or the "AI WhatsApp assistant for ${businessName}" header.
        //
        // The seed/demo path (and some legacy bots) stores knowledge_base_json
        // without businessName/ownerName/welcomeMessage — those live on the
        // clients table column instead. Without this hydration the runtime
        // prompt literally contained "Welcome to undefined!" and the LLM
        // dutifully echoed that to customers.
        const hydratable = kb as unknown as Record<string, unknown>;
        const safeBusinessName = (client.business_name || '').trim() || 'our business';
        if (!hydratable.businessName) hydratable.businessName = safeBusinessName;
        if (!hydratable.ownerName) hydratable.ownerName = client.owner_name || '';
        if (!hydratable.whatsappNumber) hydratable.whatsappNumber = client.whatsapp_number || '';
        if (!hydratable.contactNumber) hydratable.contactNumber = client.contact_number || '';
        if (!hydratable.city) hydratable.city = client.city || '';
        if (!hydratable.address) hydratable.address = (hydratable.address as string) || (hydratable.location as string) || '';
        if (!hydratable.workingHours) hydratable.workingHours = (hydratable.businessHours as string) || '';
        if (!hydratable.welcomeMessage) {
          hydratable.welcomeMessage = `Welcome to ${safeBusinessName}! How can I help you today?`;
        }
        if (!Array.isArray(hydratable.languages) || (hydratable.languages as unknown[]).length === 0) {
          hydratable.languages = ['English'];
        }
        // Scrub gym-only `personalTraining.trainerInfo` when no active staff:
        // this is a free-text field that owners may have populated with a
        // specific trainer's name/credentials when adding them. Removing the
        // staff row alone leaves this string in the prompt, so the LLM still
        // names a trainer that no longer exists. The AVAILABLE TRAINERS
        // section already handles the structured staff list; this clears the
        // unstructured side-channel.
        if ((kb as { type?: string }).type === 'gym' && activeStaffCount === 0) {
          const gymKb = kb as Extract<ClientConfig, { type: 'gym' }>;
          if (gymKb.personalTraining) {
            gymKb.personalTraining = { ...gymKb.personalTraining, trainerInfo: '' };
          }
        }
        basePrompt = generateSystemPrompt(kb);
      }
    } catch (e) {
      console.error('[webhook] generateSystemPrompt fresh failed, using stored snapshot:', e);
    }

    // Plan-feature language gate. Free tier is English-only — append a
    // hard rule the AI is instructed to follow, even if the customer
    // messages in Hindi/Tamil/etc. (multi_language is gated to paid plans
    // for upsell value.) Paid plans get no append, so generateSystemPrompt's
    // existing language autodetection runs as before.
    if (!canUse(planKey, 'multi_language').allowed) {
      basePrompt +=
        '\n\nLANGUAGE RULE (STRICT, FREE TIER): Reply in English ONLY. ' +
        'Even if the customer writes in Hindi, Hinglish, Tamil, Bengali, or any other language, your reply MUST be in English. ' +
        'You may briefly acknowledge their language ("Got it!") but the substantive answer must be in English.';
    }

    // Dine-in context: if this customer has an open table session, tell the
    // AI which table they're at so food items in the message are treated
    // as table additions (not home-delivery queries). The intercept above
    // handles QR scans + commands; this branch fires for free-text food
    // requests mid-session.
    let dineInContext = '';
    if (client.type === 'restaurant') {
      try {
        const { describeActiveSession } = await import('@/lib/restaurant/dine-in-handler');
        const active = await describeActiveSession(client.client_id, customerPhone);
        if (active) {
          dineInContext =
            `\n\nDINE-IN SESSION ACTIVE:\n` +
            `Customer is currently at Table ${active.tableNumber}.\n` +
            `Treat any food items they mention as additions to THIS table's order.\n` +
            `Do NOT ask for a delivery address. Do NOT switch to home-delivery mode.\n` +
            `If they want to leave or pay, tell them to type "CLOSE TABLE".\n` +
            `If they explicitly mention home delivery, ask them to confirm: add to table, CLOSE TABLE, or PARCEL.`;
        }
      } catch (err) {
        console.error('[dine-in] describeActiveSession failed', err);
      }
    }

    // ── Allergen-safety guardrail (Work Item 4) ─────────────────────────
    // FSSAI 2020 Menu Labelling Regulations make allergen declaration
    // mandatory for chains with 10+ outlets / Central License holders.
    // Owners are supposed to populate allergens[] on every menu item, but
    // most onboarding flows leave it blank. The bot used to politely
    // defer ("please confirm with kitchen") which can read as "probably
    // safe" to a customer with a nut allergy.
    //
    // When allergen_strict_mode is on (default for every bot), we inject
    // a hard refusal instruction. The bot reads stockBlock + menu context
    // already; this just teaches the right wording when allergens[] is
    // missing. Cheap — adds ~120 tokens to the prompt.
    let allergenContext = '';
    if (client.type === 'restaurant' && client.allergen_strict_mode !== false) {
      const ownerCallNumber =
        (client.contact_number && client.contact_number.trim()) ||
        client.whatsapp_number ||
        '';
      const phoneLine = ownerCallNumber
        ? ` Tell them to call ${ownerCallNumber} for a definitive answer.`
        : ' Tell them to call the kitchen directly for a definitive answer.';
      allergenContext =
        '\n\nALLERGEN SAFETY (FSSAI / customer health — STRICT, do not relax):\n' +
        '- Allergen keywords to watch for in customer messages: nut, peanut, mungphali, almond, badam, cashew, kaju, walnut, akhrot, pistachio, pista, hazelnut, brazil, sesame, til, dairy, milk, doodh, lactose, cheese, paneer (when asked about dairy), butter, cream, ghee, egg, anda, andaa, gluten, wheat, atta, maida, soy, soya, fish, machhi, shellfish, prawn, jhinga, crab, mustard, sarson, kasundi.\n' +
        '- When the customer asks whether an item is safe for any of these allergens AND the item\'s declared allergen list in your menu data is empty / missing for that allergen: REFUSE to confirm safety. Reply (in the customer\'s language): "Sorry, I cannot confirm allergen information for that item." then suggest they call to confirm.' + phoneLine + '\n' +
        '- When the item\'s declared allergen list explicitly INCLUDES the asked allergen: say so plainly ("Yes, [item] contains [allergen]. Please avoid if you\'re allergic.").\n' +
        '- When the item\'s declared allergen list explicitly EXCLUDES it (e.g. allergens=["dairy"] and the customer asks about peanuts, AND the item is NOT in a typical peanut category like Thai/Chinese): you may confirm the absence — but still recommend calling for severe allergies.\n' +
        '- NEVER guess. NEVER say "should be safe" / "I think so" / "probably not" / "it should be fine". A wrong allergen answer can cause anaphylaxis — refusal is always the safer choice when data is missing.';
    }

    // ── Kitchen capacity gate (Work Item 5) ─────────────────────────────
    // Restaurant-only. Count in-flight kitchen orders (status placed /
    // preparing / ready, created in the last 15 min). When the count
    // reaches the owner-configured ceiling (default 8), inject a hard
    // instruction telling the bot NOT to emit [ORDER:] and instead
    // quote a wait time. Suggested fallback time = 20 min from now,
    // which is a reasonable lunch-rush recovery window.
    //
    // Why a soft prompt-gate not a hard tag-strip: the existing strip
    // pipeline is plan-feature based (free vs paid). Capacity is
    // operational, not commercial. Trust the prompt; if the LLM still
    // emits [ORDER:] under capacity-mode, the downstream reservation
    // code is the floor (it will still attempt the order, just one
    // extra above cap — kitchen survives one). Hardening to a tag
    // strip is a Phase 2 sharpening.
    let capacityContext = '';
    if (client.type === 'restaurant' && orderCapable) {
      try {
        const PLATFORM_DEFAULT_CAP = 8;
        const rawCap = client.concurrent_order_cap;
        const cap = typeof rawCap === 'number' && rawCap > 0
          ? Math.min(200, Math.floor(rawCap))
          : PLATFORM_DEFAULT_CAP;
        const activeNow = await countActiveKitchenOrders(client.client_id);
        if (activeNow >= cap) {
          // Compute a wait quote: 20 min from now, rounded to nearest 5
          // for readability. IST formatting because that's what owners
          // and customers expect.
          const wait = new Date(Date.now() + 20 * 60 * 1000);
          const istTime = new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          }).format(wait);
          capacityContext =
            '\n\nKITCHEN AT CAPACITY (operational gate — IGNORE menu/order requests right now):\n' +
            `- ${activeNow} orders are currently in the kitchen (cap: ${cap}). The team can't take another order this moment.\n` +
            '- For ANY new order request reply (in the customer\'s language) with EXACTLY this pattern: ' +
            `"Bahut zyaada orders chal rahe hain right now — agar aap ${istTime} ya baad ke liye order place kar sakein toh seedha confirm ho jayega. Tab tak kuch aur puchna ho toh batayein."\n` +
            '- Translate that template into the customer\'s language. The KEY parts to keep: (a) busy now, (b) offer to schedule for ' + istTime + ', (c) keep the conversation open for non-order questions (menu lookup, hours, etc. are still fine).\n' +
            '- Do NOT emit any [ORDER:...] tag while capacity is full. Do NOT promise a delivery time. Do NOT take partial orders.\n' +
            '- Menu queries, table reservations, allergen questions, opening-hours questions, and existing-order status checks are ALL fine — only NEW orders are paused.';
        }
      } catch (e) {
        console.error('[webhook] capacity-gate check failed (non-fatal):', e);
      }
    }

    // ── Escalation block (Work Item 7) ──────────────────────────────────
    // Only fires for the 'urgent' priority tier — health emergency, legal
    // threat, regulator complaint. The bot must NOT continue acting like
    // a salesperson; it acknowledges, apologises, promises an owner
    // callback, and refuses to emit any commercial tag. The 'attention'
    // tier still flows through the normal prompt — most refund / wrong-
    // order issues have a clear bot-handleable resolution.
    let escalationContext = '';
    if (inboundPriority === 'urgent') {
      const ownerCall =
        (client.contact_number && client.contact_number.trim()) ||
        client.whatsapp_number ||
        '';
      const callbackLine = ownerCall
        ? `The owner / manager will call back personally within 1 hour on ${ownerCall}.`
        : 'The owner / manager will call back personally within 1 hour.';
      escalationContext =
        '\n\nESCALATION (customer flagged a serious complaint — HIGHEST PRIORITY, override default behaviour):\n' +
        `- Customer's message contains escalation keywords: ${inboundPriorityMatched.slice(0, 5).join(', ')}.\n` +
        '- Do NOT minimise. Acknowledge what they said in their own words.\n' +
        '- Apologise sincerely in the customer\'s language. No corporate phrasing ("we regret any inconvenience" sounds like a brush-off — say "main bahut sorry hoon, aapko aisa experience mila").\n' +
        `- ${callbackLine} Mention this exact phrasing.\n` +
        '- Do NOT emit any [ORDER:...], [PAY:...], [BOOK:...] tag in this reply. Do NOT offer a discount, refund amount, or coupon — the owner makes those calls.\n' +
        '- Do NOT ask follow-up questions about the order — the owner will gather details themselves.\n' +
        '- Keep the reply short: 2-3 sentences. Anything longer feels evasive.\n' +
        '- After this reply the conversation flag stays "urgent" until the owner replies — so the dashboard ranks it at the top.';
    }

    // Generate AI response with booking + payment + order + staff context
    let aiResponse = await generateBotResponse(
      basePrompt + availabilityContext + paymentContext + orderContext + staffContext + dineInContext + allergenContext + capacityContext + escalationContext,
      pastHistory,
      msg.text
    );

    // ── Order-flow safety net ─────────────────────────────────────────────
    // The LLM is told (in orderContext) NEVER to say "order placed" without
    // emitting an [ORDER:...] tag in the same reply, and NEVER to emit
    // [ORDER:] without first asking the customer dine-in/takeaway/delivery
    // + capturing address for delivery. It still slips sometimes — saying
    // "your order is placed" without the tag means the customer thinks it's
    // done but the server never sees it (no DB row, no owner notification,
    // no inventory decrement). That's the most damaging bug.
    //
    // Detector: if the reply contains a confirmation phrase but no [ORDER:]
    // tag, we (a) log a warning so this surfaces in monitoring, (b) strip
    // the false confirmation, (c) replace with a polite "ek detail rah gayi"
    // course-correction that asks for service mode + address. Customer
    // never sees the misleading reply.
    //
    // The replacement message is rendered in the customer's most recent
    // message language — English / Hinglish / Hindi-Devanagari — using a
    // simple heuristic over msg.text (the same signal the LLM uses).
    if (client.type === 'restaurant' && orderCapable && aiResponse) {
      const hasOrderTag = /\[ORDER:[^\]]+\]/i.test(aiResponse);
      // Audit log — fires every time the safety net runs. Makes
      // post-deploy verification trivial: tail Vercel logs and grep for
      // [order-flow]. If you don't see this line on a restaurant turn,
      // the deploy hasn't gone live yet.
      console.log('[order-flow] safety-net check', {
        client_id: client.client_id,
        customer_phone: customerPhone,
        has_order_tag: hasOrderTag,
        ai_reply_first_200: aiResponse.slice(0, 200),
      });
      // Sentence-level detection so wording like "Your order for 1 plate of
      // Chicken 65 is placed" (which has noise between 'order' and 'is
      // placed') still trips the safety net. We split on sentence-enders,
      // then check each sentence for the noun 'order' (or Hindi/Hinglish
      // equivalents) co-occurring with an affirmation verb. False-positive
      // risk is low because we restrict to a tight verb whitelist.
      const sentences = aiResponse.split(/[.!?\n]+/).map((s) => s.toLowerCase().trim()).filter(Boolean);
      const orderNounRe = /\border\b|\border for\b|\border has\b|\border is\b|आपका ऑर्डर|आर्डर|आर्डर/;
      // English + Hinglish + Devanagari affirmation verbs / phrases that
      // signal "we accepted and finalised the order" from the bot side.
      const affirmationRe = /\b(placed|confirmed|booked|done|successful|successfully|received and|noted and|finalised|finalized)\b|ho gaya|pakka|place ho gaya|confirm ho gaya|ho chuk|tay ho gay|पक्का|हो गया|हो चुक|तय हो|कन्फर्म/i;
      const confirmedClaim = sentences.some((s) => orderNounRe.test(s) && affirmationRe.test(s));
      if (confirmedClaim && !hasOrderTag) {
        console.warn('[order-flow] Bot claimed order placed without [ORDER:] tag. Course-correcting.', {
          client_id: client.client_id,
          customer_phone: customerPhone,
          ai_reply_preview: aiResponse.slice(0, 200),
        });
        // Pick the customer's language for the fallback. Simple heuristic
        // mirrors the LANGUAGE RULES in the system prompt — Devanagari
        // script wins immediately; two or more Hinglish keywords win
        // Hinglish; everything else defaults to English (the prompt's
        // own default).
        const customerText = (msg.text || '').toLowerCase();
        const hasDevanagari = /[ऀ-ॿ]/.test(msg.text || '');
        const hinglishKeywords = [
          'bhai', 'kya', 'kaise', 'kaisa', 'chahiye', 'milega', 'hain',
          'nahi', 'haan', 'karo', 'mein', 'aap', 'abhi', 'kitna', 'theek',
          'accha', 'bhejdo', 'batao', 'dijiye', 'mujhe', 'tumhe', 'hai',
        ];
        const hinglishHits = hinglishKeywords.reduce(
          (n, kw) => (customerText.includes(` ${kw} `) || customerText.startsWith(`${kw} `) || customerText.endsWith(` ${kw}`) || customerText === kw ? n + 1 : n),
          0
        );
        const lang: 'english' | 'hinglish' | 'hindi' =
          hasDevanagari ? 'hindi' : hinglishHits >= 2 ? 'hinglish' : 'english';
        const fallback =
          lang === 'hindi'
            ? 'एक मिनट — ऑर्डर place करने से पहले थोड़ा confirm करना है:\n\n' +
              '1. आप dine-in, takeaway, या delivery चाहते हैं?\n' +
              '2. अगर delivery है तो delivery address (with pincode) share करें।\n' +
              '3. अगर dine-in है तो कौन सा table, या walk-in?\n\n' +
              'Payment: cash on delivery (या venue पर) — अभी online payment available नहीं है।'
            : lang === 'hinglish'
            ? 'Ek minute — order place karne se pehle thoda confirm karna hai:\n\n' +
              '1. Aap dine-in, takeaway, ya delivery chahte hain?\n' +
              '2. Agar delivery hai toh delivery address (with pincode) share karein.\n' +
              '3. Agar dine-in hai toh kaunsa table, ya walk-in?\n\n' +
              'Payment: cash on delivery (or at the venue) — abhi online payment available nahi hai.'
            : 'One moment — before I place the order, a few quick details:\n\n' +
              '1. Would you like dine-in, takeaway, or delivery?\n' +
              '2. If delivery, please share your address (with pincode).\n' +
              '3. If dine-in, which table, or walk-in?\n\n' +
              'Payment: cash on delivery (or at the venue) — online payment is not available yet.';
        aiResponse = fallback;
      }
    }

    // Trial bots: strip premium tags BEFORE tag processing so booking /
    // payment / order / cancel / stock side effects are never triggered.
    // Generalised: per-feature stripping so the same logic enforces every
    // plan tier — not just trial. AI sometimes ignores instructions and
    // emits a [BOOK] tag even when told not to; this is the bulletproof
    // bottom-of-the-stack gate.
    //
    // ALSO: when a paid-feature tag IS stripped, that means the customer
    // explicitly asked for a feature the owner doesn't have. Fire a
    // contextual upsell DM to the owner ("your customer just asked to
    // book — upgrade and the bot will handle it next time"). Strongest
    // possible upsell — moment of maximum pain, real proof of lost
    // revenue. Rate-limited per (owner, feature) for 24hr to avoid spam.
    {
      const stripTags: string[] = [];
      if (!canUse(planKey, 'bookings').allowed) stripTags.push('BOOK', 'CANCEL');
      if (!canUse(planKey, 'payments').allowed) stripTags.push('PAY');
      if (!canUse(planKey, 'inventory').allowed) stripTags.push('ORDER', 'STOCK');
      if (stripTags.length > 0) {
        // Detect what was actually requested BEFORE stripping, so we can
        // tell the owner what specifically their bot couldn't handle.
        const detected = new Set<string>();
        const detectRe = new RegExp(`\\[(${stripTags.join('|')}):[^\\]]+\\]`, 'g');
        let match: RegExpExecArray | null;
        while ((match = detectRe.exec(aiResponse)) !== null) {
          detected.add(match[1].toUpperCase());
        }
        // Strip
        aiResponse = aiResponse.replace(
          new RegExp(`\\[(${stripTags.join('|')}):[^\\]]+\\]`, 'g'),
          ''
        ).trim();
        // Fire contextual upsell DM (fire-and-forget, never blocks reply)
        if (detected.size > 0) {
          notifyOwnerOfMissedFeature(
            client,
            phoneNumberId,
            Array.from(detected),
            planKey
          ).catch((e) => console.error('[upsell-dm] notify failed:', e));
        }
      }
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

        // Notify owner via WhatsApp — gated by per-client notify_whatsapp.
        // Default TRUE if undefined (legacy clients).
        if (client.notify_whatsapp !== false) {
          const ownerMsg = `🔔 *New Booking!*\n\n👤 ${name}\n📞 ${customerPhone}\n📅 ${date}\n🕐 ${time}\n${service ? `💼 ${service}\n` : ''}`;
          await sendWhatsAppMessage(phoneNumberId, client.whatsapp_number.replace('+', ''), ownerMsg);
        }
        // Notify owner via email — gated by per-client notify_email.
        if (client.notify_email !== false) {
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

    // [MENU_LINK] substitution — restaurant prompt teaches the AI to
    // emit this literal token when the customer asks for the menu, and
    // we replace it here with a per-customer URL into /m/<clientId>.
    // The page renders the full catalog, lets the customer build a cart,
    // pick delivery/takeaway/dine-in, then POSTs to /api/menu/submit
    // which writes the order and sends a WA confirmation.
    //
    // For voice notes / typed orders longer than 15 chars we also append
    // ?q=<inbound text>. The menu page reads this query and fuzzy-
    // matches the customer's words against item names, pre-selecting
    // anything that hits the cart — voice-order shortcut without
    // teaching the AI a more structured tag.
    if (client.type === 'restaurant' && finalResponse.includes('[MENU_LINK]')) {
      const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') || 'https://www.zaptext.shop';
      const phoneDigits = (msg.from || '').replace(/\D/g, '');
      const params = new URLSearchParams();
      if (phoneDigits) params.set('p', phoneDigits);
      // Only pass the query when the inbound looks like an order
      // intent — short messages like "menu" should NOT pre-populate
      // a cart with garbage matches. Cap kept modest so the URL stays
      // well under WhatsApp's link-preview length tolerance.
      const trimmed = (msg.text || '').trim();
      if (trimmed.length >= 15) params.set('q', trimmed.slice(0, 200));
      const menuUrl = buildPublicMenuUrl(client, { appOrigin: origin, query: params });
      finalResponse = finalResponse.replace(/\[MENU_LINK\]/g, menuUrl);
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

        // Real-time WhatsApp to owner — gated by per-client notify_whatsapp.
        if (client.notify_whatsapp !== false) {
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
        }

        // Email owner — gated by per-client notify_email.
        if (client.notify_email !== false) try {
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

    // Atomic post-send counter bump. The earlier read-based quota check
    // is still authoritative for the current message's gate, but this
    // counter is the authoritative source for the NEXT message's check
    // (and for /admin/quota dashboards). On heavy concurrency, two
    // messages that both passed the read-based gate will both increment
    // here too — but the next inbound on the same bot will see the true
    // post-increment value and reject if over cap. Best-effort: never
    // block reply send on counter errors.
    try {
      await incrementUsageAtomic(client.client_id, isTrialBot ? 'lifetime' : monthKey());
    } catch (err) {
      console.error('[usage-counter] increment failed (non-fatal):', err);
    }

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

// ─── Contextual upsell DM (fires when free-tier bot strips a paid tag) ───
//
// Triggered from inside processMessages whenever the AI emitted a
// [BOOK]/[PAY]/[ORDER] tag that we had to strip because the owner is on
// a plan that doesn't include the feature. The customer never sees the
// tag — but the OWNER deserves to know their bot just lost them a real
// request, and that one upgrade would have captured it.
//
// Rate-limited per (owner, category) to 24hr — first time the owner gets
// the alert is loud and clear, after that it dampens to once per category
// per day so we don't become noise.
//
// Fires only for trial bots; paid plans already have the feature unlocked
// so the strip wouldn't fire there.

const lastUpsellNotified = new Map<string, number>();
const UPSELL_COOLDOWN_MS = 24 * 60 * 60 * 1000;

interface ClientForUpsell {
  client_id: string;
  business_name: string;
  contact_number?: string;
  whatsapp_number: string;
  type: string;
  owner_user_id: string;
}

async function notifyOwnerOfMissedFeature(
  client: ClientForUpsell,
  phoneNumberId: string,
  features: string[],
  planKey: string
): Promise<void> {
  if (planKey !== 'trial') return;
  const ownerRaw = (client.contact_number?.trim() || client.whatsapp_number).replace(/\D/g, '');
  if (!ownerRaw || ownerRaw.length < 10) return;

  // Group by feature category — one alert covers BOOK+CANCEL together.
  let category: 'bookings' | 'payments' | 'inventory';
  if (features.includes('PAY')) category = 'payments';
  else if (features.includes('ORDER') || features.includes('STOCK')) category = 'inventory';
  else category = 'bookings';

  const cooldownKey = `${client.owner_user_id}:${category}`;
  const last = lastUpsellNotified.get(cooldownKey) || 0;
  if (Date.now() - last < UPSELL_COOLDOWN_MS) return;
  lastUpsellNotified.set(cooldownKey, Date.now());

  const verbByCategory: Record<string, string> = {
    bookings: 'book an appointment',
    payments: 'send a payment',
    inventory: 'place an order',
  };
  const actionByCategory: Record<string, string> = {
    bookings: 'book customers automatically',
    payments: 'send payment links automatically',
    inventory: 'take orders automatically',
  };
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zaptext.io';

  const message =
    `⚠ ZapText alert\n\n` +
    `A customer of *${client.business_name}* just asked to ${verbByCategory[category]} — but your Free plan only handles FAQs, so the bot couldn't act on it.\n\n` +
    `Upgrade to Starter (₹599/mo) and your bot will ${actionByCategory[category]} the next time. ` +
    `Most owners recover the upgrade cost in their first week.\n\n` +
    `Upgrade: ${baseUrl}/client/subscription#upgrade\n\n` +
    `_(One alert per category per day — won't spam.)_`;

  await sendWhatsAppMessage(phoneNumberId, ownerRaw, message);
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
    const { formatAvailabilityForBot } = await import('@/lib/staff');
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

// ─── Inline stale-pending sweep ─────────────────────────────────────────
// Mirrors /api/cron/auto-cancel-stale but runs piggybacking on every
// webhook invocation. Vercel Hobby tier only allows 2 daily crons total,
// so we lost the dedicated 15-min sweep — this fills the gap during
// active hours. The 2 daily crons (morning + evening) still call the
// dedicated endpoint as a backstop for bots with no recent customer
// activity.
//
// Safety: getStalePendingBookings query is indexed + returns 0 rows in
// the common case (most bots won't have a stuck pending booking at any
// given moment). Cheap to call on every message.

// Platform default + per-client override. Each client row may set
// stale_booking_minutes (clamped 30..240); when null we use the default.
// We query the global lower bound (30) and filter the rest in JS so the
// cron + webhook sweep don't have to issue per-client queries.
const STALE_SWEEP_DEFAULT_MINUTES = 60;
const STALE_SWEEP_LOWER_BOUND_MINUTES = 30;

function clampStaleMinutes(raw: number | null | undefined): number {
  if (raw == null || !Number.isFinite(raw)) return STALE_SWEEP_DEFAULT_MINUTES;
  return Math.max(30, Math.min(240, Math.floor(raw)));
}

async function sweepStalePendings() {
  // Pull every booking older than the absolute floor; per-client cutoffs
  // are applied below so a client with a 120-minute setting doesn't get
  // their bookings cancelled at 60.
  const stale = await getStalePendingBookings(STALE_SWEEP_LOWER_BOUND_MINUTES);
  if (stale.length === 0) return;

  const { getClientById } = await import('@/lib/google-sheets');
  const now = Date.now();

  for (const b of stale) {
    try {
      const realClient = await getClientById(b.client_id).catch((err) => {
        console.error('[stale-sweep] getClientById failed', { clientId: b.client_id, err });
        return null;
      });
      const cutoffMinutes = clampStaleMinutes(realClient?.stale_booking_minutes);
      const ageMinutes = b.created_at ? (now - new Date(b.created_at).getTime()) / 60000 : Infinity;
      if (ageMinutes < cutoffMinutes) continue; // not yet eligible for THIS client

      await cancelBooking(
        b.booking_id,
        `[AUTO-CANCEL: trainer did not respond within ${cutoffMinutes} minutes]`
      );

      if (!realClient?.phone_number_id) continue;

      if (b.customer_phone) {
        try {
          const trainerLine = b.service ? ` with ${b.service}` : '';
          const msg =
            `🙏 Sorry, we couldn't confirm your booking${trainerLine} for ${b.date} at ${b.time_slot} — no response from our side within ${cutoffMinutes} minutes.\n\n` +
            `Please reply with another preferred time and we'll set it up.\n\n` +
            `Hindi: 🙏 Maaf kijiye, ${b.date} ko ${b.time_slot} ki booking confirm nahi ho payi. Doosra time bhej dijiye, hum set kar denge.`;
          await sendWhatsAppMessage(realClient.phone_number_id, b.customer_phone, msg);
        } catch (e) {
          console.error('[stale-sweep] customer-notify failed:', e);
        }
      }

      if (b.staff_id) {
        try {
          const { getStaffById } = await import('@/lib/staff');
          const staff = await getStaffById(b.staff_id).catch((err) => {
            console.error('[stale-sweep] getStaffById failed', { staffId: b.staff_id, err });
            return null;
          });
          if (staff?.whatsapp_phone) {
            const msg =
              `⏰ Booking auto-cancelled\n\n` +
              `Customer: ${b.customer_name || b.customer_phone}\n` +
              `Slot: ${b.date} at ${b.time_slot}\n\n` +
              `No approve/reject response within ${cutoffMinutes} minutes — slot was freed automatically. ` +
              `If you still want this booking, ask the customer to rebook.`;
            await sendWhatsAppMessage(realClient.phone_number_id, staff.whatsapp_phone, msg);
          }
        } catch (e) {
          console.error('[stale-sweep] trainer-notify failed:', e);
        }
      }
    } catch (e) {
      console.error('[stale-sweep] cancel failed:', e);
    }
  }
}
