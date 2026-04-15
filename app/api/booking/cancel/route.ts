import { NextRequest, NextResponse } from 'next/server';
import { cancelBooking } from '@/lib/booking';

export async function POST(request: NextRequest) {
  try {
    const { bookingId } = await request.json();
    const success = await cancelBooking(bookingId);
    if (!success) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
