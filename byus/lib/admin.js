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

// Support staff (Sept 26, 2026): the limited role for a hired helper -- an admin
// assistant or an outside support agency. They can review pending videos, triage content
// reports, and answer fan support requests, on the /support-desk page. They can't see
// money (revenue, refunds, disputes, payouts, accounting), fan IP addresses or tax
// records, the waitlist, or suspend accounts; those stay with admins. Only these API
// routes accept support staff: /api/admin/posts/:id/moderation, /api/admin/reports(/:id)
// and /api/admin/support(/:id). Everything else under /api/admin still calls isAdmin().
//
// Addresses come from the SUPPORT_EMAILS env var (comma-separated, set in Vercel) rather
// than this file, since the repo is public and a helper's email doesn't belong in it.
// Unset means no support staff, which is the case today. Removing someone from the env
// var and redeploying ends their access on their next request.
function supportEmails() {
  return new Set(
    (process.env.SUPPORT_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

// Support staff addresses only (admins not included), for support desk alerts.
export function getSupportEmails() {
  return Array.from(supportEmails());
}

export function isSupportStaff(session) {
  if (isAdmin(session)) return true;
  return Boolean(session?.email && supportEmails().has(session.email.toLowerCase()));
}

// The flags every "who am I" response carries, so the nav can show Admin or Support desk.
export function staffFlags(session) {
  const admin = isAdmin(session);
  return { is_admin: admin, is_support: !admin && isSupportStaff(session) };
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
