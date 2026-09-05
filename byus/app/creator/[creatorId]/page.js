'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import LivePlayer from '../../components/LivePlayer';

export default function CreatorProfilePage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-brand-ink/40">Loading…</div>}>
      <CreatorProfile />
    </Suspense>
  );
}

function CreatorProfile() {
  const { creatorId } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const justSubscribed = searchParams.get('subscribed') === 'true';
  const subscribedTierId = searchParams.get('tier');
  const justTipped = searchParams.get('tipped') === 'true';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [subscribing, setSubscribing] = useState(null);
  const [subscribeError, setSubscribeError] = useState('');
  const [billingInterval, setBillingInterval] = useState('month'); // 'month' | 'year'

  useEffect(() => {
    load();
  }, [creatorId]);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch(`/api/creators/${creatorId}`);
      if (res.ok) {
        const result = await res.json();
        setData(result);
        // Old/already-shared links use the raw UUID. Once a creator claims a short slug,
        // quietly swap the address bar over to it — the UUID link keeps working (the API
        // above still resolves it), this just steers everyone toward the short one going
        // forward without breaking anything already out there.
        if (result.creator?.slug && result.creator.slug !== creatorId) {
          router.replace(`/creator/${result.creator.slug}`);
        }
      } else if (res.status !== 404) {
        // A real failure (500, etc) is distinct from "this creator doesn't exist" below —
        // conflating the two would tell a visitor "not found" for what's actually a
        // transient server hiccup, with no way to tell they should just retry.
        setLoadError(true);
      }
    } catch {
      // fetch() itself can throw (offline, DNS failure, dropped connection) — without this
      // catch, setLoading(false) below would never run and the page would be stuck on
      // "Loading…" forever instead of showing a retry option.
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubscribe(tierId, interval) {
    setSubscribing(tierId);
    setSubscribeError('');
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tierId, interval }),
    });
    const result = await res.json();
    if (result.url) {
      window.location.href = result.url; // redirect to Stripe Checkout
      return;
    }
    if (res.status === 401) {
      // Not logged in — send them to log in and land right back here afterward, rather
      // than losing their place and having to search for this creator again.
      router.push(`/login?next=${encodeURIComponent(`/creator/${creatorId}`)}`);
      return;
    }
    setSubscribeError(result.error || 'Could not start checkout. Try again.');
    setSubscribing(null);
  }

  if (loading) return <div className="p-12 text-center text-brand-ink/40">Loading…</div>;
  if (loadError) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
        <p className="text-brand-ink/60">Couldn't load this page. Check your connection and try again.</p>
        <button
          onClick={load}
          className="mt-4 rounded-full bg-[#146359] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#0f4d45]"
        >
          Try again
        </button>
      </div>
    );
  }
  if (!data) return <div className="p-12 text-center text-brand-ink/40">Creator not found.</div>;

  const { creator, tiers, posts, hasActiveSubscription, live, topSupporters, goal } = data;
  const subscribedTier = subscribedTierId ? tiers.find((t) => t.id === subscribedTierId) : null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      {justSubscribed && (
        <p className="mb-6 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
          🎉 You're in! Welcome to {creator.display_name}'s page — subscriber-only posts below are unlocked.
          {subscribedTier?.welcome_message && (
            <span className="mt-2 block text-green-800">{subscribedTier.welcome_message}</span>
          )}
        </p>
      )}
      {justTipped && (
        <p className="mb-6 rounded-xl bg-[#C9A961]/15 px-4 py-3 text-sm text-[#8a6b2f]">
          ☕ Thanks for the coffee! {creator.display_name} really appreciates the support.
        </p>
      )}
      <div className="flex items-center gap-4">
        {creator.profile_image_url ? (
          <Image
            src={creator.profile_image_url}
            alt={`${creator.display_name}'s profile photo`}
            width={64}
            height={64}
            className="h-16 w-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#146359]/10 text-2xl font-semibold text-[#146359]">
            {(creator.display_name || '?').trim().charAt(0).toUpperCase()}
          </div>
        )}
        <h1 className="text-2xl font-bold">{creator.display_name}</h1>
      </div>
      {creator.bio && <p className="mt-2 text-brand-ink/60">{creator.bio}</p>}

      {creator.social_links?.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {creator.social_links.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-[#146359]/20 px-3 py-1.5 text-sm font-medium text-[#146359] hover:bg-[#146359]/5"
            >
              {link.label} ↗
            </a>
          ))}
        </div>
      )}

      {goal && <SupportGoalBar goal={goal} />}

      {creator.stripe_connect_onboarded && (
        <TipWidget creatorId={creator.id} creatorName={creator.display_name} />
      )}

      <TopSupporters supporters={topSupporters} hasTiers={tiers.length > 0} />

      {/* Live stream — sits above tiers/feed since "live right now" is the single most
          time-sensitive thing on this page when it's true. */}
      {live?.isLive && (
        <div className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 motion-safe:animate-pulse" aria-hidden="true" />
              LIVE
            </span>
            <span className="text-sm text-brand-ink/50">{creator.display_name} is streaming now</span>
          </div>
          {live.playbackId && live.playbackToken ? (
            <LivePlayer playbackId={live.playbackId} playbackToken={live.playbackToken} />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-2xl bg-brand-ink/5 px-6 text-center">
              <p className="text-sm text-brand-ink/50">
                {hasActiveSubscription
                  ? "Setting up the stream — refresh in a moment."
                  : tiers.length > 0
                  ? (
                    <>
                      Subscribe to watch —{' '}
                      <a href="#tiers" className="text-[#146359] underline">see tiers below</a>.
                    </>
                  )
                  : 'Subscribe to watch this live stream.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tiers */}
      <div id="tiers" className="scroll-mt-6">
        {!hasActiveSubscription && tiers.length > 0 && (
          <div className="mt-8">
            {tiers.some((t) => t.annual_price_cents) && (
              <div className="mb-4 flex items-center justify-center gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => setBillingInterval('month')}
                  className={billingInterval === 'month' ? 'font-semibold text-[#146359]' : 'text-brand-ink/40'}
                >
                  Monthly
                </button>
                <span className="text-brand-ink/20">/</span>
                <button
                  type="button"
                  onClick={() => setBillingInterval('year')}
                  className={billingInterval === 'year' ? 'font-semibold text-[#146359]' : 'text-brand-ink/40'}
                >
                  Annually
                </button>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {tiers.map((t) => {
                const hasAnnual = Number.isInteger(t.annual_price_cents) && t.annual_price_cents > 0;
                const useAnnual = billingInterval === 'year' && hasAnnual;
                const displayCents = useAnnual ? t.annual_price_cents : t.price_cents;
                const savingsCents = hasAnnual ? t.price_cents * 12 - t.annual_price_cents : 0;
                return (
                  <div key={t.id} className="rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
                    <h3 className="font-semibold">{t.name}</h3>
                    {t.description && <p className="mt-1 text-sm text-brand-ink/50">{t.description}</p>}
                    <p className="mt-3 text-lg font-bold text-[#146359]">
                      ${(displayCents / 100).toFixed(2)}
                      <span className="text-sm font-normal text-brand-ink/40">{useAnnual ? '/yr' : '/mo'}</span>
                    </p>
                    {useAnnual && savingsCents > 0 && (
                      <p className="mt-1 text-xs text-[#146359]">
                        Save ${(savingsCents / 100).toFixed(2)}/yr vs. paying monthly
                      </p>
                    )}
                    <button
                      onClick={() => handleSubscribe(t.id, useAnnual ? 'year' : 'month')}
                      disabled={subscribing === t.id}
                      className="mt-4 w-full rounded-full bg-[#146359] py-2 text-sm font-semibold text-white hover:bg-[#0f4d45] disabled:opacity-50"
                    >
                      {subscribing === t.id ? 'Redirecting…' : 'Subscribe'}
                    </button>
                    {/* Sits right under the button that actually leads to a payment form — the
                        one place on this page where a trust signal matters most. */}
                    <p className="mt-2 text-center text-[11px] text-brand-ink/40">
                      🔒 Secured by Stripe — ByUs never sees your card
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {!hasActiveSubscription && tiers.length === 0 && (
          <p className="mt-8 rounded-xl bg-brand-ink/5 px-4 py-3 text-sm text-brand-ink/50">
            {creator.display_name} hasn't published any subscription tiers yet — check back soon.
          </p>
        )}
        {subscribeError && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{subscribeError}</p>
        )}
      </div>
      {hasActiveSubscription && (
        <p className="mt-6 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
          ✓ You're subscribed to this creator.
        </p>
      )}

      {/* Feed */}
      <h2 className="mt-12 font-semibold">Posts</h2>
      <ul className="mt-4 space-y-4">
        {posts.map((p) => (
          <li key={p.id} className="rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <h3 className="truncate font-medium">{p.title || '(untitled)'}</h3>
                <StatusBadge locked={p.locked} />
              </div>
              <span className="shrink-0 text-xs text-brand-ink/40">{new Date(p.created_at).toLocaleDateString()}</span>
            </div>
            {p.locked ? (
              <LockedPostPreview hasTiers={tiers.length > 0} />
            ) : (
              <>
                {p.media_url && (
                  // Post photos have no stored width/height (uploads of arbitrary size), and
                  // this route (`/api/posts/:id/media`) checks the *viewer's own* session to
                  // decide whether they're allowed to see it, then serves it as private/no-cache.
                  // Next's built-in image optimizer runs its own server-side fetch that carries
                  // no cookies and caches by URL alone — wrong on both counts for a gated,
                  // per-viewer image — so this stays unoptimized: the browser fetches it exactly
                  // as before, and next/image just adds the reserved box (no layout jump) and
                  // native lazy-loading on top.
                  <div className="relative mt-3 aspect-[16/10] w-full overflow-hidden rounded-xl">
                    <Image
                      src={p.media_url}
                      alt={p.title ? `Photo for "${p.title}"` : 'Post photo'}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                )}
                <p className="mt-2 text-sm text-brand-ink/70">{p.body}</p>
                {p.poll && <PollBlock postId={p.id} poll={p.poll} />}
              </>
            )}
          </li>
        ))}
        {posts.length === 0 && <p className="text-sm text-brand-ink/40">No posts yet.</p>}
      </ul>
    </div>
  );
}

// Top supporters: the longest-tenured active subscribers who've chosen to be shown here
// (show_support_publicly, off by default -- see Settings). Ranked by how long they've
// supported this creator, not by how much they've paid -- a founding-member feel rather
// than a spending leaderboard. When nobody has opted in yet -- whether because there are
// no subscribers at all, or there are but none have turned this on -- this shows an open
// invite slot instead of just disappearing, so a brand-new creator's page still has
// somewhere for their first supporter to show up. The invite copy deliberately doesn't
// claim "no one has subscribed yet" (that could be false); it only ever claims the slot
// itself is open.
function TopSupporters({ supporters, hasTiers }) {
  const hasSupporters = supporters && supporters.length > 0;

  return (
    <div className="mt-8 flex items-center gap-4 rounded-2xl border border-brand-ink/5 bg-brand-paper p-4">
      <div className="flex -space-x-3">
        {hasSupporters ? (
          supporters.map((s) => (
            <div key={s.id} title={`${s.displayName || 'A supporter'} — since ${formatMonthYear(s.since)}`}>
              {s.profileImageUrl ? (
                <Image
                  src={s.profileImageUrl}
                  alt={`${s.displayName || 'A supporter'}'s profile photo`}
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full border-2 border-white object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-[#146359]/10 text-sm font-semibold text-[#146359]">
                  {(s.displayName || '?').trim().charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          ))
        ) : (
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-brand-ink/20 text-brand-ink/30"
            aria-hidden="true"
          >
            +
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#2B2420]">Top supporters</p>
        <p className="text-xs text-brand-ink/50">
          {hasSupporters
            ? `${supporters.length} supporter${supporters.length === 1 ? '' : 's'} shown here by their own choice.`
            : hasTiers ? (
              <>
                This spot is open —{' '}
                <a href="#tiers" className="text-[#146359] underline">
                  be the first supporter shown here
                </a>
                .
              </>
            ) : (
              'This spot is open for this creator’s first supporter.'
            )}
        </p>
      </div>
    </div>
  );
}

// A single monthly earnings goal, opt-in (set in the creator's dashboard, see
// GoalSection in app/creator/dashboard/page.js) — resets every calendar month, same
// window as the fee-tier threshold, and counts both subscriptions and tips.
function SupportGoalBar({ goal }) {
  const pct = Math.min(100, (goal.progressCents / goal.goalCents) * 100);
  return (
    <div className="mt-6 rounded-2xl border border-brand-ink/5 bg-brand-paper p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-[#2B2420]">This month's goal</p>
        <p className="text-xs text-brand-ink/50">
          ${(goal.progressCents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })} of $
          {(goal.goalCents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </p>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-brand-ink/10">
        <div className="h-full rounded-full bg-[#146359] transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// One-time "buy a coffee" payment — no tier, no commitment, just a thank-you. Presets
// cover the common cases; the custom field takes anything from $1 up to MAX_TIP_CENTS
// (enforced server-side in /api/creators/:creatorId/tip).
const TIP_PRESETS_CENTS = [300, 500, 1000];

function TipWidget({ creatorId, creatorName }) {
  const router = useRouter();
  const [custom, setCustom] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function sendTip(cents) {
    setError('');
    setSending(true);
    try {
      const res = await fetch(`/api/creators/${creatorId}/tip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents: cents }),
      });
      const result = await res.json();
      if (result.url) {
        window.location.href = result.url; // redirect to Stripe Checkout
        return;
      }
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      setError(result.error || 'Could not start checkout. Try again.');
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSending(false);
    }
  }

  function handleCustomSubmit(e) {
    e.preventDefault();
    const cents = Math.round(parseFloat(custom) * 100);
    if (!Number.isFinite(cents) || cents < 100) {
      setError('Enter at least $1.00.');
      return;
    }
    sendTip(cents);
  }

  return (
    <div className="mt-6 rounded-2xl border border-[#C9A961]/25 bg-[#C9A961]/5 p-4">
      <p className="text-sm font-semibold text-[#2B2420]">☕ Buy {creatorName} a coffee</p>
      <p className="mt-1 text-xs text-brand-ink/50">A one-time thank-you — no subscription, no commitment.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {TIP_PRESETS_CENTS.map((cents) => (
          <button
            key={cents}
            type="button"
            onClick={() => sendTip(cents)}
            disabled={sending}
            className="rounded-full bg-[#C9A961] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#b3945a] disabled:opacity-50"
          >
            ${(cents / 100).toFixed(0)}
          </button>
        ))}
        <form onSubmit={handleCustomSubmit} className="flex items-center gap-1.5">
          <span className="text-sm text-brand-ink/40">$</span>
          <input
            type="number"
            min="1"
            step="1"
            placeholder="Other"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className="w-16 rounded-lg border border-brand-ink/10 px-2 py-1 text-sm"
          />
          <button
            type="submit"
            disabled={sending}
            className="text-sm font-semibold text-[#8a6b2f] hover:underline disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </form>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function formatMonthYear(dateString) {
  if (!dateString) return 'recently';
  return new Date(dateString).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

// Votes before results: anyone who hasn't voted yet sees plain option buttons; once
// they have (myVote is set, either from the initial load or right after they click),
// it switches to a read-only percentage-bar view with their own choice highlighted.
// Keeps its own local copy of the poll so a vote updates instantly without reloading
// the whole feed.
function PollBlock({ postId, poll: initialPoll }) {
  const router = useRouter();
  const [poll, setPoll] = useState(initialPoll);
  const [voting, setVoting] = useState(null);
  const [error, setError] = useState('');

  async function handleVote(optionIndex) {
    setError('');
    setVoting(optionIndex);
    try {
      const res = await fetch(`/api/posts/${postId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionIndex }),
      });
      if (res.status === 401) {
        // Not logged in — same pattern as subscribing: send them to log in and land
        // right back on this page instead of just failing silently.
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not record your vote.');
        return;
      }
      setPoll(data.poll);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setVoting(null);
    }
  }

  const total = poll.votes.reduce((sum, v) => sum + v, 0);
  const hasVoted = poll.myVote !== null && poll.myVote !== undefined;

  if (!hasVoted) {
    return (
      <div className="mt-3 space-y-2">
        {poll.options.map((option, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleVote(i)}
            disabled={voting !== null}
            className="block w-full rounded-lg border border-[#146359]/25 px-3 py-2 text-left text-sm font-medium text-[#146359] hover:bg-[#146359]/5 disabled:opacity-50"
          >
            {voting === i ? 'Voting…' : option}
          </button>
        ))}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-1.5">
      {poll.options.map((option, i) => {
        const count = poll.votes[i] || 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const mine = poll.myVote === i;
        return (
          <button
            key={i}
            type="button"
            onClick={() => handleVote(i)}
            disabled={voting !== null}
            className="block w-full text-left text-sm disabled:opacity-50"
          >
            <div className={`flex justify-between ${mine ? 'font-semibold text-[#146359]' : 'text-brand-ink/60'}`}>
              <span>
                {option}
                {mine && ' ✓'}
              </span>
              <span className="text-brand-ink/40">{pct}%</span>
            </div>
            <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-brand-ink/5">
              <div
                className={`h-full rounded-full ${mine ? 'bg-[#146359]' : 'bg-[#146359]/40'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </button>
        );
      })}
      <p className="text-xs text-brand-ink/30">{total} vote{total === 1 ? '' : 's'} — tap an option to change your vote</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// A locked post already shows its title and date in the header above (the API sends
// those for every post — see app/api/creators/[creatorId]/route.js) -- this just gives
// the body area some visual weight instead of collapsing to a single line of text. The
// blur/texture below is decorative only, never a blurred version of the real body or
// photo: the API never sends locked posts' body/media_url to a non-subscriber, so there's
// nothing real here to show a preview of.
function LockedPostPreview({ hasTiers }) {
  return (
    <div className="relative mt-3 overflow-hidden rounded-xl">
      <div
        className="pointer-events-none h-28 w-full bg-gradient-to-br from-[#146359]/10 via-brand-ink/5 to-[#C9A961]/10 blur-[2px]"
        aria-hidden="true"
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-white/40 text-center backdrop-blur-sm">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-paper text-sm shadow-sm"
          aria-hidden="true"
        >
          🔒
        </span>
        <p className="text-xs font-medium text-brand-ink/60">
          {hasTiers ? (
            <a href="#tiers" className="text-[#146359] underline">
              Subscribe to view this post
            </a>
          ) : (
            'Subscribers only'
          )}
        </p>
      </div>
    </div>
  );
}

// A color-coded pill instead of a text explanation, so a scanning eye catches a post's
// access level without reading a sentence: a pulsing green dot for anyone-can-read, a
// muted lock for subscriber-only. Locked stays neutral gray rather than a warning color
// — being subscriber-only isn't a problem to flag, just a state to show.
function StatusBadge({ locked }) {
  if (locked) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-ink/5 px-2 py-0.5 text-[11px] font-medium text-brand-ink/50">
        🔒 Subscribers only
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500 motion-safe:animate-pulse" aria-hidden="true" />
      Public
    </span>
  );
}
