// The fixed set of free-trial lengths a creator can offer on a subscription tier (see
// the "Free trial" selector in app/creator/dashboard/page.js's TierSection/TierRow) --
// enforced server-side in app/api/creator/tiers/route.js and its [tierId] PATCH handler,
// and read at checkout time by app/api/subscribe/route.js to set Stripe's
// trial_period_days. A closed list, same reasoning as lib/categories.js: a handful of
// sensible lengths rather than letting a creator type an arbitrary number of days.
export const TRIAL_DAY_OPTIONS = [0, 7, 14, 30];
