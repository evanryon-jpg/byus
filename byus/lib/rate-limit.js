// Shared rate limiting for endpoints that are expensive, sensitive, or attractive to
// automate against (auth, password reset, subscription checkout). Backed by the
// Upstash Redis instance already provisioned for this project (KV_REST_API_* env vars,
// added via the Vercel Storage tab's "Upstash for Redis" integration).

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// One limiter per endpoint family, sized to that endpoint's abuse risk rather than a
// single global number. Sliding windows so a burst right at a window boundary can't
// double an attacker's effective budget.
const limiters = {
  login: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '60 s'),
    prefix: 'rl:login',
  }),
  signup: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 h'),
    prefix: 'rl:signup',
  }),
  'forgot-password': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 h'),
    prefix: 'rl:forgot-password',
  }),
  'reset-password': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    prefix: 'rl:reset-password',
  }),
  subscribe: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    prefix: 'rl:subscribe',
  }),
};

// Best-effort client IP. Vercel always sets x-forwarded-for in production; the
// fallbacks just keep local dev (where it's absent) from throwing.
export function getClientIp(request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

// Checks `identifier` (e.g. "ip:1.2.3.4" or "email:a@b.com") against the named
// limiter. Fails OPEN on a Redis error — a Redis outage should never be able to take
// down login/signup/checkout — but logs loudly so an outage is still visible.
export async function checkRateLimit(name, identifier) {
  const limiter = limiters[name];
  if (!limiter) throw new Error(`Unknown rate limiter: ${name}`);

  try {
    return await limiter.limit(identifier);
  } catch (err) {
    console.error(`Rate limit check for "${name}" failed (failing open):`, err);
    return { success: true, remaining: 1, reset: 0 };
  }
}

// Standard 429 response for a failed check. `result.reset` is a unix ms timestamp
// from Upstash; surfaced as a Retry-After header so well-behaved clients back off.
export function rateLimitResponse(result) {
  const headers = {};
  if (result?.reset) {
    headers['Retry-After'] = String(Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)));
  }
  return NextResponse.json(
    { error: 'Too many requests. Please wait a bit and try again.' },
    { status: 429, headers }
  );
}
