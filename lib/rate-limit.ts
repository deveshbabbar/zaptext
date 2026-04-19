import type { NextRequest } from 'next/server';

// Minimal fixed-window in-memory rate limiter.
// Per-lambda on serverless — NOT globally shared. Adequate to contain
// accidental bursts; swap for @upstash/ratelimit for guaranteed global limits.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetInMs: number;
}

function evictIfLarge() {
  if (buckets.size <= MAX_BUCKETS) return;
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (v.resetAt < now) buckets.delete(k);
  }
  if (buckets.size > MAX_BUCKETS) {
    let i = 0;
    const target = Math.floor(MAX_BUCKETS / 2);
    for (const k of buckets.keys()) {
      if (i++ >= target) break;
      buckets.delete(k);
    }
  }
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    evictIfLarge();
    return { ok: true, remaining: limit - 1, resetInMs: windowMs };
  }
  if (b.count >= limit) {
    return { ok: false, remaining: 0, resetInMs: b.resetAt - now };
  }
  b.count += 1;
  return { ok: true, remaining: limit - b.count, resetInMs: b.resetAt - now };
}

// Best-effort caller identifier from X-Forwarded-For or X-Real-IP headers.
export function getClientKey(req: NextRequest, path: string): string {
  const xff = req.headers.get('x-forwarded-for') || '';
  const firstHop = xff.split(',')[0]?.trim();
  const ip = firstHop || req.headers.get('x-real-ip') || 'unknown';
  return `${ip}:${path}`;
}
