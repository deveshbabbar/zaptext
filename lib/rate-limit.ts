import type { NextRequest } from 'next/server';

// Minimal fixed-window in-memory rate limiter.
//
// ⚠️  PRODUCTION CAVEAT ⚠️
// Per-lambda on serverless — NOT globally shared. A determined caller
// hitting from multiple concurrent IPs (or causing a cold-start every
// few requests) can blow past these limits because each new lambda
// instance starts a fresh empty bucket map. This is FINE for cosmetic
// abuse limits (parse-catalog spam, onboard form double-tap, scrape
// rate, dine-in/menu submit) but is NOT SUFFICIENT for endpoints with
// real cost / fraud exposure:
//
//   - /api/payment/verify         (real money — fraud rate-limit)
//   - /api/payment/create-order   (real money — fraud rate-limit)
//   - /api/client/migrate-contacts (resource exhaustion — 25k inserts)
//
// Before going live with paid customers, swap those three call sites
// to a globally-shared limiter (Upstash, Redis, or Vercel KV).
// Drop-in pattern (function signatures here stay the same, so the
// swap is a one-line change per call site once the dep + env are
// wired):
//
//   import { Ratelimit } from '@upstash/ratelimit';
//   import { Redis } from '@upstash/redis';
//   const limiter = new Ratelimit({
//     redis: Redis.fromEnv(),
//     limiter: Ratelimit.fixedWindow(5, '60 s'),
//   });
//   const { success } = await limiter.limit(getClientKey(req, '/api/payment/verify'));
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
