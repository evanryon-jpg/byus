// Lightweight production error-alerting built on infrastructure this app already has --
// Resend for email (see lib/email.js), Upstash Redis for throttling (the same instance
// lib/rate-limit.js uses) -- rather than adding a new third-party monitoring service and
// its own account/DSN/signup step. This is not a replacement for real APM: no stack-trace
// grouping beyond the raw text, no dashboards, no request tracing. It exists purely so a
// systemic failure (every Stripe webhook erroring, the database unreachable, an external
// integration silently broken) reaches an inbox within the hour instead of being
// discovered by a user complaint or a manual check of the Vercel dashboard days later.
//
// Wire this into a catch block with alertOps('some-short-context-slug', err) wherever a
// failure is operationally urgent and currently only reaches console.error -- start with
// webhook handlers and anything else that silently breaks payment/subscription state if
// it fails, since those are the failure modes a manual dashboard check is least likely to
// catch quickly.

import { Redis } from '@upstash/redis';
import { getAdminEmails, getAdminAlertPhones } from '@/lib/admin';
import { sendOpsAlertEmail } from '@/lib/email';
import { sendSms, isSmsConfigured } from '@/lib/sms';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// One alert per context per this long, no matter how many times it fires in between -- a
// real outage keeps erroring on every retry/request, and nobody needs a fresh email for
// every single occurrence. 30 minutes is short enough that a genuine incident is still
// caught promptly, long enough that a bursty failure mode doesn't flood the inbox.
const ALERT_COOLDOWN_SECONDS = 30 * 60;

export async function alertOps(context, err) {
  try {
    const key = `alert-sent:${context}`;
    // SET ... NX EX: only the first caller within the cooldown window wins the claim and
    // actually sends; everyone else sees claimed === null and stays quiet. Doubles as the
    // cooldown timer itself -- no separate expiry bookkeeping needed.
    const claimed = await redis.set(key, '1', { nx: true, ex: ALERT_COOLDOWN_SECONDS });
    if (!claimed) return;

    await sendOpsAlertEmail(getAdminEmails(), {
      context,
      message: err?.message || String(err),
      stack: err?.stack || null,
    });
  } catch (alertErr) {
    // Alerting itself failing must never throw back into the caller's own error handling
    // — that would turn an alert-delivery hiccup into a second, unrelated failure stacked
    // on top of the one actually being reported.
    console.error(`alertOps: failed to send alert for "${context}":`, alertErr);
  }
}

// A text, not an email -- for the one queue where an email sitting unread for a few
// hours has a real cost: a brand-new creator's very first video always lands in
// pending_review (nothing is auto-approved until an admin clears the account once), so
// every hour that first video sits unreviewed is an hour that creator can't publish
// anything else either. See app/api/webhooks/mux/route.js, which calls this right after
// the moderation webhook actually flips a post to pending_review = true -- never on a
// schedule, so this only ever fires when there's something to act on.
//
// Reuses lib/sms.js (sent.dm) rather than adding a push-notification service: it's
// already paid for and wired up for verification codes and fan post alerts. No-ops
// quietly if SENT_DM_API_KEY or ADMIN_ALERT_PHONES isn't set, so this stays inert until
// a phone number is actually configured instead of erroring on every video upload.
//
// Cooldown is per reason (not shared with alertOps' contexts) and much shorter than the
// 30-minute error-alert window -- a genuine incident can wait half an hour for a second
// email, but a creator blocked mid-onboarding shouldn't wait that long to learn a text
// already went out, and the two review reasons below have different urgency, so each
// gets its own timer rather than one fixed number.
const REVIEW_ALERT_COOLDOWN_SECONDS = {
  'flagged-content': 5 * 60,
  'first-video-review': 15 * 60,
};

// The video moderation queue is a section on the single /admin page (see
// app/admin/AdminClient.js), not a dedicated route -- both messages link there.
const REVIEW_ALERT_MESSAGES = {
  'flagged-content': 'ByUs: a video was flagged by moderation and needs your review. byusapp.com/admin',
  'first-video-review': "ByUs: a new creator's first video is waiting on your review before they can publish. byusapp.com/admin",
};

export async function alertReviewQueue(reason) {
  try {
    if (!isSmsConfigured()) return;
    const phones = getAdminAlertPhones();
    if (phones.length === 0) return;

    const cooldown = REVIEW_ALERT_COOLDOWN_SECONDS[reason] || 15 * 60;
    const key = `review-alert-sent:${reason}`;
    const claimed = await redis.set(key, '1', { nx: true, ex: cooldown });
    if (!claimed) return;

    const text = REVIEW_ALERT_MESSAGES[reason] || 'ByUs: a video is waiting on your review. byusapp.com/admin';
    const result = await sendSms(phones, text);
    if (!result.ok) {
      console.error(`alertReviewQueue: sendSms failed for "${reason}":`, result.error);
    }
  } catch (alertErr) {
    // Same reasoning as alertOps above -- a failure to text must never interrupt the
    // moderation webhook that triggered it.
    console.error(`alertReviewQueue: failed to send alert for "${reason}":`, alertErr);
  }
}
