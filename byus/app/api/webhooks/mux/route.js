export const dynamic = 'force-dynamic';
// A clean scan that publishes a video now also emails/texts the creator's subscribers
// (lib/post-notifications.js), which gets a short inline budget of its own.
export const maxDuration = 30;

// Mux calls this for live-stream state changes and completed Robots moderation jobs.
// Live events update users.is_live; moderation results decide whether a hidden video
// can publish automatically or must stay in the human review queue.

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { query } from '@/lib/db';
import { createModerationJob } from '@/lib/mux';
import { alertReviewQueue } from '@/lib/alerts';
import { notifySubscribersOfNewPost } from '@/lib/post-notifications';

const BORDERLINE_MARGIN = 0.2;

async function handleModerationCompleted(job) {
  const assetId = job.parameters?.asset_id;
  const outputs = job.outputs;
  if (!assetId) return;
  if (!outputs?.max_scores) {
    // A "completed" job with no scores can't be judged either way. Leaving the post in
    // 'scanning' hid it indefinitely with nothing telling anyone; mark it for a human.
    await markScanFailed(assetId);
    return;
  }

  const sexual = Number(outputs.max_scores.sexual || 0);
  const violence = Number(outputs.max_scores.violence || 0);
  const sexualThreshold = Number(job.parameters?.thresholds?.sexual ?? 0.6);
  const violenceThreshold = Number(job.parameters?.thresholds?.violence ?? 0.7);
  const isFirstPass = Number(job.parameters?.max_samples) === 20 && !job.parameters?.sampling_interval;
  const borderline =
    sexual >= sexualThreshold - BORDERLINE_MARGIN ||
    violence >= violenceThreshold - BORDERLINE_MARGIN;
  const scoreRecord = JSON.stringify({
    sexual,
    violence,
    exceedsThreshold: Boolean(outputs.exceeds_threshold),
    pass: isFirstPass ? 'initial' : 'dense',
    thumbnailScores: outputs.thumbnail_scores || [],
  });

  if (outputs.exceeds_threshold) {
    const flagged = await query(
      `UPDATE posts
       SET video_moderation_status = 'flagged', video_moderation_scores = $2::jsonb,
           video_moderated_at = now(), pending_review = true
       WHERE mux_asset_id = $1
         AND video_moderation_status IN ('queued', 'scanning', 'rescan_starting', 'rescanning')
       RETURNING id`,
      [assetId, scoreRecord]
    );
    if (flagged.rows[0]) {
      await alertReviewQueue('flagged-content');
    }
    return;
  }

  if (isFirstPass && borderline) {
    const claim = await query(
      `UPDATE posts
       SET video_moderation_status = 'rescan_starting', video_moderation_scores = $2::jsonb
       WHERE mux_asset_id = $1 AND video_moderation_status IN ('queued', 'scanning')
       RETURNING id`,
      [assetId, scoreRecord]
    );
    if (!claim.rows[0]) return;

    try {
      const secondPass = await createModerationJob(assetId, { dense: true });
      await query(
        `UPDATE posts
         SET video_moderation_status = 'rescanning', video_moderation_job_id = $2
         WHERE mux_asset_id = $1 AND video_moderation_status = 'rescan_starting'`,
        [assetId, secondPass.id]
      );
    } catch (err) {
      console.error('Mux dense moderation pass failed to start:', err);
      await query(
        `UPDATE posts
         SET video_moderation_status = 'scan_failed', video_moderation_scores = $2::jsonb
         WHERE mux_asset_id = $1 AND video_moderation_status = 'rescan_starting'`,
        [assetId, scoreRecord]
      );
    }
    return;
  }

  // A clean scan may publish only after the creator's separate account review has
  // cleared. Otherwise it remains hidden and the account-review action releases it.
  const updated = await query(
    `UPDATE posts p
     SET video_moderation_status = CASE
           WHEN u.review_cleared_at IS NOT NULL THEN 'approved'
           ELSE 'approved_creator_pending'
         END,
         video_moderation_scores = $2::jsonb,
         video_moderated_at = now(),
         pending_review = (u.review_cleared_at IS NULL)
     FROM users u
     WHERE p.creator_id = u.id AND p.mux_asset_id = $1
       AND p.video_moderation_status IN ('queued', 'scanning', 'rescan_starting', 'rescanning')
     RETURNING p.id, p.creator_id, p.title, p.body, p.pending_review`,
    [assetId, scoreRecord]
  );
  // pending_review only comes back true here when the creator hasn't been cleared yet
  // -- i.e. this clean scan is still stuck behind a one-time manual account review, not
  // because the video itself needs a second look.
  for (const post of updated.rows) {
    if (post.pending_review) {
      await alertReviewQueue('first-video-review');
      continue;
    }
    // The video just went public on this exact write (the status guard above only matches
    // once), so this is the one and only time subscribers hear about it. Best-effort: a
    // notification hiccup must not fail the moderation result Mux is delivering.
    try {
      await notifySubscribersOfNewPost(post.creator_id, post);
    } catch (err) {
      console.error(`New-post notification failed for auto-approved video post ${post.id}:`, err);
    }
  }
}

async function markScanFailed(assetId) {
  const failed = await query(
    `UPDATE posts SET video_moderation_status = 'scan_failed', pending_review = true
     WHERE mux_asset_id = $1
       AND video_moderation_status IN ('queued', 'scanning', 'rescan_starting', 'rescanning')
     RETURNING id`,
    [assetId]
  );
  if (failed.rows[0]) {
    await alertReviewQueue('flagged-content');
  }
}

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
    } else if (event.type === 'robots.job.moderate.completed') {
      await handleModerationCompleted(event.data || {});
    } else if (event.type?.startsWith('robots.job.moderate.') && /error|fail/.test(event.type)) {
      // The scan itself failed on Mux's side. Without this the post sat in 'scanning' --
      // hidden, with no alert -- until someone happened to look at the admin queue.
      const assetId = event.data?.parameters?.asset_id;
      if (assetId) await markScanFailed(assetId);
    }
  } catch (err) {
    console.error('mux webhook handling failed:', err);
    // A moderation result is a one-time decision event, so return an error and let Mux
    // retry rather than acknowledging a result we failed to persist. Live status events
    // are transient and can keep their older best-effort behavior.
    if (event.type === 'robots.job.moderate.completed') {
      return NextResponse.json({ error: 'Could not save moderation result.' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
