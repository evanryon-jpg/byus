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
import { publicAvatarUrl } from '@/lib/avatar-url';
import { isFoundingCreator } from '@/lib/fees';
import { recordPaymentEvidenceBestEffort } from '@/lib/payment-evidence';

export async function GET(request, { params }) {
  const { creatorId } = params;
  const session = await getCurrentUser(); // may be null if the visitor isn't logged in — that's fine

  try {
    // Links can point at a creator by their raw UUID (old/already-shared links, or any
    // creator who hasn't claimed a vanity URL) or by their slug (new short links). A UUID
    // always matches the id column directly; anything else can only ever be a slug.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(creatorId);
    // is_suspended = false is part of the lookup itself, not a separate check after --
    // a suspended creator's page returns the exact same 404 a nonexistent slug would,
    // so there's no way to tell "never existed" apart from "taken down for a policy
    // violation" from the outside. See app/api/admin/users/[id]/route.js for where
    // is_suspended gets set.
    const creatorResult = await query(
      isUuid
        ? `SELECT id, display_name, bio, profile_image_url, social_links, slug, is_live, mux_playback_id,
                  stripe_connect_onboarded, support_goal_cents
           FROM users WHERE id = $1 AND role = 'creator' AND is_suspended = false`
        : `SELECT id, display_name, bio, profile_image_url, social_links, slug, is_live, mux_playback_id,
                  stripe_connect_onboarded, support_goal_cents
           FROM users WHERE slug = $1 AND role = 'creator' AND is_suspended = false`,
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
      profile_image_url: publicAvatarUrl(creatorRow.id, creatorRow.profile_image_url),
      social_links: creatorRow.social_links || [],
      slug: creatorRow.slug,
      // Whether tipping/subscribing is actually possible right now — both need a
      // connected payout destination, and the frontend uses this to hide the tip widget
      // for a creator who hasn't finished Stripe setup rather than showing a dead button.
      stripe_connect_onboarded: Boolean(creatorRow.stripe_connect_onboarded),
      // One of the first FOUNDING_CREATOR_LIMIT creators on ByUs (see lib/fees.js) — same
      // check that grants the permanent 10% fee, reused here so the public "Founding
      // Creator" badge on this page can never drift out of sync with who actually has it.
      is_founding: await isFoundingCreator(query, id),
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
      `SELECT id, title, body, media_url, visibility, poll_options, created_at
       FROM posts WHERE creator_id = $1 AND pending_review = false ORDER BY created_at DESC`,
      [id]
    );

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
      goal,
    });
  } catch (err) {
    console.error('creators/[creatorId] GET failed:', err);
    return NextResponse.json(
      { error: 'Could not load this creator. Try again.' },
      { status: 500 }
    );
  }
}
