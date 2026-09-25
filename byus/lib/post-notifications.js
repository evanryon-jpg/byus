// New-post notifications (email + SMS) to a creator's active subscribers. Shared by every
// path that makes a post visible for the first time:
//   - app/api/creator/posts (a post published straight away)
//   - app/api/webhooks/mux (a video whose AI moderation scan comes back clean)
//   - app/api/admin/posts/[postId]/moderation (an admin approving a held video)
// It used to live only in the posts route, which skips it for anything held for review --
// and every video is held for moderation -- so subscribers were never told about a video.
// Callers must invoke this only on the transition to visible (e.g. off an UPDATE ...
// RETURNING that matched), so a post is announced exactly once.
//
// A creator's account review (app/api/admin/users/[id]/clear-review) is deliberately not a
// caller: subscribing is blocked until that review clears (see app/api/subscribe), so a
// not-yet-cleared creator has no subscribers to notify.

import { query } from '@/lib/db';
import { createBroadcastJob, processBroadcastJobChunk } from '@/lib/broadcast-jobs';
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

// post needs { id, title, body }.
export async function notifySubscribersOfNewPost(creatorId, post) {
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
