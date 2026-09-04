// Thin REST wrapper around the Mux Video API. Mux's API is plain REST with HTTP
// Basic Auth (Token ID as username, Token Secret as password) -- a couple of fetch()
// calls cover everything this app needs, so there's no reason to pull in an SDK
// dependency for it.

const MUX_API_BASE = 'https://api.mux.com';

function authHeader() {
  const id = process.env.MUX_TOKEN_ID;
  const secret = process.env.MUX_TOKEN_SECRET;
  if (!id || !secret) {
    throw new Error('MUX_TOKEN_ID / MUX_TOKEN_SECRET are not set.');
  }
  return 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64');
}

async function muxFetch(path, options = {}) {
  const res = await fetch(`${MUX_API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(),
      ...options.headers,
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = body?.error?.messages?.join(' ') || `Mux API error (${res.status})`;
    throw new Error(message);
  }
  return body?.data;
}

// Every Mux "live stream" is reusable, not one-shot: a creator sets this up once and
// the same RTMP URL + stream key work every time they go live from then on. Only the
// idle/active status changes per session, which we track separately via webhooks.
// playback_policy: ['signed'] means nobody can play the stream (live or its VOD
// replay) without a short-lived token we generate server-side after checking they're
// an active subscriber -- see lib/mux-jwt.js.
export async function createLiveStream() {
  return muxFetch('/video/v1/live-streams', {
    method: 'POST',
    body: JSON.stringify({
      playback_policy: ['signed'],
      new_asset_settings: { playback_policy: ['signed'] },
    }),
  });
}

export const MUX_RTMP_URL = 'rtmps://global-live.mux.com:443/app';
