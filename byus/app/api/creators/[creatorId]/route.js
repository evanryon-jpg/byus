export const dynamic = 'force-dynamic';

// GET /api/creators/:creatorId
// Public creator profile: basic info, their tiers, their feed (subscribers-only posts
// hidden unless the requester has an active subscription), and their top supporters
// (opted-in fans only -- see the show_support_publicly query below).

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { signPlaybackToken } from '@/lib/mux-jwt';
import { getPollVoteCounts, getMyPollVotes, buildPollPayload } from '@/lib/polls';

export async function GET(request, { params }) {
  const { creatorId } = params;
  const session = await getCurrentUser(); // may be null if the visitor isn't logged in — that's fine

  try {
    // Links can point at a creator by their raw UUID (old/already-shared links, or any
    // creator who hasn't claimed a vanity URL) or by their slug (new short links). A UUID
    // always matches the id column directly; anything else can only ever be a slug.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(creatorId);
    const creatorResult = await query(
      isUuid
        ? `SELECT id, display_name, bio, profile_image_url, social_links, slug, is_live, mux_playback_id
           FROM users WHERE id = $1 AND role = 'creator'`
        : `SELECT id, display_name, bio, profile_image_url, social_links, slug, is_live, mux_playback_id
           FROM users WHERE slug = $1 AND role = 'creator'`,
      [creatorId]
    );
    const creatorRow = creatorResult.rows[0];
    if (!creatorRow) {
      return NextResponse.json({ error: 'Creator not found.' }, { status: 404 });
    }
    const id = creatorRow.id; // resolved UUID — everything below queries by this, not the raw param
    // profile_image_url in the DB is a private Blob pathname — point the client at our
    // own public proxy route instead of exposing it directly. Built explicitly (not a
    // spread of creatorRow) so mux_playback_id never leaks into the public payload —
    // it only ever goes out inside `live` below, and only to someone who can watch.
    const creator = {
      id: creatorRow.id,
      display_name: creatorRow.display_name,
      bio: creatorRow.bio,
      profile_image_url: creatorRow.profile_image_url ? `/api/avatar/${creatorRow.id}` : null,
      social_links: creatorRow.social_links || [],
      slug: creatorRow.slug,
    };

    const tiersResult = await query(
      `SELECT id, name, description, price_cents FROM subscription_tiers
       WHERE creator_id = $1 AND active = true ORDER BY price_cents ASC`,
      [id]
    );

    // Does the visitor have an active subscription to THIS creator?
    // Cross-check current_period_end against now(), not just the cached status column —
    // status only updates on a webhook, so a missed one (delivery failure, outage) could
    // otherwise leave a lapsed subscription reading as active indefinitely.
    let hasActiveSubscription = false;
    if (session) {
      const subResult = await query(
        `SELECT id FROM subscriptions
         WHERE fan_id = $1 AND creator_id = $2 AND status = 'active'
           AND (current_period_end IS NULL OR current_period_end > now())`,
        [session.userId, id]
      );
      hasActiveSubscription = subResult.rows.length > 0;
    }

    const postsResult = await query(
      `SELECT id, title, body, media_url, visibility, poll_options, created_at
       FROM posts WHERE creator_id = $1 ORDER BY created_at DESC`,
      [id]
    );

    // Top supporters: the longest-tenured active subscribers who've opted in (see
    // show_support_publicly in app/api/me/route.js, off by default). Oldest subscription
    // first, so this reads as "founding members" rather than a spending leaderboard --
    // deliberately not ranked by dollars paid. Same active-subscription check as
    // hasActiveSubscription above. Fans who haven't opted in never appear here, full stop.
    const supportersResult = await query(
      `SELECT u.id, u.display_name, u.profile_image_url, s.created_at AS since
       FROM subscriptions s
       JOIN users u ON u.id = s.fan_id
       WHERE s.creator_id = $1 AND s.status = 'active'
         AND (s.current_period_end IS NULL OR s.current_period_end > now())
         AND u.show_support_publicly = true
       ORDER BY s.created_at ASC
       LIMIT 5`,
      [id]
    );
    const topSupporters = supportersResult.rows.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      profileImageUrl: row.profile_image_url ? `/api/avatar/${row.id}` : null,
      since: row.since,
    }));

    // Poll results/vote-state only ever matter for posts the visitor can actually see —
    // but it's simpler and cheap enough to just compute for every poll post here and let
    // the per-post gate below decide whether to hand it out.
    const pollPostIds = postsResult.rows.filter((p) => p.poll_options).map((p) => p.id);
    const voteCounts = await getPollVoteCounts(pollPostIds);
    const myVotes = await getMyPollVotes(pollPostIds, session?.userId);

    // Gate content here, server-side — never trust the client to hide this on its own.
    // media_url in the DB is a private Blob pathname; unlocked posts get pointed at
    // our own gated route instead of the raw pathname.
    const posts = postsResult.rows.map((post) => {
      const isLocked = post.visibility === 'subscribers_only' && !hasActiveSubscription;
      return {
        id: post.id,
        title: post.title,
        created_at: post.created_at,
        visibility: post.visibility,
        locked: isLocked,
        body: isLocked ? null : post.body,
        media_url: isLocked || !post.media_url ? null : `/api/posts/${post.id}/media`,
        poll: isLocked ? null : buildPollPayload(post, voteCounts[post.id], myVotes[post.id]),
      };
    });

    // Live status is public (fans should see "live now" as a reason to subscribe), but
    // the actual playback credentials are only ever handed to someone who's already
    // confirmed as an active subscriber — same gating rule as subscriber-only posts
    // above, just applied to a signed Mux token instead of a media URL.
    let live = { isLive: Boolean(creatorRow.is_live) };
    if (creatorRow.is_live && creatorRow.mux_playback_id && hasActiveSubscription) {
      try {
        live.playbackId = creatorRow.mux_playback_id;
        live.playbackToken = signPlaybackToken(creatorRow.mux_playback_id);
      } catch (err) {
        // Mux signing keys not configured yet — still true that they're live, just
        // can't hand out a working player until that's set up.
        console.error('failed to sign live playback token:', err);
      }
    }

    return NextResponse.json({
      creator,
      tiers: tiersResult.rows,
      hasActiveSubscription,
      posts,
      live,
      topSupporters,
    });
  } catch (err) {
    console.error('creators/[creatorId] GET failed:', err);
    return NextResponse.json(
      { error: 'Could not load this creator. Try again.' },
      { status: 500 }
    );
  }
}
