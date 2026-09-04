export const dynamic = 'force-dynamic';

// Mux calls this whenever a creator's live stream changes state (goes active,
// goes idle, disconnects). We only care about flipping users.is_live so the public
// creator page and dashboard know whether to show "live now" — everything else
// about the stream (title, replay, etc.) stays entirely on Mux's side for now.

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { query } from '@/lib/db';

// Mux signs each webhook with a "Mux-Signature: t=<timestamp>,v1=<hex hmac>" header,
// computed over "<timestamp>.<raw body>" using the webhook secret from the Mux
// dashboard. Verifying it (rather than trusting any POST to this URL) is what stops
// anyone else from flipping a creator's is_live flag by guessing this endpoint.
function isValidSignature(rawBody, header, secret) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=')));
  if (!parts.t || !parts.v1) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex');
  const expectedBuf = Buffer.from(expected);
  const gotBuf = Buffer.from(parts.v1);
  return expectedBuf.length === gotBuf.length && crypto.timingSafeEqual(expectedBuf, gotBuf);
}

export async function POST(request) {
  const secret = process.env.MUX_WEBHOOK_SECRET;
  const rawBody = await request.text();

  if (secret) {
    if (!isValidSignature(rawBody, request.headers.get('mux-signature'), secret)) {
      return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
    }
  } else {
    // Not configured yet — log loudly rather than silently trusting unverified
    // webhooks, but still accept them so setup order (env var vs. Mux dashboard
    // webhook creation) doesn't matter.
    console.warn('MUX_WEBHOOK_SECRET is not set — accepting Mux webhook without verifying it.');
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Bad payload.' }, { status: 400 });
  }

  const liveStreamId = event.data?.id;

  try {
    if (event.type === 'video.live_stream.active' && liveStreamId) {
      await query('UPDATE users SET is_live = true WHERE mux_live_stream_id = $1', [liveStreamId]);
    } else if (
      (event.type === 'video.live_stream.idle' || event.type === 'video.live_stream.disconnected') &&
      liveStreamId
    ) {
      await query('UPDATE users SET is_live = false WHERE mux_live_stream_id = $1', [liveStreamId]);
    }
  } catch (err) {
    console.error('mux webhook handling failed:', err);
    // Still respond 200 below — Mux retries on non-2xx, and retrying a transient DB
    // error won't resolve any faster than the next real status-change event will.
  }

  return NextResponse.json({ received: true });
}
