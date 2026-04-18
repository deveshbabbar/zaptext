import { NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { initializeAllSheets } from '@/lib/init-sheets';

export async function POST() {
  const user = await getUserRole();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const report = await initializeAllSheets();
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    console.error('init-sheets failed:', err);
    return NextResponse.json(
      { ok: false, error: String(err).slice(0, 500) },
      { status: 500 }
    );
  }
}
