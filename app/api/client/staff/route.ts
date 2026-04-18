import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { getStaff, upsertStaff, deleteStaff, updateStaffAvailability, getStaffById } from '@/lib/staff';
import { StaffAvailability } from '@/lib/types';

export async function GET() {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ error: 'No bot selected' }, { status: 404 });
  const staff = await getStaff(bot.client_id);
  return NextResponse.json({ staff, botType: bot.type });
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
      const existing = await getStaffById(id);
      if (!existing) return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
      if (existing.client_id !== bot.client_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      await deleteStaff(id);
      return NextResponse.json({ ok: true });
    }

    if (action === 'update-availability') {
      const id = typeof body.staff_id === 'string' ? body.staff_id : '';
      const availability = body.availability as StaffAvailability;
      if (!id || !availability) {
        return NextResponse.json({ error: 'staff_id + availability required' }, { status: 400 });
      }
      const existing = await getStaffById(id);
      if (!existing) return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
      if (existing.client_id !== bot.client_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const member = await updateStaffAvailability(id, availability);
      if (!member) return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
      return NextResponse.json({ ok: true, member });
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    if (typeof body.staff_id === 'string' && body.staff_id) {
      const existing = await getStaffById(body.staff_id);
      if (existing && existing.client_id !== bot.client_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    const member = await upsertStaff({
      client_id: bot.client_id,
      staff_id: typeof body.staff_id === 'string' ? body.staff_id : undefined,
      name,
      specialty: typeof body.specialty === 'string' ? body.specialty : undefined,
      price: typeof body.price === 'number' ? body.price : undefined,
      whatsapp_phone: typeof body.whatsapp_phone === 'string' ? body.whatsapp_phone : undefined,
      bio: typeof body.bio === 'string' ? body.bio : undefined,
      is_active: typeof body.is_active === 'boolean' ? body.is_active : undefined,
      availability: body.availability as StaffAvailability | undefined,
    });
    return NextResponse.json({ ok: true, member });
  } catch (err) {
    console.error('staff POST error:', err);
    return NextResponse.json({ error: String(err).slice(0, 300) }, { status: 500 });
  }
}
