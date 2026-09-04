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
        <p style="color:#999;font-size:12px;margin-top:24px;">Questions? Contact us at evanryon@yahoo.com.</p>
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

// Emails a creator's own free-text update to a list of subscriber addresses, one
// individual email per recipient (never one email with everyone in "to" -- that would
// leak every subscriber's address to every other one). Sent via the batch endpoint so
// a list of any size still costs one request per 100 recipients instead of one per
// person. Returns the number of recipients actually queued for delivery.
export async function sendCreatorUpdateEmail(recipients, { creatorName, subject, message }) {
  if (recipients.length === 0) return 0;
  const resend = getClient();

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

  for (let i = 0; i < recipients.length; i += BATCH_CHUNK_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_CHUNK_SIZE);
    const { error } = await resend.batch.send(
      chunk.map((to) => ({ from: FROM_ADDRESS, to, subject, html }))
    );
    if (error) {
      console.error('Resend batch send failed:', error);
      throw new Error(error.message || 'Could not send the update email.');
    }
  }

  return recipients.length;
}
