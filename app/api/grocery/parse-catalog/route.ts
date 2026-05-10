// POST /api/grocery/parse-catalog
//
// Turns owner's free-form daily-catalog textarea ("tamatar 40\npyaaz 35\n
// nimbu 5/piece") into structured ParsedCatalogItem[]. Used by the
// onboarding GroceryForm so owners see a preview of what the bot will
// quote to customers BEFORE saving.
//
// Auth: requires a logged-in user. Cost guard: rate-limited — each call
// hits Groq.
//
// Existing WhatsApp owner-handler at lib/grocery/owner-handler.ts uses the
// same parser via direct import; this route is the HTTP entry-point for
// the dashboard form preview.

import { NextRequest, NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth';
import { parseCatalogText } from '@/lib/grocery/catalog-parser';
import { rateLimit, getClientKey } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Auth — block anonymous calls so we don't burn Groq credits to scrapers
  const user = await getUserRole();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit — Groq calls are not free. Tighter than the public
  // /api/scrape limit since one owner pasting 10 lists in 5 seconds is
  // not a legitimate flow.
  const rateKey = `parse-catalog:${user.userId || getClientKey(request, '/api/grocery/parse-catalog')}`;
  const rate = rateLimit(rateKey, 8, 60_000);
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'Slow down — try again in a minute.', resetInMs: rate.resetInMs },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const text = (body as { text?: unknown })?.text;
  if (typeof text !== 'string' || !text.trim()) {
    return NextResponse.json(
      { error: 'Provide a "text" string with the catalog list.' },
      { status: 400 }
    );
  }

  // Hard cap input size — prevents pathological prompts from running up cost.
  if (text.length > 4000) {
    return NextResponse.json(
      { error: 'Catalog text too long. Keep it under 4,000 characters (about 200 items).' },
      { status: 413 }
    );
  }

  try {
    const items = await parseCatalogText(text);
    return NextResponse.json({ success: true, items, count: items.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'parse failed';
    // Two common failure modes:
    //   1. parseCatalogText: empty input (already guarded above)
    //   2. parseCatalogText: no items extracted (LLM returned empty array)
    // Surface a friendly Hinglish-tone error in either case.
    return NextResponse.json(
      {
        success: false,
        error: 'Could not parse the list. Try one item per line, like "tamatar 40\\npyaaz 35".',
        detail: message,
      },
      { status: 422 }
    );
  }
}
