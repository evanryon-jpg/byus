export const dynamic = 'force-dynamic';

// Mux calls this for live-stream state changes and completed Robots moderation jobs.
// Live events update users.is_live; moderation results decide whether a hidden video
// can publish automatically or must stay in the human review queue.

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { query } from '@/lib/db';
import { createModerationJob } from '@/lib/mux';

const BORDERLINE_MARGIN = 0.2;

async function handleModerationCompleted(job) {
  const assetId = job.parameters?.asset_id;
  const outputs = job.outputs;
  if (!assetId || !outputs?.max_scores) return;

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
    await query(
      `UPDATE posts
       SET video_moderation_status = 'flagged', video_moderation_scores = $2::jsonb,
           video_moderated_at = now(), pending_review = true
       WHERE mux_asset_id = $1
         AND video_moderation_status IN ('queued', 'scanning', 'rescanning')`,
      [assetId, scoreRecord]
    );
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
  await query(
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
       AND p.video_moderation_status IN ('queued', 'scanning', 'rescanning')`,
    [assetId, scoreRecord]
  );
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
