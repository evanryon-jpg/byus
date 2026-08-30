// Email sending via Resend. Requires RESEND_API_KEY in the environment
// and a verified sending domain (byusapp.com) in the Resend dashboard.

import { Resend } from 'resend';

const FROM_ADDRESS = 'ByUs <noreply@byusapp.com>';

function getClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('Email is not configured (missing RESEND_API_KEY).');
  }
  return new Resend(process.env.RESEND_API_KEY);
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
