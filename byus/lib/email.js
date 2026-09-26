// Email sending via Resend. Requires RESEND_API_KEY in the environment
// and a verified sending domain (byusapp.com) in the Resend dashboard.

import { Resend } from 'resend';
import {
  creatorCountryName,
  creatorCountryStatus,
  INTERNATIONAL_FOUNDING_LIMIT,
  INTERNATIONAL_FOUNDING_FEE_PERCENT,
} from './creator-countries';

const FROM_ADDRESS = 'ByUs <noreply@byusapp.com>';
// Resend's batch endpoint caps a single call at 100 emails -- larger sends just make
// more calls, chunked into groups this size.
const BATCH_CHUNK_SIZE = 100;

// Every email goes out from noreply@, but replies land somewhere real: support@byusapp.com
// forwards (ImprovMX) straight to the owner's inbox. Several emails below tell people to
// "just reply" -- before this, those replies went to noreply@ and were lost.
const REPLY_TO = 'support@byusapp.com';

const withReplyTo = (payload) => ({ replyTo: REPLY_TO, ...payload });

// A thin wrapper so every send -- single or batch, from this file or lib/broadcast-jobs.js
// -- gets the reply-to without each call site having to remember it. A payload that sets
// its own replyTo still wins.
function getClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('Email is not configured (missing RESEND_API_KEY).');
  }
  const client = new Resend(process.env.RESEND_API_KEY);
  return {
    emails: { send: (payload, options) => client.emails.send(withReplyTo(payload), options) },
    batch: { send: (payloads, options) => client.batch.send(payloads.map(withReplyTo), options) },
  };
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
export async function sendWaitlistConfirmationEmail(to, { displayName, foundingSpot, country }) {
  const resend = getClient();
  const greeting = displayName ? escapeHtml(displayName) : 'there';
  const spot = foundingSpot ? Number(foundingSpot) : null;
  // Creator accounts are US-only at launch (lib/creator-countries.js).
  const countryStatus = creatorCountryStatus(country);
  const place = escapeHtml(creatorCountryName(country));
  const nextStep =
    countryStatus === 'soon'
      ? `<p><strong>What happens next:</strong> ByUs is opening creator accounts in the US first, and ${place} is on the list to follow, along with the rest of the UK, Europe and Canada. I'll email you the day creator accounts open in ${place}. Just sign up with this same email address.</p>`
      : countryStatus === 'unsupported'
      ? '<p><strong>What happens next:</strong> ByUs can only pay creators in the US at launch, with the UK, Europe and Canada coming next. Our payment partner doesn’t support payouts to your country yet, so we can’t hold a founding spot for you, but you’re on the list and I’ll let you know if that changes.</p>'
      : `<p><strong>What happens next:</strong> creator signups are paused for a short while. As soon as they reopen, I'll email you a link to ${spot ? 'claim your spot' : 'create your page'}. Just sign up with this same email address.</p>`;
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: spot ? `Thank you — founding spot #${spot} is yours` : 'Thank you for joining the ByUs creator waitlist',
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1A1A1A; line-height: 1.55;">
        <p>Hi ${greeting},</p>
        <p>Thank you for joining ByUs. ${spot ? "You're one of the very first creators to back what we're building, and that means a lot." : "It means a lot that you want to build your page here."}</p>
        ${countryStatus === 'unsupported' && !spot ? '' : countryStatus === 'soon' && !spot
          ? `<p><strong>You’re first in line for an international founding spot.</strong> When creator accounts open in ${place}, ${INTERNATIONAL_FOUNDING_LIMIT} international founding spots open with a ${INTERNATIONAL_FOUNDING_FEE_PERCENT}% platform fee for good, offered in the order people joined the list.</p>`
          : `<p>${spot
          ? `<strong>Your founding spot #${spot} of 50 is reserved.</strong> It locks in a 10% platform fee for good, standard domestic processing included.`
          : 'All 50 founding spots have been reserved, so you’re on the creator waitlist at standard pricing: a 13% platform fee, dropping to 10% for the rest of any month you earn $2,000 on ByUs.'}</p>`}
        ${nextStep}
        <p>In the meantime, take a look at the <a href="https://byusapp.com/demo" style="color:#146359;">example creator pages</a> to see what yours could look like. And if you'd like, reply and tell me what you create. I read every reply.</p>
        <p style="margin-top:28px;">Evan Ryon<br /><span style="color:#666;">Founder, ByUs</span></p>
      </div>
    `,
  });
  if (error) {
    console.error('Resend send failed:', error);
    throw new Error(error.message || 'Could not send the waitlist confirmation email.');
  }
}

