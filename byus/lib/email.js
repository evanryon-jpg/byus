// Email sending via Resend. Requires RESEND_API_KEY in the environment
// and a verified sending domain (byusapp.com) in the Resend dashboard.

import { Resend } from 'resend';

const FROM_ADDRESS = 'ByUs <noreply@byusapp.com>';
// Resend's batch endpoint caps a single call at 100 emails -- larger sends just make
// more calls, chunked into groups this size.
const BATCH_CHUNK_SIZE = 100;

function getClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('Email is not configured (missing RESEND_API_KEY).');
  }
  return new Resend(process.env.RESEND_API_KEY);
}

// Exposed for lib/broadcast-jobs.js, which sends its own chunks directly (a resumable
// job claims and sends one chunk of recipients at a time across possibly many worker
// invocations, rather than looping over the whole list in a single call the way
// sendBatchInChunks below does) but still wants the same configured Resend client.
export function getResendClient() {
  return getClient();
}

// Resend's batch endpoint caps a single call at 100 emails. Exported so
// lib/broadcast-jobs.js claims recipients in the same size chunks this file sends
// them in — one source of truth for the number instead of a second magic 100.
export const BATCH_CHUNK_SIZE_EXPORTED = BATCH_CHUNK_SIZE;

// The subject/message here come straight from a creator's own form input and get
// dropped into an HTML email -- escape it so a stray "<" or "&" can't break the
// layout (or worse, inject markup) in every recipient's inbox.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Sends `emails` (one { from, to, subject, html } object per recipient) through
// Resend's batch endpoint in chunks of BATCH_CHUNK_SIZE. Used by sendNewPostEmail and
// sendCreatorUpdateEmail below, both of which fan out to every one of a creator's
// subscribers -- a list large enough to need more than one batch call.
//
// A failed chunk no longer aborts every chunk after it: earlier versions threw on the
// first Resend error, which for a 250-recipient send meant chunk 1 (100 people) could
// already be delivered while the thrown error made the caller (and the creator) believe
// nothing went out, and recipients 101-250 never got a delivery attempt at all. Each
// chunk is now tried independently and its outcome recorded, so one bad chunk (a
// transient Resend error, a malformed address in that particular batch) can't silently
// swallow every recipient queued after it. Only throws when NOTHING got through --
// every existing caller already only cares about "did this actually send" at that
// all-or-nothing level, and callers can inspect the returned `failed` count for a
// partial-failure summary instead of assuming an all-or-nothing result.
async function sendBatchInChunks(resend, emails) {
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < emails.length; i += BATCH_CHUNK_SIZE) {
    const chunk = emails.slice(i, i + BATCH_CHUNK_SIZE);
    try {
      const { error } = await resend.batch.send(chunk);
      if (error) {
        console.error('Resend batch send failed for one chunk (continuing with remaining chunks):', error);
        failed += chunk.length;
      } else {
        sent += chunk.length;
      }
    } catch (err) {
      console.error('Resend batch send threw for one chunk (continuing with remaining chunks):', err);
      failed += chunk.length;
    }
  }
  return { sent, failed };
}

export async function sendVerificationEmail(to, verifyUrl) {
  const resend = getClient();
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: 'Verify your ByUs email address',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1A1A1A;">
        <h2 style="color:#146359;">Verify your email</h2>
        <p>Thanks for signing up for ByUs. Click the button below to verify this email address. This link expires in 24 hours.</p>
        <p style="margin: 24px 0;">
          <a href="${verifyUrl}" style="background:#146359;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">Verify email</a>
        </p>
        <p style="color:#666;font-size:13px;">If you didn't create a ByUs account, you can safely ignore this email.</p>
        <p style="color:#999;font-size:12px;margin-top:24px;">Questions? Contact us at support@byusapp.com.</p>
      </div>
    `,
  });
  if (error) {
    console.error('Resend send failed:', error);
    throw new Error(error.message || 'Could not send the verification email.');
  }
}

export async function sendPasswordResetEmail(to, resetUrl) {
  const resend = getClient();
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: 'Reset your ByUs password',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1A1A1A;">
        <h2 style="color:#146359;">Reset your password</h2>
        <p>We got a request to reset the password on your ByUs account. Click the button below to choose a new one. This link expires in 1 hour.</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" style="background:#146359;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">Reset password</a>
        </p>
        <p style="color:#666;font-size:13px;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
      </div>
    `,
  });
  if (error) {
    console.error('Resend send failed:', error);
    throw new Error(error.message || 'Could not send the password reset email.');
  }
}

