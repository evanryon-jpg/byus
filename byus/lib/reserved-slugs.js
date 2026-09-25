// Words a creator cannot claim as their /creator/<slug> vanity URL. Creator pages
// live under /creator/*, not at the site root, so this only needs to guard against
// other routes that already exist (or plausibly will) under /creator/*.
export const RESERVED_SLUGS = new Set([
  'dashboard',
  // A real static page (app/creator/onboarding) that would shadow a creator page at this slug.
  'onboarding',
  'settings',
  'new',
  'edit',
  'admin',
  'api',
  'login',
  'signup',
]);
