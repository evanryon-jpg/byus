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
