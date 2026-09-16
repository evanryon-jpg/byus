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

// On-demand (VOD) video, for a creator posting a pre-recorded video instead of going
// live. A "direct upload" is a short-lived signed URL the browser PUTs the raw video
// file straight to -- same reasoning as the Vercel Blob client-upload tokens used for
// post images and digital products: it skips this Next.js server entirely, so a
// multi-hundred-MB video never has to fit inside a Vercel Function's request-body/time
// limits. playback_policy: ['signed'] mirrors the live-stream setup above -- nobody
// gets a playable URL without a short-lived token we mint server-side after checking
// they're an active subscriber (see lib/mux-jwt.js and lib/creator-profile-data.js).
export async function createDirectUpload(corsOrigin) {
  return muxFetch('/video/v1/uploads', {
    method: 'POST',
    body: JSON.stringify({
      cors_origin: corsOrigin,
      new_asset_settings: { playback_policy: ['signed'] },
    }),
  });
}

// Polled by the creator's browser after it finishes PUTting the file, and re-checked
// server-side (never trusted from the client) when the post is actually created --
// see app/api/creator/posts/video-upload/[uploadId]/route.js and the POST handler in
// app/api/creator/posts/route.js.
export async function getUpload(uploadId) {
  return muxFetch(`/video/v1/uploads/${uploadId}`);
}

export async function getAsset(assetId) {
  return muxFetch(`/video/v1/assets/${assetId}`);
}

// Best-effort cleanup when a video post is deleted -- an orphaned Mux asset costs
// storage/minutes, not correctness, so callers swallow this rather than let a Mux
// hiccup block the deletion the creator actually asked for (same pattern as the Blob
// cleanup in app/api/creator/posts/[postId]/route.js).
export async function deleteAsset(assetId) {
  return muxFetch(`/video/v1/assets/${assetId}`, { method: 'DELETE' });
}
