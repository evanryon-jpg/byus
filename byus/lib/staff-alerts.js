// Emails support staff (lib/admin.js getSupportEmails) the moment something lands on the
// support desk: a video that needs a human review, a new content report, or a fan request
// the help assistant escalated. One email per kind per 10 minutes at most (Redis, same
// pattern as lib/alerts.js), so a burst of reports is one heads-up, not ten. No-ops when
// SUPPORT_EMAILS is unset. Never throws: an alert failing must not break the upload,
// report or chat that triggered it. Server-only.

import { Redis } from '@upstash/redis';
import { getSupportEmails } from '@/lib/admin';
import { sendStaffAlertEmail } from '@/lib/email';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const COOLDOWN_SECONDS = 10 * 60;

export async function notifyStaff(kind) {
  try {
    const to = getSupportEmails();
    if (to.length === 0) return;
    const claimed = await redis.set(`staff-alert-sent:${kind}`, '1', { nx: true, ex: COOLDOWN_SECONDS });
    if (!claimed) return;
    const base = process.env.APP_URL || 'https://byusapp.com';
    const url = kind === 'support' ? `${base}/admin/support` : `${base}/support-desk`;
    await sendStaffAlertEmail(to, { kind, url });
  } catch (err) {
    console.error(`notifyStaff: could not send "${kind}" alert:`, err);
  }
}
