export const dynamic = 'force-dynamic';
// Headroom for the video-upload verification (a Mux round trip) plus NEW_POST_INLINE_BUDGET_MS
// below -- see the comment there for why this route now has an email budget in it at all.
export const maxDuration = 30;

// GET  /api/creator/posts   -> list the logged-in creator's own posts (all of them, own view)
// POST /api/creator/posts   -> create a new post, public or subscribers-only

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { buildPollPayload } from '@/lib/polls';
import { createBroadcastJob, processBroadcastJobChunk } from '@/lib/broadcast-jobs';
import { containsBlockedContent } from '@/lib/content-policy';
import { loadCreatorPosts } from '@/lib/creator-dashboard-data';
import { getUpload, getAsset } from '@/lib/mux';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { sendSms, isSmsConfigured, SMS_BATCH_SIZE } from '@/lib/sms';
import { createSmsBroadcastHold, SMS_HOLD_THRESHOLD } from '@/lib/sms-holds';
import { alertOps } from '@/lib/alerts';

// This request already has to wait on the post INSERT and (for a video post) a Mux
// lookup before it gets anywhere near this -- so unlike the broadcast route's deliberate
// 8s budget, this stays short. Nothing in the UI shows new-post send progress the way
// the dashboard's broadcast section does, so there's nothing gained by waiting longer;
// this is purely a head start for typical-sized subscriber counts before the cron
// worker (app/api/cron/process-broadcasts/route.js) picks up whatever's left.
const NEW_POST_INLINE_BUDGET_MS = 3000;

const TITLE_MAX = 200;
const BODY_MAX = 20000;
const POLL_MIN_OPTIONS = 2;
const POLL_MAX_OPTIONS = 4;
const POLL_OPTION_MAX = 80;

// Trims and validates a creator's raw poll option input. Returns null for "not a
// poll" (no options submitted at all) so callers can tell that apart from a poll with
// too few/invalid options, which throws instead.
function normalizePollOptions(pollOptions) {
  if (!Array.isArray(pollOptions) || pollOptions.length === 0) return null;
  const cleaned = pollOptions.map((o) => (typeof o === 'string' ? o.trim() : '')).filter(Boolean);
  if (cleaned.length < POLL_MIN_OPTIONS) {
    throw new Error(`A poll needs at least ${POLL_MIN_OPTIONS} options.`);
  }
  if (cleaned.length > POLL_MAX_OPTIONS) {
    throw new Error(`A poll can have at most ${POLL_MAX_OPTIONS} options.`);
  }
  if (cleaned.some((o) => o.length > POLL_OPTION_MAX)) {
    throw new Error(`Each poll option must be ${POLL_OPTION_MAX} characters or fewer.`);
  }
  return cleaned;
}

