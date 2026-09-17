// Single source of truth for whether a brand-new CREATOR account can be created right
// now. Flip this back to false once the Stripe account review is resolved and creator
// signup should reopen — every path that can mint a new creator account checks this
// flag: the email/password signup route (app/api/auth/signup/route.js), and the
// Google/Apple OAuth start routes (which decide what role a first-time OAuth signup
// gets created with in their respective callbacks).
//
// This does NOT touch existing creator accounts (they keep logging in and working
// normally) or fan signup/subscribing in any way — only the creation of new creator
// accounts. The UI-side of this pause lives in app/signup/page.js, which shows a
// waitlist form (posting to /api/waitlist) instead of the normal signup form whenever
// role === 'creator'; this flag is the server-side backstop for anyone who reaches
// these routes directly instead of through that page.
export const CREATOR_SIGNUP_PAUSED = true;

export const CREATOR_SIGNUP_PAUSED_MESSAGE =
  'New creator accounts are temporarily paused. Join the waitlist at /signup and we’ll email you as soon as signups reopen.';
