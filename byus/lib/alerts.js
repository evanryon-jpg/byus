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
import { getAdminEmails } from '@/lib/admin';
import { sendOpsAlertEmail } from '@/lib/email';

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
