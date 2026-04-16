import { NextResponse } from 'next/server';
import { getAllClients } from '@/lib/google-sheets';
import { getUserRole } from '@/lib/auth';

export async function GET() {
  const user = await getUserRole();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
