// Guardrail for lib/sms.js's per-post fan-out: sent.dm bills per contact per month
// plus per-text carrier cost, so a single post from a creator with a large enough
// opted-in SMS audience could trigger a real, unbounded bill with no review -- see
// the comment in app/api/creator/posts/route.js's notifySubscribersOfNewPostBySms.
// Anything over SMS_HOLD_THRESHOLD recipients is written to sms_broadcast_holds
// instead of sent immediately, and only goes out once an admin approves it from
// /admin (see app/api/admin/sms-holds/route.js and its [id] route).
//
// Deliberately doesn't store the recipient phone numbers on the hold itself --
// approveSmsBroadcastHold re-fetches whoever is currently opted in right before
// sending, so a fan who verifies a number (or turns notifications off) between the
// hold being created and an admin acting on it is respected either way, rather than
// texted (or missed) based on a stale snapshot.

import { query } from '@/lib/db';
import { sendSms, SMS_BATCH_SIZE } from '@/lib/sms';

export const SMS_HOLD_THRESHOLD = 2000;

export async function createSmsBroadcastHold({ creatorId, postId, recipientCount }) {
  const result = await query(
    `INSERT INTO sms_broadcast_holds (creator_id, post_id, recipient_count)
     VALUES ($1, $2, $3)
     RETURNING id, creator_id, post_id, recipient_count, status, created_at`,
    [creatorId, postId, recipientCount]
  );
  return result.rows[0];
}

// Joined with just enough creator/post context for an admin to decide -- no fan phone
// numbers here, see the file header on why those are re-fetched fresh at approval time
// instead.
export async function listPendingSmsBroadcastHolds() {
  const result = await query(
    `SELECT h.id, h.recipient_count, h.created_at,
            c.display_name AS creator_name, c.slug AS creator_slug,
            p.title AS post_title
     FROM sms_broadcast_holds h
     JOIN users c ON c.id = h.creator_id
     LEFT JOIN posts p ON p.id = h.post_id
     WHERE h.status = 'pending'
     ORDER BY h.created_at ASC
     LIMIT 200`
  );
  return result.rows.map((row) => ({
    id: row.id,
    recipientCount: row.recipient_count,
    createdAt: row.created_at,
    creatorName: row.creator_name,
    creatorSlug: row.creator_slug,
    postTitle: row.post_title || null,
  }));
}

async function loadHoldContext(holdId) {
  const result = await query(
    `SELECT h.id, h.creator_id, h.post_id, h.status,
            c.display_name AS creator_name, c.slug AS creator_slug,
            p.title AS post_title
     FROM sms_broadcast_holds h
     JOIN users c ON c.id = h.creator_id
     LEFT JOIN posts p ON p.id = h.post_id
     WHERE h.id = $1`,
    [holdId]
  );
  return result.rows[0] || null;
}

// Approves and actually sends. Re-runs the same "who's eligible" query
// notifySubscribersOfNewPost uses (active subscription, SMS opted in, verified phone)
// rather than trusting anything captured when the hold was created.
export async function approveSmsBroadcastHold(holdId, adminUserId) {
  const hold = await loadHoldContext(holdId);
  if (!hold || hold.status !== 'pending') {
    return { ok: false, error: 'This hold has already been resolved.' };
  }

  // The post it was for got deleted in the meantime -- nothing sensible to send
  // anymore. Resolve it as rejected rather than leaving it stuck pending forever.
  if (!hold.post_id) {
    await query(
      `UPDATE sms_broadcast_holds SET status = 'rejected', resolved_by = $1, resolved_at = now()
       WHERE id = $2`,
      [adminUserId, holdId]
    );
    return { ok: false, error: 'The post this was for no longer exists.' };
  }

  const subscribers = await query(
    `SELECT u.phone AS sms_phone
     FROM subscriptions s
     JOIN users u ON u.id = s.fan_id
     WHERE s.creator_id = $1 AND s.status = 'active'
       AND (s.current_period_end IS NULL OR s.current_period_end > now())
       AND u.notify_new_posts_sms = true AND u.phone_verified_at IS NOT NULL`,
    [hold.creator_id]
  );
  const phones = subscribers.rows.map((row) => row.sms_phone).filter(Boolean);

  const creatorUrl = `${process.env.APP_URL}/creator/${hold.creator_slug || hold.creator_id}`;
  const title = hold.post_title ? `"${hold.post_title}"` : 'a new post';
  const text = `${hold.creator_name || 'Your creator'} just posted ${title} on ByUs: ${creatorUrl}`;

  let sent = 0;
  for (let i = 0; i < phones.length; i += SMS_BATCH_SIZE) {
    const batch = phones.slice(i, i + SMS_BATCH_SIZE);
    const result = await sendSms(batch, text);
    if (result.ok) sent += batch.length;
  }

  await query(
    `UPDATE sms_broadcast_holds SET status = 'approved', resolved_by = $1, resolved_at = now()
     WHERE id = $2`,
    [adminUserId, holdId]
  );
  return { ok: true, sent, eligible: phones.length };
}

export async function rejectSmsBroadcastHold(holdId, adminUserId) {
  const result = await query(
    `UPDATE sms_broadcast_holds SET status = 'rejected', resolved_by = $1, resolved_at = now()
     WHERE id = $2 AND status = 'pending'
     RETURNING id`,
    [adminUserId, holdId]
  );
  if (result.rows.length === 0) {
    return { ok: false, error: 'This hold has already been resolved.' };
  }
  return { ok: true };
}
