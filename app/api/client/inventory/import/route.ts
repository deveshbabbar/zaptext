import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { resolveActiveBot } from '@/lib/active-bot';
import { parseProductFile } from '@/lib/product-import';

// 5 MB max per upload — enough for ~10k CSV rows or a 200-item Excel
// and safe within Vercel's default Node serverless payload.
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const user = await getUserRole();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const bot = await resolveActiveBot(user.userId);
  if (!bot) return NextResponse.json({ error: 'No bot selected' }, { status: 400 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file uploaded (field name "file" required).' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'Uploaded file is empty.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (${Math.round(file.size / 1024 / 1024)}MB). Max ${MAX_BYTES / 1024 / 1024}MB.` },
      { status: 413 }
    );
  }

  try {
    const ab = await file.arrayBuffer();
    const buffer = Buffer.from(ab);
    const result = await parseProductFile(file.name, buffer);
    return NextResponse.json({
      success: true,
      filename: file.name,
      size: file.size,
      botId: bot.client_id,
      ...result,
    });
  } catch (err) {
    console.error('[inventory/import] parse error:', err);
    return NextResponse.json(
      { error: `Parse failed: ${String(err).slice(0, 300)}` },
      { status: 500 }
    );
  }
}