// Sent once, right when a fan's very first payment to a creator actually goes through
// (the Stripe webhook's checkout.session.completed handler) — a receipt-adjacent "you're
// in" moment, not a marketing email, so it's a single send with no batching concerns.
export async function sendWelcomeSubscriptionEmail(to, { creatorName, creatorUrl }) {
  const resend = getClient();
  const safeCreatorName = escapeHtml(creatorName);
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `You're subscribed to ${creatorName} on ByUs`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1A1A1A;">
        <h2 style="color:#146359;">You're in!</h2>
        <p>Your subscription to <strong>${safeCreatorName}</strong> is active — subscriber-only posts, updates, and anything else they share with supporters are ready for you now.</p>
        <p style="margin: 24px 0;">
          <a href="${creatorUrl}" style="background:#146359;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">Visit ${safeCreatorName}'s page</a>
        </p>
        <p style="color:#666;font-size:13px;">You can manage or cancel this subscription anytime from your ByUs dashboard.</p>
        <p style="color:#999;font-size:12px;margin-top:24px;">Don't want emails like this? Turn off new-post notifications in your ByUs settings.</p>
      </div>
    `,
  });
  if (error) {
    console.error('Resend send failed:', error);
    throw new Error(error.message || 'Could not send the welcome email.');
  }
}

// Sent once, right when someone joins the Founding Creator waitlist (see
// app/api/waitlist/route.js). Creator signup is paused as of Sep 2026, so this confirms
// the waitlist join and sets expectations for a follow-up once signup reopens — it must
// NOT point people straight at /signup?role=creator as if they can finish onboarding today.
export async function sendWaitlistConfirmationEmail(to, { displayName, foundingSpot }) {
  const resend = getClient();
  const greeting = displayName ? escapeHtml(displayName) : 'there';
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: foundingSpot ? `Your ByUs founding spot #${foundingSpot} is reserved` : "You're on the ByUs creator waitlist",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1A1A1A;">
        <h2 style="color:#146359;">You're on the list, ${greeting}.</h2>
        <p>Thanks for joining the ByUs creator waitlist. New creator signups are temporarily paused; we'll email you when they reopen.</p>
        <p>${foundingSpot
          ? `Your founding spot #${Number(foundingSpot)} is reserved, with a 10% platform fee for good, including standard domestic processing. Create your creator account with this same email address when signups reopen to claim it.`
          : 'All 50 founding spots are reserved. You are on the general creator waitlist; the standard 13% platform fee will apply.'}</p>
        <p style="margin: 24px 0;">
          <a href="https://byusapp.com" style="background:#146359;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">Visit ByUs</a>
        </p>
        <p style="color:#666;font-size:13px;">Questions? Just reply to this email or reach us at support@byusapp.com.</p>
      </div>
    `,
  });
  if (error) {
    console.error('Resend send failed:', error);
    throw new Error(error.message || 'Could not send the waitlist confirmation email.');
  }
}

// Urgent owner alert for a newly-opened card dispute. Kept separate from customer-facing
// mail so a failed alert can be retried safely by the Stripe webhook without affecting the
// payment itself. The webhook marks stripe_disputes.alert_sent_at only after this succeeds.
export async function sendDisputeAlertEmail(to, {
  disputeId,
  amountCents,
  currency,
  reason,
  responseDueAt,
  adminUrl,
}) {
  const resend = getClient();
  const amount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: String(currency || 'usd').toUpperCase(),
  }).format((Number(amountCents) || 0) / 100);
  const dueText = responseDueAt
    ? new Date(responseDueAt).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    : 'Check Stripe immediately — no response deadline was supplied in the webhook.';

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `Action required: ByUs dispute for ${amount}`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1A1A1A;">
        <h2 style="color:#b42318;">New payment dispute</h2>
        <p>A cardholder has disputed a ByUs payment. Review it promptly so the response window isn't missed.</p>
        <table style="border-collapse:collapse;width:100%;margin:20px 0;font-size:14px;">
          <tr><td style="padding:6px 0;color:#666;">Amount</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(amount)}</td></tr>
          <tr><td style="padding:6px 0;color:#666;">Reason</td><td style="padding:6px 0;">${escapeHtml(reason || 'Not provided')}</td></tr>
          <tr><td style="padding:6px 0;color:#666;">Stripe dispute</td><td style="padding:6px 0;">${escapeHtml(disputeId)}</td></tr>
          <tr><td style="padding:6px 0;color:#666;">Response due</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(dueText)}</td></tr>
        </table>
        <p style="margin:24px 0;">
          <a href="${adminUrl}" style="background:#146359;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">Open ByUs admin</a>
        </p>
        <p style="color:#666;font-size:13px;">Use the dispute evidence package in ByUs together with Stripe's dispute workflow before submitting a response.</p>
      </div>
    `,
  });

  if (error) {
    console.error('Resend dispute alert failed:', error);
    throw new Error(error.message || 'Could not send the dispute alert email.');
  }
}

