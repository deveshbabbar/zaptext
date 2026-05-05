// ─── Client analytics — conversation volume, busy hours, top intents ────
//
// Aggregates the conversations + bookings tables into the shapes the
// /client/analytics page needs. Pure read; no DB writes.
//
// Performance note: pulls the entire conversation log for the active bot.
// Fine up to a few thousand rows; if a single bot ever crosses ~50k
// inbound rows, switch this to per-day pre-aggregation in a `analytics`
// table populated by a daily cron.

import { NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { getClientConversations } from '@/lib/google-sheets';
import { getBookingsByClient } from '@/lib/booking';

// Common stop words to exclude from "top keyword" detection so the
// surface is the actual customer intent, not "the / a / hi / hello".
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'am', 'i', 'you', 'me', 'my', 'your',
  'we', 'us', 'our', 'and', 'or', 'but', 'if', 'so', 'to', 'of', 'in',
  'on', 'at', 'for', 'with', 'from', 'by', 'this', 'that', 'it', 'its',
  'he', 'she', 'they', 'them', 'his', 'her', 'their', 'be', 'do', 'did',
  'have', 'has', 'had', 'will', 'would', 'should', 'can', 'could',
  'hi', 'hello', 'hey', 'sir', 'madam', 'ji', 'pls', 'please', 'thanks',
  'thank', 'ok', 'okay', 'yes', 'no', 'yeah', 'haan', 'nahi', 'kya',
  'kyu', 'kab', 'kaise', 'kahan', 'mein', 'main', 'aap', 'hum', 'tum',
  'koi', 'kuch', 'sab', 'bhi', 'bhai', 'bro', 'good', 'morning',
  'evening', 'night', 'day', 'right', 'sure', 'just', 'really',
]);

export async function GET() {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ error: 'No active bot' }, { status: 400 });

  try {
    const [convos, bookings] = await Promise.all([
      getClientConversations(bot.client_id),
      getBookingsByClient(bot.client_id, 'confirmed').catch(() => []),
    ]);

    // ── Volume by day (last 30 days) ───────────────────────────────────
    const now = new Date();
    const dayKeys: string[] = [];
    const volumeMap = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dayKeys.push(key);
      volumeMap.set(key, 0);
    }
    for (const m of convos) {
      const d = new Date(m.timestamp);
      if (Number.isNaN(d.getTime())) continue;
      const key = d.toISOString().slice(0, 10);
      if (volumeMap.has(key)) volumeMap.set(key, (volumeMap.get(key) || 0) + 1);
    }
    const volumeByDay = dayKeys.map((day) => ({ day, count: volumeMap.get(day) || 0 }));

    // ── Busy hours (IST, 0–23) ─────────────────────────────────────────
    const busy = new Array<number>(24).fill(0);
    for (const m of convos) {
      if (m.direction !== 'incoming') continue;
      const d = new Date(m.timestamp);
      if (Number.isNaN(d.getTime())) continue;
      // IST = UTC+5:30; getUTCHours + 5 normalises display.
      const istHour = (d.getUTCHours() + 5 + Math.floor((d.getUTCMinutes() + 30) / 60)) % 24;
      busy[istHour] += 1;
    }
    const busyHoursIST = busy.map((count, hour) => ({ hour, count }));

    // ── Top keywords (incoming only, dedup stopwords) ──────────────────
    const wordCount = new Map<string, number>();
    for (const m of convos) {
      if (m.direction !== 'incoming') continue;
      const tokens = (m.message || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
      for (const w of tokens) {
        wordCount.set(w, (wordCount.get(w) || 0) + 1);
      }
    }
    const topKeywords = [...wordCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([word, count]) => ({ word, count }));

    // ── Conversion rate ────────────────────────────────────────────────
    const customerPhones = new Set(convos.map((c) => c.customer_phone));
    const bookedPhones = new Set(bookings.map((b) => b.customer_phone));
    const totalCustomers = customerPhones.size;
    const totalBookings = bookings.length;
    const conversionRate = totalCustomers === 0 ? 0 : Math.min(100, Math.round((bookedPhones.size / totalCustomers) * 100));

    // ── Owner takeover interventions count ─────────────────────────────
    // Replies prefixed with "[owner]" are typed by humans via the
    // takeover send box. Useful for measuring how often AI hands off.
    const ownerInterventions = convos.filter(
      (c) => c.direction === 'outgoing' && c.message.startsWith('[owner]')
    ).length;

    // ── Avg replies per conversation ───────────────────────────────────
    const outgoingTotal = convos.filter((c) => c.direction === 'outgoing').length;
    const avgRepliesPerCustomer = totalCustomers === 0 ? 0 : Math.round((outgoingTotal / totalCustomers) * 10) / 10;

    return NextResponse.json({
      totalCustomers,
      totalBookings,
      conversionRate,
      ownerInterventions,
      avgRepliesPerCustomer,
      volumeByDay,
      busyHoursIST,
      topKeywords,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
