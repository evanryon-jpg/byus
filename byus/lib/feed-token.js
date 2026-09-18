// Support for private per-subscriber podcast/RSS feeds (see
// database/migrations/20260918_fan_feed_tokens.sql and app/api/feed/[token]/route.js).
// Split out from the route files so both the feed route and its sibling media-proxy
// route share the exact same token lookup instead of two copies drifting apart.

import crypto from 'crypto';
import { query } from '@/lib/db';

// Same crypto.randomBytes convention this app already uses for other opaque lookup
// tokens (see lib/... callers of telegram_link_tokens) -- 24 random bytes is plenty
// to make guessing infeasible, base64url keeps it safe to drop straight into a URL
// path segment with no further encoding.
export function generateFeedToken() {
  return crypto.randomBytes(24).toString('base64url');
}

// Looks up a feed token and, if it resolves, re-checks the underlying subscription
// live (not just that the token row exists) -- a fan who cancels after grabbing a
// feed link should stop receiving subscriber-only posts through it, the same way
// their access on the website itself lapses. Returns null for an unknown token, or
// { fanId, creatorId, hasActiveSubscription, creator } for a known one.
export async function resolveFeedToken(token) {
  if (!token || typeof token !== 'string') return null;

  const tokenResult = await query(
    `SELECT fan_id, creator_id FROM fan_feed_tokens WHERE token = $1`,
    [token]
  );
  const row = tokenResult.rows[0];
  if (!row) return null;

  const creatorResult = await query(
    `SELECT id, display_name, bio, slug, profile_image_url
     FROM users WHERE id = $1 AND role = 'creator' AND is_suspended = false`,
    [row.creator_id]
  );
  const creator = creatorResult.rows[0];
  if (!creator) return null; // creator deleted/suspended since the link was issued

  // Same active-subscription check used everywhere else in this app (gated media,
  // the profile page) -- cross-checks current_period_end against now() rather than
  // trusting the cached status column alone, so access self-corrects at the
  // paid-through date even if a cancellation webhook is ever missed.
  const subResult = await query(
    `SELECT id FROM subscriptions
     WHERE fan_id = $1 AND creator_id = $2 AND status = 'active'
       AND (current_period_end IS NULL OR current_period_end > now())
     ORDER BY created_at DESC
     LIMIT 1`,
    [row.fan_id, row.creator_id]
  );

  return {
    fanId: row.fan_id,
    creatorId: row.creator_id,
    hasActiveSubscription: subResult.rows.length > 0,
    creator,
  };
}

// Minimal XML text-escaping for anything interpolated outside a CDATA block (titles,
// the channel description, attribute values) -- RSS readers are far less forgiving of
// a bare & or < than a browser's HTML parser is.
export function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
