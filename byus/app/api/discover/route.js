export const dynamic = 'force-dynamic';

// GET /api/discover
// Phase 2 of the native feature parity plan: a public discovery feed, every public
// post across every creator, newest first. This is the actual new product surface
// the plan identified -- the mechanic that turns a stranger who's never heard of
// ByUs (or of any one creator on it) into a fan, the way TikTok's or YouTube's own
// feeds do. See docs discussed 2026-09-18.
//
// Deliberately open to logged-out visitors, not gated behind a session -- same
// reasoning as /api/creators (Browse). No rate limiting here either, for the same
// reason /api/creators has none: it's a public, read-only listing with no per-user
// side effect to abuse, not a login/write endpoint.
//
// Only ever includes posts that are already fully public to anyone by the rules
// the rest of the app already enforces (see app/api/posts/[postId]/media/route.js,
// the like route, and lib/creator-profile-data.js, all of which use this exact
// pair of conditions): visibility = 'public' and pending_review = false. A post's
// pending_review flag is set once, at creation, from whether its creator had
// cleared ByUs's one-time initial review at that moment (see
// app/api/creator/posts/route.js) -- so this never needs its own separate join
// back to users.review_cleared_at; checking pending_review alone is both the
// existing convention and already correct.
//
// Poll posts appear here with their title/body like any other post, but without
// the interactive vote widget -- rendering and gating poll results correctly needs
// per-viewer vote state the way lib/creator-profile-data.js computes it, which is
// more than a first, deliberately simple feed needs. See PHASE 2 in the plan: start
// with plain recency, nothing else.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { publicAvatarUrl } from '@/lib/avatar-url';
import { signPlaybackToken } from '@/lib/mux-jwt';

const PAGE_SIZE = 20;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const requestedOffset = Number.parseInt(searchParams.get('offset') || '0', 10);
  const offset = Number.isFinite(requestedOffset) && requestedOffset > 0 ? requestedOffset : 0;

  // May be null for a logged-out visitor -- the whole point of this route. Used
  // only to compute this viewer's own like/follow state on each card, never to
  // gate whether a post appears at all.
  const session = await getCurrentUser();

  try {
    // LIMIT one extra row to know whether there's a next page, same trick
    // /api/creators already uses, instead of a separate COUNT(*) query.
    const postsResult = await query(
      `SELECT p.id, p.title, p.body, p.media_url, p.created_at, p.mux_playback_id, p.view_count,
              u.id AS creator_id, u.display_name, u.profile_image_url, u.slug
       FROM posts p
       JOIN users u ON u.id = p.creator_id
       WHERE p.visibility = 'public' AND p.pending_review = false
         AND u.role = 'creator' AND u.is_suspended = false
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT $1 OFFSET $2`,
      [PAGE_SIZE + 1, offset]
    );

    const hasMore = postsResult.rows.length > PAGE_SIZE;
    const rows = postsResult.rows.slice(0, PAGE_SIZE);

    const postIds = rows.map((p) => p.id);
    const creatorIds = [...new Set(rows.map((p) => p.creator_id))];

    // Like counts, this viewer's own likes, and this viewer's own follows -- same
    // "compute for everything visible, then let each card read its own slice"
    // shape lib/creator-profile-data.js already uses for a single creator's page.
    const [likeCountsResult, myLikesResult, myFollowsResult] = await Promise.all([
      postIds.length
        ? query(`SELECT post_id, COUNT(*)::int AS count FROM post_likes WHERE post_id = ANY($1) GROUP BY post_id`, [
            postIds,
          ])
        : { rows: [] },
      session?.userId && postIds.length
        ? query(`SELECT post_id FROM post_likes WHERE fan_id = $1 AND post_id = ANY($2)`, [session.userId, postIds])
        : { rows: [] },
      session?.userId && creatorIds.length
        ? query(`SELECT creator_id FROM creator_follows WHERE fan_id = $1 AND creator_id = ANY($2)`, [
            session.userId,
            creatorIds,
          ])
        : { rows: [] },
    ]);
    const likeCounts = Object.fromEntries(likeCountsResult.rows.map((r) => [r.post_id, r.count]));
    const myLikedPostIds = new Set(myLikesResult.rows.map((r) => r.post_id));
    const myFollowedCreatorIds = new Set(myFollowsResult.rows.map((r) => r.creator_id));

    const posts = rows.map((p) => {
      let video = null;
      if (p.mux_playback_id) {
        try {
          video = { playbackId: p.mux_playback_id, playbackToken: signPlaybackToken(p.mux_playback_id) };
        } catch (err) {
          // Mux signing keys not configured -- post still appears, just without a player.
          console.error('discover feed: failed to sign video playback token:', err);
        }
      }
      return {
        id: p.id,
        title: p.title,
        body: p.body,
        createdAt: p.created_at,
        // Public post -- media is already open to anyone (see the media route's own
        // gating), so this always points at the real proxy path, no lock check needed.
        mediaUrl: p.media_url ? `/api/posts/${p.id}/media` : null,
        video,
        viewCount: p.view_count,
        likeCount: likeCounts[p.id] || 0,
        likedByMe: myLikedPostIds.has(p.id),
        creator: {
          id: p.creator_id,
          displayName: p.display_name,
          slug: p.slug,
          profileImageUrl: publicAvatarUrl(p.creator_id, p.profile_image_url),
          followedByMe: myFollowedCreatorIds.has(p.creator_id),
        },
      };
    });

    return NextResponse.json({
      posts,
      hasMore,
      nextOffset: hasMore ? offset + PAGE_SIZE : null,
    });
  } catch (err) {
    console.error('discover GET failed:', err);
    return NextResponse.json({ error: 'Could not load the feed. Try again.' }, { status: 500 });
  }
}
