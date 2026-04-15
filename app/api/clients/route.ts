import { NextResponse } from 'next/server';
import { getAllClients } from '@/lib/google-sheets';

export async function GET() {
  try {
    const clients = await getAllClients();
    return NextResponse.json({ clients });
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clients', details: String(error) },
      { status: 500 }
    );
  }
}
