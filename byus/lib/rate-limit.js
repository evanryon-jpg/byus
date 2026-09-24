// Shared rate limiting for endpoints that are expensive, sensitive, or attractive to
// automate against (auth, password reset, subscription checkout). Backed by the
// Upstash Redis instance already provisioned for this project (KV_REST_API_* env vars,
// added via the Vercel Storage tab's "Upstash for Redis" integration).

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// One limiter per endpoint family, sized to that endpoint's abuse risk rather than a
// single global number. Sliding windows so a burst right at a window boundary can't
// double an attacker's effective budget.
const limiters = {
  login: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '60 s'),
    prefix: 'rl:login',
  }),
  signup: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 h'),
    prefix: 'rl:signup',
  }),
  // Guards the Google and Apple OAuth start + callback endpoints. Slightly more
  // generous than login's raw credential attempts since a legitimate person bouncing
  // through an account picker (wrong account, back button, slow mobile network) can
  // hit these routes more than once in quick succession without doing anything wrong.
  oauth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '10 m'),
    prefix: 'rl:oauth',
  }),
  'forgot-password': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 h'),
    prefix: 'rl:forgot-password',
  }),
  'reset-password': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    prefix: 'rl:reset-password',
  }),
  subscribe: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    prefix: 'rl:subscribe',
  }),
  'connect-stripe': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 h'),
    prefix: 'rl:connect-stripe',
  }),
  // Guards the current-password check on PATCH /api/me/password. That check is a live
  // password verification reachable by anyone with a valid session, so a hijacked session
  // token could otherwise brute-force it with no friction at all — same risk shape as login,
  // just authenticated instead of anonymous.
  'password-change': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '60 s'),
    prefix: 'rl:password-change',
  }),
  // Guards resending a verification email — session-gated already, but without a
  // limit a single account could be used to spam an inbox (or someone else's, if we
  // ever allow changing the address before verifying) with repeated sends.
  'resend-verification': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, '1 h'),
    prefix: 'rl:resend-verification',
  }),
  // Guards opening a Stripe Billing Portal session — hits the Stripe API like
  // connect-stripe does, just on the fan side.
  'billing-portal': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 h'),
    prefix: 'rl:billing-portal',
  }),
  // Guards the two file-upload endpoints (post media, avatars). Uploads are relatively
  // expensive (Blob storage writes, bandwidth) and otherwise have no cost to automating
  // against with a valid session — this keeps a single account from being used to hammer
  // Blob storage or run up usage.
  upload: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '10 m'),
    prefix: 'rl:upload',
  }),
  // Guards POST /api/creator/products (publishing a digital product). Same cost shape
  // as `upload` above -- each call writes a product row plus one row per attached file
  // -- but was missing here entirely, which meant `checkRateLimit('product-upload', ...)`
  // threw `Unknown rate limiter` on every single publish attempt. That throw happened
  // before that route's own try/catch (the rate-limit check runs first), so it crashed
  // out to Next's generic HTML error page instead of a JSON error response, which the
  // client then failed to parse -- surfacing as a plain "Network error — please try
  // again." with no server-side message. Caught live-verifying the digital-products
  // upload flow end to end on Sep 17, 2026, after separately fixing the missing
  // BLOB_READ_WRITE_TOKEN, a client-side upload-path bug, and a CSP connect-src gap --
  // publishing a product still failed even once a file could finally reach Blob storage.
  'product-upload': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '10 m'),
    prefix: 'rl:product-upload',
  }),
  // Guards creating a Mux direct-upload URL for a video post. Unlike the Blob-backed
  // `upload` limiter above, each call here provisions a real resource on Mux's side
  // (and eventually stored/delivered video minutes), so this is sized to a creator's
  // realistic "post a handful of videos in a sitting" usage, not automation-proofed at
  // the same generous rate as a cheap image upload.
  'video-upload': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(15, '1 h'),
    prefix: 'rl:video-upload',
  }),
  // Guards POST /api/creator/video-export (kick off downloadable copies of a
  // creator's whole video catalog). Unlike video-upload above, this isn't sized to
  // protect against a runaway Mux bill -- the "standard" static rendition it
  // requests is free to generate, and delivering the resulting MP4s costs the same
  // per-minute rate as ordinary streaming playback, so even a large catalog is a few
  // dollars at most. This exists purely to stop a compromised session from
  // re-triggering rendition generation across the same catalog over and over; the
  // GET on the same route that checks status isn't rate-limited at all, since
  // that's just a read.
  'video-export': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1, '24 h'),
    prefix: 'rl:video-export',
  }),
  // Guards saving a creator's social/external links — cheap to run, but still an
  // authenticated write with no other cost to automating against.
  'creator-links': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '10 m'),
    prefix: 'rl:creator-links',
  }),
  // Guards the AI setup assistant — each call is a paid LLM request, so this is sized
  // to stop runaway cost rather than just abuse.
  'ai-setup': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(8, '24 h'),
    prefix: 'rl:ai-setup',
  }),
  // Conversational Page Coach: enough turns for a real guided setup session while
  // keeping paid model usage bounded per creator account.
  'page-coach': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '24 h'),
    prefix: 'rl:page-coach',
  }),
  // Fan help assistant (app/api/fan/assistant): same shape as page-coach -- every turn
  // is a paid model call -- but fans outnumber creators, and a billing question is
  // usually answered in a few turns, so the per-account cap is tighter.
  'fan-assistant': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '24 h'),
    prefix: 'rl:fan-assistant',
  }),
  // Guards starting a one-time tip checkout — same shape of risk as subscribe (a paid
  // Stripe API call per attempt), so it gets the same allowance.
  tip: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    prefix: 'rl:tip',
  }),
  // Guards submitting a suggestion (see app/api/suggestions/route.js) — cheap to run,
  // but generous enough that someone genuinely typing up a handful of ideas in one
  // sitting never gets blocked; it's here purely to stop a script from flooding the
  // table, not to discourage a real person from sending more than a couple.
  suggestion: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 h'),
    prefix: 'rl:suggestion',
  }),
  // Guards submitting a content report (see app/api/reports/route.js). Tighter than
  // suggestion's allowance on purpose — a real report of adult/illegal content is rare
  // per person, so a burst here is far more likely to be someone hammering the endpoint
  // (harassment against a creator via mass-reporting, or a script) than genuine use.
  report: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 h'),
    prefix: 'rl:report',
  }),
  // Submitting a suspension appeal is unauthenticated (a suspended account can't log
  // in), so it's rate-limited by both IP and the email supplied — same generous-but-
  // bounded shape as report above, since a genuine appeal is a rare, one-time thing per
  // suspension, not something a real person retries dozens of times.
  appeal: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 h'),
    prefix: 'rl:appeal',
  }),
  // Following is free and intentionally easy, but the public count must not be writable
  // at bot speed. This still allows a real person to follow many creators in one visit.
  follow: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '10 m'),
    prefix: 'rl:follow',
  }),
  // Guards toggling a like on a post. Same shape as follow above -- free, and
  // deliberately generous since a fan scrolling a feed liking several posts in a row
  // is completely normal use -- just enough to stop a script from farming the count.
  'post-like': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '10 m'),
    prefix: 'rl:post-like',
  }),
  // Guards the Founding Creator waitlist form (see app/api/waitlist/route.js) — no
  // session to key off of, since it's meant to work for a first-time visitor, so this is
  // the only thing standing between it and a script hammering the table with rows.
  waitlist: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 h'),
    prefix: 'rl:waitlist',
  }),
  // Anonymous campaign metrics store aggregate counts only. This limit prevents a
  // single visitor or bot from materially inflating those totals.
  'campaign-metric': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '10 m'),
    prefix: 'rl:campaign-metric',
  }),
  outreach: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '10 m'),
    prefix: 'rl:outreach',
  }),
  // Guards the anonymous homepage feedback widget (see app/api/feedback/route.js) --
  // same shape of risk as waitlist: no session to key off of, so IP is the only thing
  // standing between this and a script filling the table with rows.
  feedback: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(8, '1 h'),
    prefix: 'rl:feedback',
  }),
  // Guards POST /api/creator/rss (sync a blog feed now). Each call is an outbound fetch
  // to a URL the creator controls plus up to MAX_ITEMS (see lib/rss.js) post inserts --
  // cheap individually, but with no limit a "Sync now" click loop (or a compromised
  // session) could hammer a third-party host through ByUs's own server with no friction
  // at all. Generous enough for a creator legitimately re-syncing while testing a feed.
  'rss-sync': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '10 m'),
    prefix: 'rl:rss-sync',
  }),
  // Guards POST /api/creator/broadcast -- a free-text email to every one of a creator's
  // active subscribers at once. Tighter than any other limiter here on purpose: this is
  // the one authenticated write whose abuse cost lands directly in other people's
  // inboxes (and Resend's send volume/reputation), not just this account's own data.
  broadcast: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '24 h'),
    prefix: 'rl:broadcast',
  }),
  // Guards POST /api/creator/posts (publishing a new post). Generous enough that a
  // creator posting several updates in one sitting is never blocked -- this exists to
  // stop a script from flooding a creator's own page (and, for a public/non-pending
  // post, every subscriber's new-post-notification inbox) rather than to limit normal use.
  'post-create': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '10 m'),
    prefix: 'rl:post-create',
  }),
  // Guards POST /api/creator/tiers -- each call makes 1-2 real Stripe API calls
  // (Product + one or two recurring Prices). Same cost shape as connect-stripe /
  // product-upload above; a creator setting up or adjusting tiers rarely needs more
  // than a handful of creates in an hour.
  'tier-create': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(15, '1 h'),
    prefix: 'rl:tier-create',
  }),
  // Guards POST /api/creator/discounts -- each call makes two real Stripe API calls
  // (a Coupon, then a Promotion Code). Same allowance as tier-create for the same reason.
  'discount-create': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(15, '1 h'),
    prefix: 'rl:discount-create',
  }),
  // Guards PATCH/DELETE on an existing tier (app/api/creator/tiers/[tierId]) -- a rename
  // makes a real Stripe API call (Product name sync) the same way tier-create's initial
  // Product/Price creation does. Same allowance as tier-create; this was the one gap in
  // that route's own cost class before Sep 18, 2026's infra hardening pass.
  'tier-modify': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(15, '1 h'),
    prefix: 'rl:tier-modify',
  }),
  // Guards DELETE on an existing discount code (app/api/creator/discounts/[promoId]) --
  // two real Stripe API calls per call (a lookup, then deactivating the Promotion Code),
  // same cost shape as discount-create. Same gap/fix as tier-modify above.
  'discount-modify': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(15, '1 h'),
    prefix: 'rl:discount-modify',
  }),
  // Guards POST /api/fan/feed-token (issuing or regenerating a fan's private podcast
  // feed link). Cheap on its own (one upsert), but generating a fresh token also
  // immediately invalidates whatever URL leaked -- without a limit, a script could
  // otherwise spam a fan's own feed link, silently breaking it in their podcast app
  // over and over. Generous enough for a real "I think this link leaked, reset it"
  // click, or trying it against a handful of different creators in one sitting.
  'feed-token': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    prefix: 'rl:feed-token',
  }),
  // Guards the public, unauthenticated feed route itself (app/api/feed/[token]) and
  // its media-proxy sibling -- keyed by IP rather than by token, since the whole
  // point is that no session/cookie exists here to key off of instead. Sized well
  // above any real podcast app's normal poll cadence (most check every 15-60 min)
  // so it only bites a script hammering the route, not someone's actual app.
  'feed-fetch': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '10 m'),
    prefix: 'rl:feed-fetch',
  }),
  // Guards PATCH /api/me (display name, bio, tags, notification/support-visibility
  // toggles). Cheap on its own, but reachable by any authenticated account with
  // nothing else standing between it and a script hammering profile writes.
  'me-update': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '10 m'),
    prefix: 'rl:me-update',
  }),
  // Guards PATCH/DELETE /api/creator/posts/:postId (edit or permanently remove an
  // existing post). Same allowance as post-create — a creator cleaning up or fixing
  // typos across several posts in one sitting is normal use; this exists to stop a
  // script from mass-editing or mass-deleting a creator's own catalog.
  'post-modify': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '10 m'),
    prefix: 'rl:post-modify',
  }),
  // Guards PATCH /api/creator/slug (claim/change a vanity URL). Deliberately tight —
  // legitimate use is "set it once, maybe change it later," not something anyone
  // needs to do more than a handful of times an hour, and a script probing for
  // available slugs (or griefing by repeatedly grabbing/dropping desirable ones)
  // is exactly the shape of abuse this closes off.
  'slug-change': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 h'),
    prefix: 'rl:slug-change',
  }),
  // Guards PATCH /api/creator/integrations (Discord/Telegram IDs). Same cost shape as
  // creator-links — a cheap authenticated write with no cost to automating against.
  'integrations-update': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '10 m'),
    prefix: 'rl:integrations-update',
  }),
  // Guards POST /api/me/become-creator. A one-time (per account) role upgrade that
  // runs inside a transaction with an advisory lock and a COUNT(*) over every creator
  // account (to check the Founding Creator cutoff) — cheap for a real user clicking
  // it once, but there's no reason a session should ever need to call this more than
  // a couple of times.
  'become-creator': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 h'),
    prefix: 'rl:become-creator',
  }),
  // Guards POST /api/me/avatar/preset (switching to a built-in illustrated avatar).
  // Cheap — one update plus an occasional best-effort Blob cleanup — but generous
  // enough that clicking through several preset options while deciding never trips it.
  'avatar-preset': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '10 m'),
    prefix: 'rl:avatar-preset',
  }),
  // Guards POST /api/creator/live (provision a Mux live stream + RTMP key). Only
  // applies to the actual Mux::createLiveStream() branch — cost shape matches
  // video-upload above, since each first-time call provisions a real resource on
  // Mux's side. A creator only ever needs this to succeed once; this just stops a
  // compromised or scripted session from repeatedly hammering that provisioning call.
  'live-setup': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 h'),
    prefix: 'rl:live-setup',
  }),
  // Guards DELETE /api/fan/connections/:provider (disconnect Discord/Telegram). Calls
  // out to revoke bot-managed access on that provider's side before dropping the
  // local row, so — like connect-stripe — each call has a real cost on someone else's
  // API, not just this database.
  'connection-disconnect': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(15, '1 h'),
    prefix: 'rl:connection-disconnect',
  }),
  // Guards POST /api/posts/:postId/vote. Same shape as post-like — free and
  // deliberately generous, since a fan working through several polls in one sitting
  // is completely normal use; this only stops a script from farming vote counts.
  'poll-vote': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '10 m'),
    prefix: 'rl:poll-vote',
  }),
  // Guards the read-only /api/admin/* GET routes (overview, reports list, suggestions
  // list, one dispute's evidence package). Already gated by lib/admin.js's allowlist,
  // so this isn't defending against outside abuse — it's a floor against a leaked or
  // hijacked admin session (or a buggy dashboard poll loop) hammering aggregate
  // queries over the whole platform's data.
  'admin-read': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '10 m'),
    prefix: 'rl:admin-read',
  }),
  // Guards the non-financial /api/admin/* write routes (triaging reports/suggestions/
  // site-feedback, clearing a creator's review hold, suspending/reinstating an
  // account, re-registering the Telegram webhook). Generous enough that working
  // through a queue of a few dozen items in one sitting is never blocked — this is a
  // floor against a compromised admin session, not a throttle on normal triage work.
  'admin-write': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '10 m'),
    prefix: 'rl:admin-write',
  }),
  // Guards the two admin routes that move real money (issuing a refund, recovering a
  // creator's transferred share after a lost dispute). Both already carry their own
  // idempotency guards against a double-click, but this is tighter than admin-write
  // on purpose — these are rare, deliberate actions, and a leaked admin session
  // should never be able to fire off refunds or transfer reversals at scale.
  'admin-payment-action': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    prefix: 'rl:admin-payment-action',
  }),
  // Guards POST /api/products/:productId/checkout (starting a Stripe Checkout session
  // for a one-time digital-product purchase) -- same cost shape as `tip` and
  // `subscribe`, a real Stripe API call per attempt. This was already being called by
  // that route (`checkRateLimit('product-checkout', ...)`) but had no matching entry
  // here, which meant every single purchase attempt threw `Unknown rate limiter`
  // before the route's own try/catch could run -- the exact same failure mode
  // `product-upload` above hit on Sep 17, 2026, just for checkout instead of
  // publishing. Found auditing the rate-limit gaps on Sep 18, 2026; every digital
  // product purchase was broken until this was added.
  'product-checkout': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    prefix: 'rl:product-checkout',
  }),
  // Guards POST /api/fan/connections/telegram/link (minting the short-lived link
  // token a fan uses to connect Telegram). Same allowance as feed-token -- cheap, but
  // generous enough for someone retrying a stale/expired link. Same gap as
  // product-checkout just above: the route called this limiter already, but nothing
  // here defined it, so every attempt to connect Telegram threw instead of working.
  'telegram-link': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    prefix: 'rl:telegram-link',
  }),
  // Guards POST /api/fan/phone/send-code -- each call sends a real text through a
  // paid provider (sent.dm), unlike telegram-link's free deep link, so this is
  // tighter: enough for someone retrying a typo'd number a few times, not enough for
  // it to become a way to run up someone else's SMS bill or spam an arbitrary number.
  'phone-verify-send': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 h'),
    prefix: 'rl:phone-verify-send',
  }),
  // Guards POST /api/fan/phone/verify. Looser than the send limit above -- checking a
  // code you already received is much lower-cost to allow generously -- but still
  // bounded on top of phone-verification.js's own per-code CODE_MAX_ATTEMPTS, as a
  // floor against a script hammering the endpoint across many different codes.
  'phone-verify-check': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    prefix: 'rl:phone-verify-check',
  }),
};

// Best-effort client IP. Vercel always sets x-forwarded-for in production; the
// fallbacks just keep local dev (where it's absent) from throwing.
export function getClientIp(request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

// Checks `identifier` (e.g. "ip:1.2.3.4" or "email:a@b.com") against the named
// limiter. Fails OPEN on a Redis error — a Redis outage should never be able to take
// down login/signup/checkout — but logs loudly so an outage is still visible.
export async function checkRateLimit(name, identifier) {
  const limiter = limiters[name];
  if (!limiter) throw new Error(`Unknown rate limiter: ${name}`);

  try {
    return await limiter.limit(identifier);
  } catch (err) {
    console.error(`Rate limit check for "${name}" failed (failing open):`, err);
    return { success: true, remaining: 1, reset: 0 };
  }
}

// Standard 429 response for a failed check. `result.reset` is a unix ms timestamp
// from Upstash; surfaced as a Retry-After header so well-behaved clients back off.
export function rateLimitResponse(result) {
  const headers = {};
  if (result?.reset) {
    headers['Retry-After'] = String(Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)));
  }
  return NextResponse.json(
    { error: 'Too many requests. Please wait a bit and try again.' },
    { status: 429, headers }
  );
}
