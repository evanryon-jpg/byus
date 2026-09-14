// Founding Creator waitlist — the count feeding the homepage's "X creators have already
// applied" momentum line (see app/page.js's FoundingCreatorProgram). Split out from
// lib/fees.js's getFoundingPromoStats() on purpose: that one counts real creator
// accounts (role='creator' in `users`), which barely moves while Stripe Connect
// onboarding is paused and marketing traffic is funneled to the waitlist instead of real
// signup. This counts founding_waitlist rows instead, so the homepage shows what's
// actually happening right now rather than a stat frozen since the pause started.
export async function getWaitlistCount(queryFn) {
  const result = await queryFn(`SELECT COUNT(*)::int AS count FROM founding_waitlist`);
  return result.rows[0].count;
}
