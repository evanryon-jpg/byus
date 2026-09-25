// Shared "load this creator's public profile" logic. Originally lived only inside
// app/api/creators/[creatorId]/route.js — pulled out here so the creator profile
// page's server-side initial load (app/creator/[creatorId]/page.js) can produce the
// exact same shape without a second, silently-drifting copy of the gating rules
// (subscriber-only posts, live playback tokens, top-supporters opt-in). The API route
// itself still exists and still uses this loader — app/support/page.js and
// app/creator/[creatorId]/tip/page.js both call it directly by fetch for their own
// client-side needs.

import { query } from '@/lib/db';
import { signPlaybackToken } from '@/lib/mux-jwt';
import { getPollVoteCounts, getMyPollVotes, buildPollPayload } from '@/lib/polls';
import { publicAvatarUrl, publicCoverUrl } from '@/lib/avatar-url';
import { getFoundingCreatorRank } from '@/lib/fees';
import { FOUNDING_CREATOR_LIMIT } from '@/lib/pricing';
import { recordPaymentEvidenceBestEffort } from '@/lib/payment-evidence';

// Returns null if no such (non-suspended) creator exists — callers render their own
// 404 in that case, same as the API route's `{ error: 'Creator not found.' }` did.
// `session` may be null (a logged-out visitor); everything session-gated below
// already handles that the same way the API route always has.
export async function loadCreatorProfile(creatorId, session) {
  // Links can point at a creator by their raw UUID (old/already-shared links, or any
  // creator who hasn't claimed a vanity URL) or by their slug (new short links). A UUID
  // always matches the id column directly; anything else can only ever be a slug.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(creatorId);
  // is_suspended = false is part of the lookup itself, not a separate check after --
  // a suspended creator's page returns the exact same "not found" a nonexistent slug
  // would, so there's no way to tell "never existed" apart from "taken down for a
  // policy violation" from the outside. See app/api/admin/users/[id]/route.js for
  // where is_suspended gets set.
  const creatorResult = await query(
    isUuid
      ? `SELECT id, display_name, bio, profile_image_url, social_links, slug, is_live, mux_playback_id,
                stripe_connect_onboarded, support_goal_cents, cover_image_url, pinned_post_id
         FROM users WHERE id = $1 AND role = 'creator' AND is_suspended = false`
      : `SELECT id, display_name, bio, profile_image_url, social_links, slug, is_live, mux_playback_id,
                stripe_connect_onboarded, support_goal_cents, cover_image_url, pinned_post_id
         FROM users WHERE slug = $1 AND role = 'creator' AND is_suspended = false`,
    [creatorId]
  );
  let creatorRow = creatorResult.rows[0];

  // No one currently holds this slug live -- if it used to belong to a creator who's
  // since changed their vanity URL, resolve through to whoever that is now (see
  // creator_slug_history, written by app/api/creator/slug/route.js on every slug
  // change) instead of dead-ending on a link the creator already shared. The query
  // above already wins whenever a slug is live, so this only ever fires for a
  // genuinely abandoned old one -- a currently-claimed slug can never be shadowed by a
  // stale redirect. Returning this row with its *current* slug is enough: the caller
  // in app/creator/[creatorId]/page.js already redirects whenever the resolved slug
  // differs from the requested creatorId.
  if (!creatorRow && !isUuid) {
    const historyResult = await query(
      `SELECT u.id, u.display_name, u.bio, u.profile_image_url, u.social_links, u.slug, u.is_live,
              u.mux_playback_id, u.stripe_connect_onboarded, u.support_goal_cents,
              u.cover_image_url, u.pinned_post_id
       FROM creator_slug_history h
       JOIN users u ON u.id = h.user_id
       WHERE h.old_slug = $1 AND u.role = 'creator' AND u.is_suspended = false`,
      [creatorId]
    );
    creatorRow = historyResult.rows[0];
  }

  if (!creatorRow) return null;

  const id = creatorRow.id; // resolved UUID — everything below queries by this, not the raw param
  // Same live-computed rank lib/user-profile.js uses for the dashboard's own "you're
  // founding creator #N" view (getFoundingCreatorRank, lib/fees.js) — reused here so the
  // public badge's number can never drift from what actually grants the permanent 10%
  // fee. One query gets both is_founding and the rank shown on the badge, rather than
  // the two separate lookups isFoundingCreator()+a second rank query would need.
  const foundingRank = await getFoundingCreatorRank(query, id);
  const isFounding = foundingRank !== null && foundingRank <= FOUNDING_CREATOR_LIMIT;

  // profile_image_url in the DB is a private Blob pathname — point the client at our
  // own public proxy route instead of exposing it directly. Built explicitly (not a
  // spread of creatorRow) so mux_playback_id never leaks into the public payload —
  // it only ever goes out inside `live` below, and only to someone who can watch.
  const creator = {
    id: creatorRow.id,
    display_name: creatorRow.display_name,
    bio: creatorRow.bio,
    profile_image_url: publicAvatarUrl(creatorRow.id, creatorRow.profile_image_url),
    // Optional banner across the top of the page (app/api/me/cover/route.js).
    cover_image_url: publicCoverUrl(creatorRow.id, creatorRow.cover_image_url),
    social_links: creatorRow.social_links || [],
    slug: creatorRow.slug,
    // Whether tipping/subscribing is actually possible right now — both need a
    // connected payout destination, and the frontend uses this to hide the tip widget
    // for a creator who hasn't finished Stripe setup rather than showing a dead button.
    stripe_connect_onboarded: Boolean(creatorRow.stripe_connect_onboarded),
    // One of the first FOUNDING_CREATOR_LIMIT creators on ByUs (see lib/fees.js) — same
    // check that grants the permanent 10% fee, reused here so the public "Founding
    // Creator" badge on this page can never drift out of sync with who actually has it.
    is_founding: isFounding,
    founding_creator_rank: isFounding ? foundingRank : null,
    founding_creator_limit: FOUNDING_CREATOR_LIMIT,
  };

  // A creator's optional monthly support goal (set in their dashboard) shown as a
  // progress bar on this page. Resets every calendar month, same window as the fee-tier
  // threshold in lib/fees.js — progress is this month's earnings across BOTH
  // subscriptions and tips (both write to creator_earnings), not a lifetime total.
  let goal = null;
  if (creatorRow.support_goal_cents) {
    const goalResult = await query(
      `SELECT COALESCE(SUM(amount_cents), 0)::bigint AS total
       FROM creator_earnings WHERE creator_id = $1 AND created_at >= date_trunc('month', now())`,
      [id]
    );
    goal = {
      goalCents: creatorRow.support_goal_cents,
      progressCents: Number(goalResult.rows[0].total),
    };
  }

  const tiersResult = await query(
    `SELECT id, name, description, price_cents, annual_price_cents, welcome_message, trial_days
     FROM subscription_tiers
     WHERE creator_id = $1 AND active = true ORDER BY price_cents ASC`,
    [id]
  );

  // Does the visitor have an active subscription to THIS creator?
  // Cross-check current_period_end against now(), not just the cached status column —
  // status only updates on a webhook, so a missed one (delivery failure, outage) could
  // otherwise leave a lapsed subscription reading as active indefinitely.
  let hasActiveSubscription = false;
  let activeSubscriptionId = null;
  if (session) {
    const subResult = await query(
      `SELECT id FROM subscriptions
       WHERE fan_id = $1 AND creator_id = $2 AND status = 'active'
         AND (current_period_end IS NULL OR current_period_end > now())
       ORDER BY created_at DESC
       LIMIT 1`,
      [session.userId, id]
    );
    activeSubscriptionId = subResult.rows[0]?.id || null;
    hasActiveSubscription = Boolean(activeSubscriptionId);
  }

  // pending_review = true means this creator hasn't cleared ByUs's one-time initial
  // review yet (see /api/creator/posts and /api/admin/users/[id]/clear-review) --
  // hidden from every visitor here regardless of visibility, including the creator's
  // own logged-out view of their public page.
  const postsResult = await query(
    `SELECT id, title, body, media_url, visibility, poll_options, created_at, mux_playback_id
     FROM posts WHERE creator_id = $1 AND pending_review = false ORDER BY created_at DESC`,
    [id]
  );

  // View counter: increment on load, per the plan's own scoping -- shown to the
  // creator on their own dashboard first (see loadCreatorPosts in
  // lib/creator-dashboard-data.js), not surfaced to fans yet. Fire-and-forget so a
  // slow or failed write never holds up the profile page itself; a missed increment
  // just undercounts by one, which matters far less than blocking the page.
  if (postsResult.rows.length > 0) {
    const viewedPostIds = postsResult.rows.map((p) => p.id);
    query(`UPDATE posts SET view_count = view_count + 1 WHERE id = ANY($1)`, [viewedPostIds]).catch(
      (err) => {
        console.error('failed to record post view counts:', err);
      }
    );
  }

  // If an authenticated fan's active subscription caused subscriber-only content to be
  // delivered, record that fact as best-effort dispute evidence. We intentionally log one
  // compact page-access event instead of a row per post, and we do not store post bodies,
  // titles, search terms, or other browsing detail.
  const unlockedSubscriberOnlyPostCount = hasActiveSubscription
    ? postsResult.rows.filter((post) => post.visibility === 'subscribers_only').length
    : 0;
  if (session?.role === 'fan' && activeSubscriptionId && unlockedSubscriberOnlyPostCount > 0) {
    await recordPaymentEvidenceBestEffort({
      fanId: session.userId,
      creatorId: id,
      subscriptionId: activeSubscriptionId,
      eventType: 'subscriber_content_access',
      metadata: {
        surface: 'creator_profile',
        unlockedSubscriberOnlyPostCount,
      },
    });
  }

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
    profileImageUrl: publicAvatarUrl(row.id, row.profile_image_url),
    since: row.since,
  }));

  // Poll results/vote-state only ever matter for posts the visitor can actually see —
  // but it's simpler and cheap enough to just compute for every poll post here and let
  // the per-post gate below decide whether to hand it out.
  const pollPostIds = postsResult.rows.filter((p) => p.poll_options).map((p) => p.id);
  const voteCounts = await getPollVoteCounts(pollPostIds);
  const myVotes = await getMyPollVotes(pollPostIds, session?.userId);

  // Like counts/state, computed for every visible post the same way poll results are
  // above -- cheap enough to just compute up front and let the per-post gate below
  // decide what to hand out.
  const allPostIds = postsResult.rows.map((p) => p.id);
  const likeCounts = {};
  if (allPostIds.length > 0) {
    const likeCountsResult = await query(
      `SELECT post_id, COUNT(*)::int AS count FROM post_likes WHERE post_id = ANY($1) GROUP BY post_id`,
      [allPostIds]
    );
    for (const row of likeCountsResult.rows) likeCounts[row.post_id] = row.count;
  }
  let myLikedPostIds = new Set();
  if (session?.userId && allPostIds.length > 0) {
    const myLikesResult = await query(
      `SELECT post_id FROM post_likes WHERE fan_id = $1 AND post_id = ANY($2)`,
      [session.userId, allPostIds]
    );
    myLikedPostIds = new Set(myLikesResult.rows.map((row) => row.post_id));
  }

  // Gate content here, server-side — never trust the client to hide this on its own.
  // media_url in the DB is a private Blob pathname; unlocked posts get pointed at
  // our own gated route instead of the raw pathname.
  const posts = postsResult.rows.map((post) => {
    const isLocked = post.visibility === 'subscribers_only' && !hasActiveSubscription;
    // Same gating rule as the live stream above, just per-post: the playback id alone
    // is useless without a signed token, and that token is only ever minted for a
    // viewer this function has already confirmed can see this post.
    let video = null;
    if (!isLocked && post.mux_playback_id) {
      try {
        video = { playbackId: post.mux_playback_id, playbackToken: signPlaybackToken(post.mux_playback_id) };
      } catch (err) {
        // Mux signing keys not configured yet — post still exists, just can't hand out
        // a working player until that's set up.
        console.error('failed to sign video playback token:', err);
      }
    }
    return {
      id: post.id,
      title: post.title,
      created_at: post.created_at,
      visibility: post.visibility,
      locked: isLocked,
      body: isLocked ? null : post.body,
      media_url: isLocked || !post.media_url ? null : `/api/posts/${post.id}/media`,
      hasVideo: Boolean(post.mux_playback_id),
      video,
      poll: isLocked ? null : buildPollPayload(post, voteCounts[post.id], myVotes[post.id]),
      likeCount: likeCounts[post.id] || 0,
      likedByMe: myLikedPostIds.has(post.id),
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

  // Free follows are separate from paid subscriptions: visitors can keep their current
  // platform and still build a lightweight audience connection on ByUs.
  const followerResult = await query(
    'SELECT COUNT(*)::int AS count FROM creator_follows WHERE creator_id = $1',
    [id]
  );
  let isFollowing = false;
  if (session && session.userId !== id) {
    const followingResult = await query(
      'SELECT 1 FROM creator_follows WHERE fan_id = $1 AND creator_id = $2',
      [session.userId, id]
    );
    isFollowing = Boolean(followingResult.rows[0]);
  }

  // The creator's pinned "Start here" post (app/api/creator/pinned-post/route.js).
  // Only honored while it's visible and unlocked for this viewer -- if the creator later
  // made it subscribers-only it just drops back into the feed like any other post.
  const pinnedPost = creatorRow.pinned_post_id
    ? posts.find((p) => p.id === creatorRow.pinned_post_id && !p.locked) || null
    : null;

  return {
    creator,
    pinnedPostId: pinnedPost ? pinnedPost.id : null,
    tiers: tiersResult.rows,
    hasActiveSubscription,
    followerCount: followerResult.rows[0].count,
    isFollowing,
    canFollow: Boolean(session && session.userId !== id),
    isOwnPage: Boolean(session && session.userId === id),
    posts,
    live,
    topSupporters,
    goal,
  };
}