export async function GET() {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can view this.' }, { status: 403 });
  }

  try {
    const posts = await loadCreatorPosts(session.userId);
    return NextResponse.json({ posts });
  } catch (err) {
    console.error('creator/posts GET failed:', err);
    return NextResponse.json(
      { error: 'Could not load your posts. Try again.' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can post.' }, { status: 403 });
  }

  const rateCheck = await checkRateLimit('post-create', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  const { title, body, mediaUrl, visibility, pollOptions, videoUploadId } = await request.json();

  if (!body) {
    return NextResponse.json({ error: 'Post body is required.' }, { status: 400 });
  }
  if (title && title.length > TITLE_MAX) {
    return NextResponse.json(
      { error: `Title must be ${TITLE_MAX} characters or fewer.` },
      { status: 400 }
    );
  }
  if (body.length > BODY_MAX) {
    return NextResponse.json(
      { error: `Post body must be ${BODY_MAX} characters or fewer.` },
      { status: 400 }
    );
  }
  const postPolicyCheck = containsBlockedContent(title, body);
  if (postPolicyCheck.blocked) {
    return NextResponse.json(
      { error: `That post ${postPolicyCheck.message}.` },
      { status: 400 }
    );
  }

  let cleanedPollOptions;
  try {
    cleanedPollOptions = normalizePollOptions(pollOptions);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  // mediaUrl here is actually the private Blob pathname returned by
  // /api/creator/upload — that route always writes pathnames scoped as
  // posts/{userId}/{uuid}.{ext}, so a genuine pathname for THIS creator always
  // starts with their own prefix. Rejecting anything else stops a leaked or
  // guessed pathname belonging to a different creator (or a different post
  // type, like an avatar) from being attached here as if it were this
  // creator's own upload.
  if (mediaUrl && !mediaUrl.startsWith(`posts/${session.userId}/`)) {
    return NextResponse.json({ error: 'Invalid media reference.' }, { status: 400 });
  }
  const finalVisibility = visibility === 'subscribers_only' ? 'subscribers_only' : 'public';

  // videoUploadId is the only video-related thing this endpoint ever trusts from the
  // client -- it's an id we ourselves handed to THIS creator in
  // POST /api/creator/posts/video-upload and recorded in video_uploads. Everything else
  // (the actual asset id, playback id, whether it's really done transcoding) gets
  // re-resolved from Mux directly right here, so a request can't attach an arbitrary
  // Mux asset -- someone else's, or one still processing -- to a post just by sending
  // a made-up assetId/playbackId.
  let muxAssetId = null;
  let muxPlaybackId = null;
  if (videoUploadId) {
    const owned = await query(
      `SELECT 1 FROM video_uploads WHERE upload_id = $1 AND creator_id = $2`,
      [videoUploadId, session.userId]
    );
    if (!owned.rows[0]) {
      return NextResponse.json({ error: 'Invalid video reference.' }, { status: 400 });
    }
    try {
      const upload = await getUpload(videoUploadId);
      if (!upload.asset_id) {
        return NextResponse.json({ error: 'Video upload is not finished yet.' }, { status: 400 });
      }
      const asset = await getAsset(upload.asset_id);
      if (asset.status !== 'ready') {
        return NextResponse.json({ error: 'Video is still processing — try again in a moment.' }, { status: 400 });
      }
      muxAssetId = asset.id;
      muxPlaybackId = asset.playback_ids?.[0]?.id || null;
      if (!muxPlaybackId) {
        return NextResponse.json({ error: 'Video has no playable output yet. Try again.' }, { status: 400 });
      }
    } catch (err) {
      console.error('video resolution failed for post creation:', err);
      return NextResponse.json({ error: 'Could not verify the uploaded video. Try again.' }, { status: 400 });
    }
  }

  try {
    // A creator ByUs hasn't reviewed yet (review_cleared_at is null -- true for every
    // NEW signup; existing creators were backfilled when this shipped, see the
    // migration note in lib/content-policy.js) gets their posts held out of public
    // view instead of blocked outright, so they can still build their page while
    // waiting on the one-time check. /api/admin/users/[id]/clear-review flips this
    // for a creator, publishing anything they made in the meantime.
    const creatorResult = await query('SELECT review_cleared_at FROM users WHERE id = $1', [
      session.userId,
    ]);
    const pendingReview = !creatorResult.rows[0]?.review_cleared_at;

    // mediaUrl here is actually the private Blob pathname returned by
    // /api/creator/upload, stored as-is — it's only ever resolved back into
    // real file bytes through the gated /api/posts/:id/media route.
    const result = await query(
      `INSERT INTO posts (creator_id, title, body, media_url, visibility, poll_options, pending_review, mux_asset_id, mux_playback_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, title, body, media_url, visibility, poll_options, pending_review, created_at, mux_playback_id`,
      [
        session.userId,
        title || null,
        body,
        mediaUrl || null,
        finalVisibility,
        cleanedPollOptions ? JSON.stringify(cleanedPollOptions) : null,
        pendingReview,
        muxAssetId,
        muxPlaybackId,
      ]
    );

    // eslint-disable-next-line no-unused-vars -- mux_playback_id pulled out so it never
    // gets echoed back raw in the response below (see has_video instead).
    const { mux_playback_id: _muxPlaybackId, ...post } = result.rows[0];

    // Best-effort — a notification failure should never mean the post itself didn't get
    // created. Goes out to every active subscriber who hasn't turned this off, regardless
    // of whether the post is public or subscribers-only (they're already paying to stay
    // in the loop either way, same audience the broadcast feature uses). Skipped entirely
    // while the post is pending review -- nobody should be notified about something that
    // isn't actually visible yet.
    if (!pendingReview) {
      try {
        await notifySubscribersOfNewPost(session.userId, post);
      } catch (err) {
        console.error('New-post notification failed (post still created):', err);
      }
    }

    return NextResponse.json({
      post: {
        ...post,
        media_url: post.media_url ? `/api/posts/${post.id}/media` : null,
        // The creator always gets to see/preview their own video immediately, same as
        // they always could with a subscriber-only image -- signing here (rather than
        // routing this through the general viewer-gating logic) keeps this response
        // simple; the public/gated version renders through loadCreatorProfile instead.
        has_video: Boolean(muxPlaybackId),
        poll: buildPollPayload(post, {}),
      },
    });
  } catch (err) {
    console.error('creator/posts POST failed:', err);
    return NextResponse.json(
      { error: 'Could not create this post. Try again.' },
      { status: 500 }
    );
  }
}

async function notifySubscribersOfNewPost(creatorId, post) {
  const [creatorResult, subscribersResult] = await Promise.all([
    query('SELECT display_name, slug FROM users WHERE id = $1', [creatorId]),
    query(
      `SELECT CASE WHEN u.notify_new_posts = true THEN u.email ELSE NULL END AS email,
              CASE WHEN u.notify_new_posts_sms = true THEN u.phone ELSE NULL END AS sms_phone
       FROM subscriptions s
       JOIN users u ON u.id = s.fan_id
       WHERE s.creator_id = $1 AND s.status = 'active'
         AND (s.current_period_end IS NULL OR s.current_period_end > now())
         AND (u.notify_new_posts = true OR (u.notify_new_posts_sms = true AND u.phone_verified_at IS NOT NULL))`,
      [creatorId]
    ),
  ]);

  const creator = creatorResult.rows[0];
  const creatorName = creator?.display_name || 'Your creator';
  const creatorUrl = `${process.env.APP_URL}/creator/${creator?.slug || creatorId}`;

  const recipients = subscribersResult.rows.map((row) => row.email).filter(Boolean);
  if (recipients.length > 0) {
    // Queues every recipient the same way the "message your subscribers" broadcast does
    // (see lib/broadcast-jobs.js) instead of sending to all of them inline here -- this
    // route fires on every single post a creator publishes, automatically, with no
    // creator action to gate it the way a deliberate broadcast send has. Any creator whose
    // active subscriber count got large enough to blow a request timeout would otherwise
    // hit this on every post, not just occasionally.
    const jobId = await createBroadcastJob({
      creatorId,
      creatorName,
      kind: 'new_post',
      metadata: { creatorUrl, postTitle: post.title, postExcerpt: post.body },
      recipients,
    });
    await processBroadcastJobChunk(jobId, { budgetMs: NEW_POST_INLINE_BUDGET_MS });
  }

  await notifySubscribersOfNewPostBySms(subscribersResult.rows, { creatorId, creatorName, creatorUrl, post });
}

// Separate from the email path above on purpose: sent.dm accepts up to SMS_BATCH_SIZE
// (1000) recipients per call for one message, so a send at or under SMS_HOLD_THRESHOLD
// still finishes in a handful of synchronous calls here, well inside
// NEW_POST_INLINE_BUDGET_MS-scale time -- no job/worker machinery needed for that case.
// Above the threshold, this is a real, unbounded dollar amount (sent.dm bills per
// contact per month plus per-text carrier cost) that nothing here used to cap, so it's
// held for a human instead of firing automatically -- see lib/sms-holds.js and
// app/api/admin/sms-holds/route.js. Never throws either way: a texting failure
// (misconfigured provider, sent.dm outage) should never take down post creation or the
// email notifications above, which is why the caller already wraps this whole function
// in its own try/catch.
async function notifySubscribersOfNewPostBySms(subscriberRows, { creatorId, creatorName, creatorUrl, post }) {
  if (!isSmsConfigured()) return;

  const phones = subscriberRows.map((row) => row.sms_phone).filter(Boolean);
  if (phones.length === 0) return;

  if (phones.length > SMS_HOLD_THRESHOLD) {
    const hold = await createSmsBroadcastHold({ creatorId, postId: post.id, recipientCount: phones.length });
    await alertOps(`sms-broadcast-hold:${hold.id}`, {
      message: `${creatorName} just published a post that would text ${phones.length.toLocaleString()} subscribers ` +
        `(over the ${SMS_HOLD_THRESHOLD.toLocaleString()} auto-send limit). Held for review -- approve or reject it ` +
        `from the "Pending SMS sends" section of /admin.`,
    });
    return;
  }

  const title = post.title ? `"${post.title}"` : 'a new post';
  const text = `${creatorName} just posted ${title} on ByUs: ${creatorUrl}`;

  for (let i = 0; i < phones.length; i += SMS_BATCH_SIZE) {
    const batch = phones.slice(i, i + SMS_BATCH_SIZE);
    const result = await sendSms(batch, text);
    if (!result.ok) {
      console.error(`New-post SMS: batch of ${batch.length} failed:`, result.error);
    }
  }
}