// General-purpose ops alert for a production error worth someone's immediate attention --
// see lib/alerts.js, which is what actually decides *when* to call this (throttled, so a
// repeating failure sends one email rather than one per occurrence). Kept separate from
// sendDisputeAlertEmail above even though the shape is identical, since a dispute alert's
// send is tracked per-dispute in the database (stripe_disputes.alert_sent_at) while this
// one is throttled in Redis by lib/alerts.js instead -- different callers, different retry
// semantics, not worth forcing through one shared function.
export async function sendOpsAlertEmail(to, { context, message, stack }) {
  const resend = getClient();
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `ByUs alert: ${context}`,
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #1A1A1A;">
        <h2 style="color:#b42318;">Something needs attention</h2>
        <table style="border-collapse:collapse;width:100%;margin:20px 0;font-size:14px;">
          <tr><td style="padding:6px 0;color:#666;vertical-align:top;">Where</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(context)}</td></tr>
          <tr><td style="padding:6px 0;color:#666;vertical-align:top;">Error</td><td style="padding:6px 0;">${escapeHtml(message || 'No message')}</td></tr>
        </table>
        ${stack ? `<pre style="background:#F8FAFC;border:1px solid #E5E7EB;border-radius:8px;padding:12px;font-size:11px;overflow-x:auto;white-space:pre-wrap;">${escapeHtml(stack).slice(0, 4000)}</pre>` : ''}
        <p style="color:#999;font-size:12px;margin-top:24px;">This is an automated alert, throttled to one email per 30 minutes per source — repeat failures in between won't send another until that window passes.</p>
      </div>
    `,
  });
  if (error) {
    console.error('Resend ops alert failed:', error);
    throw new Error(error.message || 'Could not send the ops alert email.');
  }
}

// Emails a creator's active subscribers when they publish a new post — one individual
// email per recipient (never one email with everyone in "to"), sent via the batch
// endpoint like the creator-update broadcast below. Only sent to subscribers who haven't
// turned this off (users.notify_new_posts). Returns { sent, failed } recipient counts
// rather than throwing on a partial failure — see sendBatchInChunks above.
// Factored out for the same reason as buildCreatorUpdateEmailContent above: this is a
// second fan-out with the identical single-request-timeout risk (see
// database/migrations/20260918_broadcast_jobs.sql), and lib/broadcast-jobs.js needs to
// build the exact same subject/html a job's recipients get without duplicating this
// template. sendNewPostEmail below is left in place, unused by app/api/creator/posts/
// route.js now that it queues a job instead, in case anything else ever calls it directly.
export function buildNewPostEmailContent({ creatorName, creatorUrl, postTitle, postExcerpt }) {
  const safeCreatorName = escapeHtml(creatorName);
  const safeTitle = postTitle ? escapeHtml(postTitle) : null;
  const excerpt = postExcerpt.length > 240 ? `${postExcerpt.slice(0, 240)}…` : postExcerpt;
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1A1A1A;">
      <p style="color:#146359; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:16px;">
        New from ${safeCreatorName}
      </p>
      ${safeTitle ? `<h2 style="margin:0 0 8px;">${safeTitle}</h2>` : ''}
      <p style="white-space:pre-wrap; line-height:1.6; font-size:15px; color:#333;">${escapeHtml(excerpt)}</p>
      <p style="margin: 24px 0;">
        <a href="${creatorUrl}" style="background:#146359;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">See the full post</a>
      </p>
      <p style="color:#999;font-size:12px;margin-top:32px;">
        You're getting this because you're subscribed to ${safeCreatorName} on ByUs.
        Turn off new-post emails anytime in your ByUs settings.
      </p>
    </div>
  `;
  const subject = safeTitle ? `${creatorName}: ${postTitle}` : `New post from ${creatorName}`;
  return { from: FROM_ADDRESS, subject, html };
}

