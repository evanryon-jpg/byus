// Platform admin gate. ByUs has a single owner today, and that owner's own account
// (evanryon@yahoo.com) is also the working creator account this whole app gets tested
// with — flipping its `role` column to 'admin' would break every creator-only route it
// currently exercises. So admin access is a separate, additive allowlist rather than a
// third value layered onto `role`, even though the `users_role_check` constraint already
// has room for 'admin' (unused so far). Add more addresses here if ByUs ever gets a
// second admin; a real is_admin column (or admin-role account) is the natural next step
// if that list grows past a handful of hand-picked people.
const ADMIN_EMAILS = new Set(['evanryon@yahoo.com']);

export function isAdmin(session) {
  return Boolean(session?.email && ADMIN_EMAILS.has(session.email.toLowerCase()));
}

// Operational alerts (for example, new Stripe disputes) should go to the exact same
// people who can act on them in /admin. Return a copy so callers can't mutate the
// authorization allowlist by accident.
export function getAdminEmails() {
  return Array.from(ADMIN_EMAILS);
}

// Phone numbers for time-sensitive SMS alerts (see lib/alerts.js's alertReviewQueue) --
// e.g. a brand-new creator's first video sitting in the review queue, which blocks every
// upload they make until it's cleared. Deliberately an env var rather than a hardcoded
// list like ADMIN_EMAILS above: a personal cell number doesn't belong committed to the
// repo the way a fixed platform-owner email does. Comma-separated E.164 numbers
// (e.g. "+15551234567,+15557654321"); unset means this alert channel is just off, which
// callers treat as a no-op rather than an error.
export function getAdminAlertPhones() {
  const raw = process.env.ADMIN_ALERT_PHONES || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
