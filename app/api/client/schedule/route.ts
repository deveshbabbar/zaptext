import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { getWeeklySchedule, setWeeklySchedule, calculateEndTime, WeeklySlot } from '@/lib/booking';

export async function GET() {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ schedule: {}, slotDuration: 30 });

  try {
    const slots = await getWeeklySchedule(bot.client_id);
    const schedule: Record<string, { enabled: boolean; blocks: Array<{ start: string; end: string }> }> = {};
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    for (const day of days) {
      const daySlots = slots.filter((s) => s.day_of_week === day);
      if (daySlots.length === 0) {
        schedule[day] = { enabled: false, blocks: [] };
      } else {
        const blocks: Array<{ start: string; end: string }> = [];
        let currentBlock = { start: daySlots[0].start_time, end: daySlots[0].end_time };
        for (let i = 1; i < daySlots.length; i++) {
          if (daySlots[i].start_time === currentBlock.end) {
            currentBlock.end = daySlots[i].end_time;
          } else {
            blocks.push(currentBlock);
            currentBlock = { start: daySlots[i].start_time, end: daySlots[i].end_time };
          }
        }
        blocks.push(currentBlock);
        schedule[day] = { enabled: true, blocks };
      }
    }

    const slotDuration = slots.length > 0 ? slots[0].slot_duration_minutes : 30;
    return NextResponse.json({ schedule, slotDuration });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ error: 'No bot selected' }, { status: 400 });

  try {
    const { schedule, slotDuration } = await request.json();
    const slots: WeeklySlot[] = [];

    for (const [day, daySchedule] of Object.entries(schedule as Record<string, { enabled: boolean; blocks: Array<{ start: string; end: string }> }>)) {
      if (!daySchedule.enabled) continue;
      for (const block of daySchedule.blocks) {
        let currentTime = block.start;
        while (currentTime < block.end) {
          const endTime = calculateEndTime(currentTime, slotDuration);
          if (endTime > block.end) break;
          slots.push({
            client_id: bot.client_id,
            day_of_week: day,
            start_time: currentTime,
            end_time: endTime,
            slot_duration_minutes: slotDuration,
            is_active: true,
            service_type: 'general',
          });
          currentTime = endTime;
        }
      }
    }

    await setWeeklySchedule(bot.client_id, slots);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
