// SMS delivery via sent.dm (https://sent.dm) -- used for phone-verification codes
// (lib/phone-verification.js) and new-post text notifications for fans who've opted in
// (app/api/creator/posts/route.js). Talks to the raw HTTP API directly rather than
// pulling in sent.dm's SDK package, the same choice this app already made for Telegram
// (lib/telegram.js) -- there's no dependency/lockfile to keep in sync for what's a
// couple of fetch calls, and this app's GitHub-web-upload deploy flow (see the
// byus-deploy skill) never runs `npm install` to refresh one anyway.
//
// API reference: https://docs.sent.dm/reference/api. Auth is a plain API key in an
// `x-api-key` header (not a Bearer token) -- see https://docs.sent.dm/reference/api/authentication.
// A successful send returns 202 with { success: true, data: { recipients: [...] } };
// a failure returns the same success/error envelope at a 4xx/5xx status, including 429
// with a Retry-After-style rate limit and 402 for insufficient account balance.

const SENT_DM_API_KEY = process.env.SENT_DM_API_KEY;
const SENT_DM_API_BASE = 'https://api.sent.dm/v3';
// sent.dm accepts up to 1000 recipients per call for an identical message -- unlike
// this app's email broadcasts (see lib/email.js), which deliberately send one email
// per recipient because email's To: header would otherwise expose every other
// recipient's address, an SMS/WhatsApp send doesn't show a recipient any of the other
// numbers on the same API call, so batching many fans into one call here is not the
// same privacy hazard.
export const SMS_BATCH_SIZE = 1000;

export function isSmsConfigured() {
  return Boolean(SENT_DM_API_KEY);
}

// Sends the same text to up to SMS_BATCH_SIZE recipients (E.164 numbers) in one call.
// Never throws -- returns { ok: true, count } or { ok: false, error } so callers (the
// verification-code sender, the new-post notifier) decide for themselves what a
// failure means for their own flow instead of this function deciding for all of them.
export async function sendSms(to, text) {
  if (!isSmsConfigured()) {
    return { ok: false, error: 'SMS is not configured.' };
  }
  if (!Array.isArray(to) || to.length === 0) {
    return { ok: true, count: 0 };
  }
  if (to.length > SMS_BATCH_SIZE) {
    return { ok: false, error: `Cannot send to more than ${SMS_BATCH_SIZE} recipients in one call.` };
  }

  try {
    const res = await fetch(`${SENT_DM_API_BASE}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SENT_DM_API_KEY,
      },
      body: JSON.stringify({ to, text, channel: ['sms'] }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.success) {
      const message = body?.error?.message || `sent.dm returned ${res.status}`;
      return { ok: false, error: message };
    }
    return { ok: true, count: body.data?.recipients?.length ?? to.length };
  } catch (err) {
    return { ok: false, error: err.message || 'Network error contacting sent.dm.' };
  }
}

// Convenience wrapper for the one-recipient case (verification codes) so callers don't
// have to think about the array shape.
export async function sendSmsToOne(to, text) {
  const result = await sendSms([to], text);
  if (!result.ok) return result;
  return { ok: true };
}
