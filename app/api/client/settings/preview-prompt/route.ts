// ─── Live prompt preview ─────────────────────────────────────────────────
//
// Returns the FULL prompt Gemini will see for this bot at this moment:
//   client.system_prompt
//   + AVAILABLE TRAINERS (from staff DB, scoped to this client + active)
//   + LIVE STOCK (from inventory DB, with stock + time-window labels)
//
// Mirrors the runtime context-injection logic in app/api/webhook/route.ts
// so the owner can read EXACTLY what the bot is told. Read-only — no writes.

import { NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { getActiveStaff, formatAvailabilityForBot } from '@/lib/staff';
import { getActiveInventory, isItemAvailableNow, formatAvailabilityHuman } from '@/lib/inventory';
import { STAFF_ROLE_LABELS, DEFAULT_STAFF_LABEL } from '@/lib/types';

export async function GET() {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ error: 'No bot selected' }, { status: 404 });

  const sections: string[] = [];
  sections.push(bot.system_prompt || '(empty system_prompt)');

  // Staff section — same shape as webhook injection
  try {
    const activeStaff = await getActiveStaff(bot.client_id);
    if (activeStaff.length > 0) {
      const roleLabel = STAFF_ROLE_LABELS[bot.type] || DEFAULT_STAFF_LABEL;
      const lines = activeStaff.map((m) => {
        const avail = formatAvailabilityForBot(m);
        const price = m.price > 0 ? ` · ₹${m.price}/session` : '';
        const specialty = m.specialty ? ` (${m.specialty})` : '';
        return `- ${m.name}${specialty}${price} · Available: ${avail}`;
      }).join('\n');
      sections.push(
        `\n\nAVAILABLE ${roleLabel.plural.toUpperCase()}:\n${lines}\n` +
        `\nWhen a customer wants to book a specific ${roleLabel.singular.toLowerCase()}:\n` +
        `1. Confirm the ${roleLabel.singular.toLowerCase()} name + preferred date/time from the customer\n` +
        `2. Use [BOOK:date:time:customerName:${roleLabel.singular} - <Name>:notes] to create the booking\n` +
        `3. The system will notify them directly on WhatsApp for approval\n` +
        `4. Tell the customer: "Booking request sent — they'll confirm soon."\n` +
        `5. Do NOT book a slot that falls outside their listed available hours.`
      );
    } else {
      sections.push(`\n\n(AVAILABLE ${(STAFF_ROLE_LABELS[bot.type] || DEFAULT_STAFF_LABEL).plural.toUpperCase()}: none — add staff in /client/staff)`);
    }
  } catch (e) {
    sections.push(`\n\n[staff injection failed: ${String(e).slice(0, 200)}]`);
  }

  // Inventory section — same shape as webhook injection
  try {
    const active = await getActiveInventory(bot.client_id);
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
      sections.push(
        `\n\nCURRENT IST TIME: ${istNow}` +
        `\nLIVE STOCK (respect quantities AND time windows — do not order items marked NOT AVAILABLE RIGHT NOW):\n${lines.join('\n')}`
      );
    } else {
      sections.push('\n\n(LIVE STOCK: none — add items in /client/inventory)');
    }
  } catch (e) {
    sections.push(`\n\n[inventory injection failed: ${String(e).slice(0, 200)}]`);
  }

  return NextResponse.json({
    botId: bot.client_id,
    botName: bot.business_name,
    fullPrompt: sections.join(''),
    generatedAt: new Date().toISOString(),
  });
}