// Sent once, the moment a brand-new creator account exists (email signup, Google, Apple,
// or a fan upgrading) -- see lib/creator-welcome.js, which guarantees the "once". A
// founding creator gets their spot number; anyone after the first 50 gets the same
// three steps without the founding line.
export async function sendCreatorWelcomeEmail(to, { displayName, foundingSpot, dashboardUrl }) {
  const resend = getClient();
  const greeting = displayName ? escapeHtml(displayName) : 'there';
  const spot = foundingSpot ? Number(foundingSpot) : null;
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: spot ? `Welcome to ByUs, founding creator #${spot}` : 'Welcome to ByUs',
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1A1A1A; line-height: 1.55;">
        <p>Hi ${greeting},</p>
        <p>${spot
          ? `Your account is set up and <strong>founding spot #${spot} is officially yours</strong>, with a 10% platform fee for good.`
          : 'Your creator account is set up. Welcome to ByUs.'}</p>
        <p>Three steps to launch your page:</p>
        <ol style="padding-left:20px;">
          <li style="margin-bottom:6px;">Add your photo and a short bio.</li>
          <li style="margin-bottom:6px;">Create your first membership tier (tiers start at $8).</li>
          <li>Publish a first post so new members have something waiting for them.</li>
        </ol>
        <p style="margin: 24px 0;">
          <a href="${dashboardUrl}" style="background:#146359;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">Go to your dashboard</a>
        </p>
        <p>If anything is confusing or doesn't work, just reply. It comes straight to me.</p>
        <p style="margin-top:28px;">Evan<br /><span style="color:#666;">Founder, ByUs</span></p>
      </div>
    `,
  });
  if (error) {
    console.error('Resend send failed:', error);
    throw new Error(error.message || 'Could not send the creator welcome email.');
  }
}

// Reopening day: one email per waitlist entry, sent from the admin page's "Email the
// waitlist" button (app/api/admin/waitlist/notify-reopen). Only ever sent while creator
// signup is actually open -- that route refuses otherwise -- so the link always works.
export async function sendSignupsReopenedEmail(to, { displayName, foundingSpot, signupUrl }) {
  const resend = getClient();
  const greeting = displayName ? escapeHtml(displayName) : 'there';
  const spot = foundingSpot ? Number(foundingSpot) : null;
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: spot ? `Your ByUs founding spot #${spot} is ready to claim` : 'ByUs creator signups are open',
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1A1A1A; line-height: 1.55;">
        <p>Hi ${greeting},</p>
        <p>Good news: creator signups on ByUs are open again, and you're one of the first to know.</p>
        <p>${spot
          ? `<strong>Founding spot #${spot} is waiting for you.</strong> Create your creator account with this same email address and it's yours, with a 10% platform fee for good.`
          : 'Create your creator account with this same email address to get started.'}</p>
        <p style="margin: 24px 0;">
          <a href="${signupUrl}" style="background:#146359;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">${spot ? 'Claim your spot' : 'Create your page'}</a>
        </p>
        <p>Thank you for waiting. If you have any questions, just reply.</p>
        <p style="margin-top:28px;">Evan<br /><span style="color:#666;">Founder, ByUs</span></p>
      </div>
    `,
  });
  if (error) {
    console.error('Resend send failed:', error);
    throw new Error(error.message || 'Could not send the signups-reopened email.');
  }
}

// Confirms a suspension appeal was received — sent from POST /api/account/appeal.
// Deliberately doesn't promise a specific outcome or timeline beyond "review," since
// this fires before anyone on the team has actually looked at the case.
export async function sendAppealReceivedEmail(to, { displayName }) {
  const resend = getClient();
  const greeting = displayName ? escapeHtml(displayName) : 'there';
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: 'We received your ByUs appeal',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1A1A1A;">
        <h2 style="color:#146359;">Thanks, ${greeting} — we've got it.</h2>
        <p>Your appeal of your ByUs account suspension has been received and is queued for review by the ByUs team.</p>
        <p>We'll follow up at this email address once we've reviewed it. There's no need to submit a second appeal in the meantime — doing so won't speed up the review.</p>
        <p style="color:#666;font-size:13px;">Questions in the meantime? Reply to this email or reach us at support@byusapp.com.</p>
      </div>
    `,
  });
  if (error) {
    console.error('Resend send failed:', error);
    throw new Error(error.message || 'Could not send the appeal confirmation email.');
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

// Instant heads-up to the ByUs admin(s) when someone joins the founding creator waitlist --
// called best-effort from app/api/waitlist/route.js right after the joiner's own
// confirmation email. Early on every signup is worth knowing about the moment it happens,
// not the next morning; the daily digest (sendOpsDigestEmail below) still lists them too.
// Email rather than SMS on purpose: good news can wait until you look, texts are kept for
// things that need action.
export async function sendNewWaitlistSignupEmail(to, { email, displayName, foundingSpot, foundingStats, adminUrl, country }) {
  const resend = getClient();
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: foundingSpot
      ? `New ByUs waitlist signup: founding spot #${foundingSpot} reserved`
      : 'New ByUs waitlist signup',
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #1A1A1A;">
        <h2 style="color:#146359;margin-bottom:4px;">Someone just joined the creator waitlist</h2>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;font-size:14px;">
          <tr><td style="padding:6px 0;color:#666;">Email</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(email)}</td></tr>
          ${displayName ? `<tr><td style="padding:6px 0;color:#666;">Name</td><td style="padding:6px 0;">${escapeHtml(displayName)}</td></tr>` : ''}
          ${country ? `<tr><td style="padding:6px 0;color:#666;">Country</td><td style="padding:6px 0;">${escapeHtml(country)}</td></tr>` : ''}
          <tr><td style="padding:6px 0;color:#666;">Founding spot</td><td style="padding:6px 0;">${foundingSpot ? `#${escapeHtml(String(foundingSpot))}` : country && country !== 'United States' ? 'None yet: international founding list (11%)' : 'None left (standard pricing)'}</td></tr>
        </table>
        ${foundingStats ? `<p style="color:#666;font-size:13px;">${escapeHtml(String(foundingStats.claimed))} of ${escapeHtml(String(foundingStats.limit))} founding spots reserved · ${escapeHtml(String(foundingStats.remaining))} remaining</p>` : ''}
        ${adminUrl ? `<p style="margin:24px 0;"><a href="${adminUrl}" style="background:#146359;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">Open ByUs admin</a></p>` : ''}
        <p style="color:#999;font-size:12px;">They were already sent their own confirmation email. Nothing for you to do unless you want to say hello.</p>
      </div>
    `,
  });
  if (error) {
    console.error('Resend new-waitlist-signup email failed:', error);
    throw new Error(error.message || 'Could not send the new waitlist signup email.');
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

// A once-a-day rollup so a single operator doesn't have to keep re-checking /admin's
// separate queues by hand to know whether anything needs them -- see
// app/api/cron/ops-digest/route.js, which gathers these counts from the same loaders
// /admin's own pages already use (lib/admin-data.js's loadComplianceSnapshot,
// lib/sms-holds.js's listPendingSmsBroadcastHolds) so the numbers here never drift from
// what clicking into /admin shows. Deliberately quiet on a fully-clear day rather than
// skipped entirely -- a digest that only shows up when something's wrong is easy to
// start ignoring the one day it matters, so this always sends, and the subject line
// itself says whether anything needs attention.
export async function sendOpsDigestEmail(to, {
  pendingVideoReviews,
  openContentReports,
  openAppeals,
  openPaymentDisputes,
  pendingSmsHolds,
  openSupportRequests,
  highRiskCheckoutsLast24h,
  suspensionsLast30d,
  currentlySuspended,
  autoApprovedVideosLast24h,
  checkoutsLast24h,
  newWaitlistSignups = [],
  foundingStats = null,
  newFanAccountsLast24h = 0,
  newCreatorAccountsLast24h = 0,
  adminUrl,
}) {
  const resend = getClient();
  // Video moderation, content reports, and SMS holds are all sections on the single
  // /admin page (see app/admin/AdminClient.js) rather than dedicated routes -- only
  // appeals and disputes get their own sub-page, so only those two links go deeper.
  const actionable = [
    { label: 'Videos waiting on your review', value: pendingVideoReviews, href: adminUrl },
    { label: 'Open content reports', value: openContentReports, href: adminUrl },
    { label: 'Open suspension appeals', value: openAppeals, href: `${adminUrl}/appeals` },
    { label: 'Open payment disputes', value: openPaymentDisputes, href: `${adminUrl}/disputes` },
    { label: 'SMS broadcasts held for approval', value: pendingSmsHolds, href: adminUrl },
    { label: 'Fan support requests waiting on a reply', value: openSupportRequests, href: `${adminUrl}/support` },
    { label: 'High-risk checkouts, last 24h', value: highRiskCheckoutsLast24h, href: `${adminUrl}/risk` },
  ];
  const needsAttention = actionable.filter((row) => Number(row.value) > 0);
  const baseSubject = needsAttention.length > 0
    ? `ByUs daily digest: ${needsAttention.length} thing${needsAttention.length === 1 ? '' : 's'} need${needsAttention.length === 1 ? 's' : ''} you`
    : 'ByUs daily digest: all clear';
  // New waitlist signups are good news, not a queue -- they never count toward "needs
  // you", but they ride in the subject line so they're seen without opening the email.
  const signupCount = newWaitlistSignups.length;
  const subject = signupCount > 0
    ? `${baseSubject} · ${signupCount} new waitlist signup${signupCount === 1 ? '' : 's'}`
    : baseSubject;

  const signupsHtml = signupCount > 0
    ? `
        <h3 style="margin:24px 0 4px;font-size:16px;color:#146359;">New on the founding waitlist (last 24h)</h3>
        <table style="border-collapse:collapse;width:100%;margin:8px 0 4px;font-size:14px;">
          ${newWaitlistSignups.map((signup) => `
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #EEE;">
                ${escapeHtml(signup.email)}${signup.displayName ? ` <span style="color:#666;">(${escapeHtml(signup.displayName)})</span>` : ''}
              </td>
              <td style="padding:8px 0;border-bottom:1px solid #EEE;text-align:right;font-weight:700;color:#146359;">
                ${signup.foundingSpot ? `Spot #${escapeHtml(String(signup.foundingSpot))}` : 'Standard pricing'}
              </td>
            </tr>`).join('')}
        </table>
        ${foundingStats ? `<p style="color:#666;font-size:13px;margin:4px 0 0;">${escapeHtml(String(foundingStats.claimed))} of ${escapeHtml(String(foundingStats.limit))} founding spots reserved · ${escapeHtml(String(foundingStats.remaining))} remaining</p>` : ''}`
    : '';

  const rowHtml = (row) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #EEE;color:${Number(row.value) > 0 ? '#1A1A1A' : '#999'};">
        ${row.href ? `<a href="${row.href}" style="color:inherit;text-decoration:none;">${escapeHtml(row.label)}</a>` : escapeHtml(row.label)}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #EEE;text-align:right;font-weight:700;color:${Number(row.value) > 0 ? '#b42318' : '#999'};">
        ${escapeHtml(String(row.value ?? 0))}
      </td>
    </tr>`;

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject,
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #1A1A1A;">
        <h2 style="margin-bottom:4px;">${needsAttention.length > 0 ? 'A few things need you today' : 'All clear today'}</h2>
        <p style="color:#666;font-size:13px;margin-top:0;">Automated daily summary of everything sitting in a queue on ByUs.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;font-size:14px;">
          ${actionable.map(rowHtml).join('')}
        </table>
        ${signupsHtml}
        <table style="border-collapse:collapse;width:100%;margin:16px 0;font-size:13px;color:#666;">
          <tr><td style="padding:4px 0;">Videos auto-approved by AI moderation, last 24h</td><td style="padding:4px 0;text-align:right;">${escapeHtml(String(autoApprovedVideosLast24h ?? 0))}</td></tr>
          <tr><td style="padding:4px 0;">New fan accounts, last 24h</td><td style="padding:4px 0;text-align:right;">${escapeHtml(String(newFanAccountsLast24h ?? 0))}</td></tr>
          <tr><td style="padding:4px 0;">New creator accounts, last 24h</td><td style="padding:4px 0;text-align:right;">${escapeHtml(String(newCreatorAccountsLast24h ?? 0))}</td></tr>
          <tr><td style="padding:4px 0;">Checkouts started, last 24h</td><td style="padding:4px 0;text-align:right;">${escapeHtml(String(checkoutsLast24h ?? 0))}</td></tr>
          <tr><td style="padding:4px 0;">New suspensions, last 30 days</td><td style="padding:4px 0;text-align:right;">${escapeHtml(String(suspensionsLast30d ?? 0))}</td></tr>
          <tr><td style="padding:4px 0;">Currently suspended accounts</td><td style="padding:4px 0;text-align:right;">${escapeHtml(String(currentlySuspended ?? 0))}</td></tr>
        </table>
        <p style="margin:24px 0;">
          <a href="${adminUrl}" style="background:#146359;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">Open ByUs admin</a>
        </p>
        <p style="color:#999;font-size:12px;">Sent once a day. Anything time-sensitive (a flagged video, a new creator's first upload) already texted you separately.</p>
      </div>
    `,
  });

  if (error) {
    console.error('Resend ops digest failed:', error);
    throw new Error(error.message || 'Could not send the ops digest email.');
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