export async function sendNewPostEmail(recipients, { creatorName, creatorUrl, postTitle, postExcerpt }) {
  if (recipients.length === 0) return { sent: 0, failed: 0 };
  const resend = getClient();

  const { from, subject, html } = buildNewPostEmailContent({ creatorName, creatorUrl, postTitle, postExcerpt });

  const { sent, failed } = await sendBatchInChunks(
    resend,
    recipients.map((to) => ({ from, to, subject, html }))
  );
  if (failed > 0) {
    console.error(`New-post email: ${failed} of ${recipients.length} recipients failed to send.`);
  }
  if (sent === 0 && recipients.length > 0) {
    throw new Error('Could not send the new-post email.');
  }

  return { sent, failed };
}

// Emails a creator's own free-text update to a list of subscriber addresses, one
// individual email per recipient (never one email with everyone in "to" -- that would
// leak every subscriber's address to every other one). Sent via the batch endpoint so
// a list of any size still costs one request per 100 recipients instead of one per
// person. Returns { sent, failed } recipient counts rather than throwing on a partial
// failure — see sendBatchInChunks above.
// Factored out of sendCreatorUpdateEmail below so lib/broadcast-jobs.js can build the
// exact same subject/html for a job's recipients without duplicating this template --
// the job worker sends its own chunks directly (see getResendClient above) rather than
// calling sendCreatorUpdateEmail itself, since that function loops over an entire
// recipient list in one call and the whole point of the job system is to never do that
// for a very large list in a single request/invocation again.
export function buildCreatorUpdateEmailContent({ creatorName, subject, message }) {
  const safeCreatorName = escapeHtml(creatorName);
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1A1A1A;">
      <p style="color:#146359; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:16px;">
        Update from ${safeCreatorName}
      </p>
      <div style="white-space:pre-wrap; line-height:1.6; font-size:15px;">${escapeHtml(message)}</div>
      <p style="color:#999;font-size:12px;margin-top:32px;">
        You're getting this because you're subscribed to ${safeCreatorName} on ByUs.
      </p>
    </div>
  `;
  return { from: FROM_ADDRESS, subject, html };
}

export async function sendCreatorUpdateEmail(recipients, { creatorName, subject, message }) {
  if (recipients.length === 0) return { sent: 0, failed: 0 };
  const resend = getClient();

  const { from, html } = buildCreatorUpdateEmailContent({ creatorName, subject, message });

  const { sent, failed } = await sendBatchInChunks(
    resend,
    recipients.map((to) => ({ from, to, subject, html }))
  );
  if (failed > 0) {
    console.error(`Creator update email: ${failed} of ${recipients.length} recipients failed to send.`);
  }
  if (sent === 0 && recipients.length > 0) {
    throw new Error('Could not send the update email.');
  }

  return { sent, failed };
}