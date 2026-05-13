import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { getStaff as getTrainers, upsertStaff as upsertTrainer, deleteStaff as deleteTrainer, updateStaffAvailability as updateTrainerAvailability, getStaffById } from '@/lib/staff';
import { StaffAvailability as TrainerAvailability, StaffExtra } from '@/lib/types';

export async function GET() {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ error: 'No bot selected' }, { status: 404 });
  const trainers = await getTrainers(bot.client_id);
  return NextResponse.json({ trainers });
}

export async function POST(req: NextRequest) {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ error: 'No bot selected' }, { status: 400 });

  try {
    const body = await req.json();
    const action = typeof body._action === 'string' ? body._action : 'upsert';

    if (action === 'delete') {
      const id = typeof body.staff_id === 'string' ? body.staff_id : '';
      if (!id) return NextResponse.json({ error: 'staff_id required' }, { status: 400 });
      // Ownership check: Owner A must not be able to delete Owner B's trainer
      // by guessing the staff_id. New /api/client/staff already does this.
      const existing = await getStaffById(id);
      if (!existing) return NextResponse.json({ error: 'Trainer not found' }, { status: 404 });
      if (existing.client_id !== bot.client_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      await deleteTrainer(id);
      return NextResponse.json({ ok: true });
    }

    if (action === 'update-availability') {
      const id = typeof body.staff_id === 'string' ? body.staff_id : '';
      const availability = body.availability as TrainerAvailability;
      if (!id || !availability) {
        return NextResponse.json({ error: 'staff_id + availability required' }, { status: 400 });
      }
      const existing = await getStaffById(id);
      if (!existing) return NextResponse.json({ error: 'Trainer not found' }, { status: 404 });
      if (existing.client_id !== bot.client_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const trainer = await updateTrainerAvailability(id, availability);
      if (!trainer) return NextResponse.json({ error: 'Trainer not found' }, { status: 404 });
      return NextResponse.json({ ok: true, trainer });
    }

    // default: upsert
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    if (typeof body.staff_id === 'string' && body.staff_id) {
      const existing = await getStaffById(body.staff_id);
      if (existing && existing.client_id !== bot.client_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    const trainer = await upsertTrainer({
      client_id: bot.client_id,
      staff_id: typeof body.staff_id === 'string' ? body.staff_id : undefined,
      name,
      specialty: typeof body.specialty === 'string' ? body.specialty : undefined,
      price: typeof body.price === 'number' ? body.price : undefined,
      whatsapp_phone: typeof body.whatsapp_phone === 'string' ? body.whatsapp_phone : undefined,
      bio: typeof body.bio === 'string' ? body.bio : undefined,
      is_active: typeof body.is_active === 'boolean' ? body.is_active : undefined,
      availability: body.availability as TrainerAvailability | undefined,
      extra: body.extra && typeof body.extra === 'object' && !Array.isArray(body.extra)
        ? (body.extra as StaffExtra)
        : undefined,
    });
    return NextResponse.json({ ok: true, trainer });
  } catch (err) {
    console.error('trainers POST error:', err);
    return NextResponse.json({ error: String(err).slice(0, 300) }, { status: 500 });
  }
}
