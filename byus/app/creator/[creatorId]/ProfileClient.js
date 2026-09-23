'use client';

// All the interactive profile UI — subscribing, tipping, voting on polls, reporting,
// the posts search/filter. The initial creator/tiers/posts/etc. data, and the
// subscribed/tipped query flags, come in as props from the server-rendered
// app/creator/[creatorId]/page.js — no client fetch for the initial load anymore
// (that used to gate this entire page behind a blank "Loading…" screen), and no more
// useSearchParams/useParams since the server component already has params and
// searchParams natively. The canonical-slug redirect also moved server-side (see
// page.js) — it now happens before anything renders instead of via router.replace
// after the fact.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import LivePlayer from '../../components/LivePlayer';
import PostVideoPlayer from '../../components/PostVideoPlayer';
import DigitalProductShop from '../../components/DigitalProductShop';

export default function ProfileClient({ data, justSubscribed, subscribedTierId, justTipped, creatorId }) {
  const router = useRouter();
  const [subscribing, setSubscribing] = useState(null);
  const [subscribeError, setSubscribeError] = useState('');
  const [following, setFollowing] = useState(Boolean(data.isFollowing));
  const [followerCount, setFollowerCount] = useState(Number(data.followerCount || 0));
  const [followBusy, setFollowBusy] = useState(false);
  const [followError, setFollowError] = useState('');
  const [billingInterval, setBillingInterval] = useState('month'); // 'month' | 'year'
  // Ko-fi's "Posts" tab is really just this feed with a type filter, an access filter,
  // and a search box layered on top — see PostFilters below. All three are client-side
  // over the posts this response already included, so there's no extra request per
  // filter change, and search only ever matches what's already visible to this viewer
  // (a locked post's body/media_url are never sent to a non-subscriber in the first
  // place, so there's nothing private to leak through the search box).
  const [postTypeFilter, setPostTypeFilter] = useState('all'); // 'all' | 'text' | 'image' | 'poll'
  const [postAccessFilter, setPostAccessFilter] = useState('all'); // 'all' | 'public' | 'locked'
  const [postSearch, setPostSearch] = useState('');

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

  async function handleFollow() {
    setFollowBusy(true);
    setFollowError('');
    const res = await fetch('/api/follows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creatorId: data.creator.id, following: !following }),
    });
    const result = await res.json();
    if (res.status === 401) {
      router.push(`/login?next=${encodeURIComponent(`/creator/${creatorId}`)}`);
      return;
    }
    if (!res.ok) {
      setFollowError(result.error || 'Could not update your follow. Try again.');
      setFollowBusy(false);
      return;
    }
    setFollowing(result.following);
    setFollowerCount(result.followerCount);
    setFollowBusy(false);
  }

  const { creator, tiers, posts, hasActiveSubscription, live, topSupporters, goal } = data;
  const subscribedTier = subscribedTierId ? tiers.find((t) => t.id === subscribedTierId) : null;
  const filteredPosts = posts.filter((p) => {
    if (postTypeFilter !== 'all' && getPostType(p) !== postTypeFilter) return false;
    if (postAccessFilter === 'public' && p.locked) return false;
    if (postAccessFilter === 'locked' && !p.locked) return false;
    if (postSearch.trim()) {
      const q = postSearch.trim().toLowerCase();
      const haystack = `${p.title || ''} ${p.body || ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

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
        <p className="mb-6 rounded-xl bg-[#0F766E]/15 px-4 py-3 text-sm text-[#0F766E]">
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
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#0F766E]/10 text-2xl font-semibold text-[#0F766E]">
            {(creator.display_name || '?').trim().charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold">{creator.display_name}</h1>
          {creator.is_founding && (
            // Foil "founding number" tag -- names this creator's actual claim order
            // (getFoundingCreatorRank, lib/fees.js) rather than a generic "Founding"
            // label, since the low number itself is the status symbol. Gradient is a
            // literal 4-stop diagonal (same inline-style pattern the Hero section
            // already uses for its glows) -- Tailwind's gradient utilities only cover
            // 2-3 stops, not enough for the foil-sheen look.
            <span
              className="mt-1 inline-flex items-center gap-2 rounded-lg border border-[#9C7C3E]/50 px-2.5 py-1 shadow-[0_3px_8px_-3px_rgba(156,124,62,0.55)]"
              style={{ background: 'linear-gradient(100deg, #f4e6c1, #C9A961 35%, #b6903f 65%, #E4CE95)' }}
              aria-label={`Founding creator, spot ${creator.founding_creator_rank} of ${creator.founding_creator_limit}`}
            >
              <span aria-hidden="true" className="font-display text-[15px] font-extrabold tabular-nums text-[#4a3708]">
                {String(creator.founding_creator_rank).padStart(2, '0')}
              </span>
              <span aria-hidden="true" className="h-3.5 w-px bg-[#4a3708]/35" />
              <span aria-hidden="true" className="leading-tight">
                <span className="block font-display text-[11.5px] font-bold text-[#4a3708]">
                  Founding Creator
                </span>
                <span className="block text-[8.5px] font-bold uppercase tracking-wider text-[#4a3708]/65">
                  of {creator.founding_creator_limit}
                </span>
              </span>
            </span>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {!data.isOwnPage && (
              <button
                type="button"
                onClick={handleFollow}
                disabled={followBusy}
                className={following
                  ? 'rounded-full border border-[#0F766E]/30 px-3 py-1.5 text-xs font-semibold text-[#0F766E] hover:bg-[#0F766E]/5 disabled:opacity-50'
                  : 'rounded-full bg-[#0F766E] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#115E59] disabled:opacity-50'}
              >
                {followBusy ? 'Saving…' : following ? 'Following' : 'Follow for free'}
              </button>
            )}
            <span className="text-xs text-brand-ink/55">
              {followerCount.toLocaleString()} {followerCount === 1 ? 'follower' : 'followers'}
            </span>
            <ReportButton creatorId={creator.id} />
          </div>
          {followError && <p className="mt-2 text-xs text-red-700">{followError}</p>}
        </div>
      </div>
      {creator.bio && <p className="mt-2 text-brand-ink/70">{creator.bio}</p>}

      {creator.social_links?.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {creator.social_links.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-[#0F766E]/20 px-3 py-1.5 text-sm font-medium text-[#0F766E] hover:bg-[#0F766E]/5"
            >
              {link.label} ↗
            </a>
          ))}
        </div>
      )}

      {goal && <SupportGoalBar goal={goal} />}

      <TopSupporters supporters={topSupporters} hasTiers={tiers.length > 0} />

      <DigitalProductShop creatorId={creator.slug || creator.id} />

      {/* Live stream — sits above tiers/feed since "live right now" is the single most
          time-sensitive thing on this page when it's true. */}
      {live?.isLive && (
        <div className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 motion-safe:animate-pulse" aria-hidden="true" />
              LIVE
            </span>
            <span className="text-sm text-brand-ink/65">{creator.display_name} is streaming now</span>
          </div>
          {live.playbackId && live.playbackToken ? (
            <LivePlayer playbackId={live.playbackId} playbackToken={live.playbackToken} />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-2xl bg-brand-ink/5 px-6 text-center">
              <p className="text-sm text-brand-ink/65">
                {hasActiveSubscription
                  ? "Setting up the stream — refresh in a moment."
                  : tiers.length > 0
                  ? (
                    <>
                      Subscribe to watch —{' '}
                      <a href="#tiers" className="text-[#0F766E] underline">see tiers below</a>.
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
                  className={billingInterval === 'month' ? 'font-semibold text-[#0F766E]' : 'text-brand-ink/60'}
                >
                  Monthly
                </button>
                <span className="text-brand-ink/40">/</span>
                <button
                  type="button"
                  onClick={() => setBillingInterval('year')}
                  className={billingInterval === 'year' ? 'font-semibold text-[#0F766E]' : 'text-brand-ink/60'}
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
                    {t.description && <p className="mt-1 text-sm text-brand-ink/65">{t.description}</p>}
                    {Number.isInteger(t.trial_days) && t.trial_days > 0 && (
                      <p className="mt-1 inline-block rounded-full bg-[#0F766E]/10 px-2 py-0.5 text-xs font-semibold text-[#0F766E]">
                        {t.trial_days}-day free trial
                      </p>
                    )}
                    <p className="mt-3 text-lg font-bold text-[#0F766E]">
                      ${(displayCents / 100).toFixed(2)}
                      <span className="text-sm font-normal text-brand-ink/60">{useAnnual ? '/yr' : '/mo'}</span>
                    </p>
                    {useAnnual && savingsCents > 0 && (
                      <p className="mt-1 text-xs text-[#0F766E]">
                        Save ${(savingsCents / 100).toFixed(2)}/yr vs. paying monthly
                      </p>
                    )}
                    <button
                      onClick={() => handleSubscribe(t.id, useAnnual ? 'year' : 'month')}
                      disabled={subscribing === t.id}
                      className="mt-4 w-full rounded-full bg-[#0F766E] py-2 text-sm font-semibold text-white hover:bg-[#115E59] disabled:opacity-50"
                    >
                      {subscribing === t.id ? 'Redirecting…' : 'Subscribe'}
                    </button>
                    {/* Sits right under the button that actually leads to a payment form — the
                        one place on this page where a trust signal matters most. */}
                    <p className="mt-2 text-center text-[11px] text-brand-ink/60">
                      🔒 Secured by Stripe — ByUs never sees your card
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {!hasActiveSubscription && tiers.length === 0 && (
          <p className="mt-8 rounded-xl bg-brand-ink/5 px-4 py-3 text-sm text-brand-ink/65">
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
      {/* Filters only earn their keep once there's actually something to sift through —
          a brand-new creator with one or two posts doesn't need a search box. */}
      {posts.length > 3 && (
        <PostFilters
          typeFilter={postTypeFilter}
          onTypeFilter={setPostTypeFilter}
          accessFilter={postAccessFilter}
          onAccessFilter={setPostAccessFilter}
          search={postSearch}
          onSearch={setPostSearch}
        />
      )}
      <ul className="mt-4 space-y-4">
        {filteredPosts.map((p) => (
          <li key={p.id} className="rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <h3 className="truncate font-medium">{p.title || '(untitled)'}</h3>
                <StatusBadge locked={p.locked} />
              </div>
              <span className="shrink-0 text-xs text-brand-ink/60">{new Date(p.created_at).toLocaleDateString()}</span>
            </div>
            {p.locked ? (
              <LockedPostPreview hasTiers={tiers.length > 0} isVideo={p.hasVideo} />
            ) : (
              <>
                {p.video && (
                  <div className="mt-3">
                    <PostVideoPlayer playbackId={p.video.playbackId} playbackToken={p.video.playbackToken} />
                  </div>
                )}
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
                <p className="mt-2 text-sm text-brand-ink/80">{p.body}</p>
                {p.poll && <PollBlock postId={p.id} poll={p.poll} />}
              </>
            )}
            <div className="mt-3 flex items-center gap-4">
              <LikeButton
                postId={p.id}
                initialLikeCount={p.likeCount}
                initialLikedByMe={p.likedByMe}
                creatorId={creatorId}
                router={router}
              />
              {creator.stripe_connect_onboarded && !data.isOwnPage && (
                <TipButton
                  creatorId={creator.id}
                  postId={p.id}
                  creatorName={creator.display_name}
                  router={router}
                />
              )}
              <ReportButton creatorId={creator.id} postId={p.id} />
            </div>
          </li>
        ))}
        {posts.length === 0 && <p className="text-sm text-brand-ink/60">No posts yet.</p>}
        {posts.length > 0 && filteredPosts.length === 0 && (
          <p className="text-sm text-brand-ink/60">No posts match your filters.</p>
        )}
      </ul>
    </div>
  );
}

// A lightweight heart/like on a post — mirrors the follow button's 401-handling
// pattern (attempt the action, and only send a logged-out visitor to log in once the
// server actually says so) rather than gating the button on a session prop this
// client component doesn't otherwise receive. Count and state come from the server
// on every toggle, not just optimistic local math, so a second tab or a page refresh
// can never drift from what actually got recorded.
function LikeButton({ postId, initialLikeCount, initialLikedByMe, creatorId, router }) {
  const [likeCount, setLikeCount] = useState(Number(initialLikeCount || 0));
  const [likedByMe, setLikedByMe] = useState(Boolean(initialLikedByMe));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/posts/${postId}/like`, { method: 'POST' });
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/creator/${creatorId}`)}`);
        return;
      }
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Could not update your like.');
      setLikeCount(result.likeCount);
      setLikedByMe(result.likedByMe);
    } catch (err) {
      setError(err.message || 'Could not update your like.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-pressed={likedByMe}
        className={`flex items-center gap-1 text-xs font-medium transition-colors disabled:opacity-50 ${
          likedByMe ? 'text-[#A6432E]' : 'text-brand-ink/40 hover:text-brand-ink/70'
        }`}
      >
        <span aria-hidden="true">{likedByMe ? '♥' : '♡'}</span>
        {likeCount > 0 ? likeCount : 'Like'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// The enforcement side of the content guidelines in app/terms/page.js (Section 5) — a
// policy banning adult content is only as real as the mechanism for someone to flag it.
// Collapsed to a small text link by default so it doesn't compete visually with the
// actual page; expands into a short inline form on click rather than a modal, since a
// report is a rare, low-stakes-for-the-UI action that doesn't need to interrupt the rest
// of the page. See app/api/reports/route.js for where this posts to, and
// app/admin/page.js's ReportsSection for where the ByUs team reviews these.
const REPORT_REASONS = [
  { value: 'adult_content', label: 'Adult / sexual content' },
  { value: 'illegal_content', label: 'Illegal content' },
  { value: 'harassment', label: 'Harassment or endangerment' },
  { value: 'ip_infringement', label: 'Copyright / IP infringement' },
  { value: 'hate_violence', label: 'Hate speech or violent extremism' },
  { value: 'other', label: 'Something else' },
];

function ReportButton({ creatorId, postId }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!reason) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId, postId, reason, details }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not send your report.');
      setSent(true);
    } catch (err) {
      setError(err.message || 'Could not send your report.');
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return <p className="text-xs text-green-700">✓ Reported — the ByUs team will take a look.</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-brand-ink/40 hover:text-brand-ink/70 hover:underline"
      >
        ⚑ Report{postId ? ' this post' : ''}
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-1 max-w-xs rounded-xl border border-brand-ink/10 bg-brand-paper p-3 text-left shadow-sm"
    >
      <p className="text-xs font-semibold text-[#172033]">Report {postId ? 'this post' : 'this creator'}</p>
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        required
        className="mt-2 w-full rounded-lg border border-brand-ink/15 px-2.5 py-1.5 text-xs"
      >
        <option value="" disabled>Choose a reason…</option>
        {REPORT_REASONS.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Optional details"
        rows={2}
        className="mt-2 w-full rounded-lg border border-brand-ink/15 px-2.5 py-1.5 text-xs"
      />
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting || !reason}
          className="rounded-full bg-[#0F766E] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#115E59] disabled:opacity-50"
        >
          {submitting ? 'Sending…' : 'Send report'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-brand-ink/50 hover:text-brand-ink/70"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// A post's "type" isn't a stored column — it's derived the same way the feed already
// renders each post: a poll block if it has one, a photo if it has media, plain text
// otherwise. Keeping it derived means this can never drift out of sync with what a
// visitor actually sees.
function getPostType(post) {
  if (post.poll) return 'poll';
  // hasVideo (not video) on purpose — a locked subscribers-only video post is still a
  // "video" for filtering, even though its actual player/token only exists once the
  // viewer is authorized to see it.
  if (post.hasVideo) return 'video';
  if (post.media_url) return 'image';
  return 'text';
}

const POST_TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'text', label: '📝 Updates' },
  { value: 'image', label: '🖼️ Photos' },
  { value: 'video', label: '🎥 Videos' },
  { value: 'poll', label: '📊 Polls' },
];

const POST_ACCESS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'public', label: '🌐 Public' },
  { value: 'locked', label: '🔒 Members-only' },
];

function PostFilters({ typeFilter, onTypeFilter, accessFilter, onAccessFilter, search, onSearch }) {
  return (
    <div className="mt-4 space-y-3">
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-ink/50" aria-hidden="true">
          🔍
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search posts"
          aria-label="Search posts"
          className="w-full rounded-full border border-brand-ink/10 bg-brand-paper py-2 pl-9 pr-4 text-sm placeholder:text-brand-ink/50 focus:border-[#0F766E]/40 focus:outline-none"
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {POST_TYPE_FILTERS.map((f) => (
          <FilterChip key={f.value} active={typeFilter === f.value} onClick={() => onTypeFilter(f.value)}>
            {f.label}
          </FilterChip>
        ))}
        <span className="mx-1 hidden h-4 w-px bg-brand-ink/10 sm:inline-block" aria-hidden="true" />
        {POST_ACCESS_FILTERS.map((f) => (
          <FilterChip key={f.value} active={accessFilter === f.value} onClick={() => onAccessFilter(f.value)}>
            {f.label}
          </FilterChip>
        ))}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'border-[#0F766E] bg-[#0F766E] text-white'
          : 'border-brand-ink/10 text-brand-ink/65 hover:bg-brand-ink/5'
      }`}
    >
      {children}
    </button>
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
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-[#0F766E]/10 text-sm font-semibold text-[#0F766E]">
                  {(s.displayName || '?').trim().charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          ))
        ) : (
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-brand-ink/20 text-brand-ink/50"
            aria-hidden="true"
          >
            +
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#172033]">Top supporters</p>
        <p className="text-xs text-brand-ink/65">
          {hasSupporters
            ? `${supporters.length} supporter${supporters.length === 1 ? '' : 's'} shown here by their own choice.`
            : hasTiers ? (
              <>
                This spot is open —{' '}
                <a href="#tiers" className="text-[#0F766E] underline">
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
        <p className="text-sm font-semibold text-[#172033]">This month's goal</p>
        <p className="text-xs text-brand-ink/65">
          ${(goal.progressCents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })} of $
          {(goal.goalCents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </p>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-brand-ink/10">
        <div className="h-full rounded-full bg-[#0F766E] transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// One-time "buy a coffee" payment — no tier, no commitment, just a thank-you. Presets
// cover the common cases; the custom field takes anything from $5 up to MAX_TIP_CENTS
// (enforced server-side in /api/creators/:creatorId/tip).
//
// Tipping used to be creator-level and content-free (a bare "buy me a coffee" widget
// on the profile, plus a standalone /creator/[creatorId]/tip page — see that route's
// own comment). Stripe's compliance review flagged that a tip with nothing described
// on the other side of it reads as an undescribed payment, not a purchase of goods or
// services. So a tip is now always attached to a specific post — this button lives in
// each post's action row instead of once at the top of the profile, and the checkout
// line item and Stripe metadata both carry that post's id and title (see
// app/api/creators/[creatorId]/tip/route.js). Collapsed by default like ReportButton
// right next to it, since most visitors reading a post aren't about to tip it.
const TIP_PRESETS_CENTS = [500, 1000, 2000];

function TipButton({ creatorId, postId, creatorName, router }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const [message, setMessage] = useState('');
  const [showMessage, setShowMessage] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function sendTip(cents) {
    setError('');
    setSending(true);
    try {
      const res = await fetch(`/api/creators/${creatorId}/tip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents: cents, message, postId, returnTo: `/creator/${creatorId}` }),
      });
      const result = await res.json();
      if (result.url) {
        window.location.href = result.url; // redirect to Stripe Checkout
        return;
      }
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/creator/${creatorId}`)}`);
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
    if (!Number.isFinite(cents) || cents < 500) {
      setError('Enter at least $5.00.');
      return;
    }
    sendTip(cents);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-brand-ink/40 hover:text-brand-ink/70 hover:underline"
      >
        ☕ Tip this post
      </button>
    );
  }

  return (
    <div className="mt-1 max-w-xs rounded-xl border border-[#0F766E]/25 bg-[#0F766E]/5 p-3 text-left shadow-sm">
      <p className="text-xs font-semibold text-[#172033]">☕ Tip {creatorName} for this post</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {TIP_PRESETS_CENTS.map((cents) => (
          <button
            key={cents}
            type="button"
            onClick={() => sendTip(cents)}
            disabled={sending}
            className="rounded-full bg-[#0F766E] px-3 py-1 text-xs font-semibold text-white hover:bg-[#115E59] disabled:opacity-50"
          >
            ${(cents / 100).toFixed(0)}
          </button>
        ))}
      </div>
      <form onSubmit={handleCustomSubmit} className="mt-2 flex items-center gap-1.5">
        <span className="text-xs text-brand-ink/60">$</span>
        <input
          type="number"
          min="5"
          step="1"
          placeholder="Other"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          className="w-16 rounded-lg border border-brand-ink/10 px-2 py-1 text-xs"
        />
        <button
          type="submit"
          disabled={sending}
          className="text-xs font-semibold text-[#0F766E] hover:underline disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-brand-ink/50 hover:text-brand-ink/70"
        >
          Cancel
        </button>
      </form>
      {showMessage ? (
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 300))}
          placeholder={`Say something to ${creatorName} (optional, only they'll see it)`}
          rows={2}
          className="mt-2 w-full rounded-lg border border-brand-ink/10 px-2 py-1.5 text-xs"
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowMessage(true)}
          className="mt-2 text-[11px] font-medium text-[#0F766E] hover:underline"
        >
          + Add a message
        </button>
      )}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
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
            className="block w-full rounded-lg border border-[#0F766E]/25 px-3 py-2 text-left text-sm font-medium text-[#0F766E] hover:bg-[#0F766E]/5 disabled:opacity-50"
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
            <div className={`flex justify-between ${mine ? 'font-semibold text-[#0F766E]' : 'text-brand-ink/70'}`}>
              <span>
                {option}
                {mine && ' ✓'}
              </span>
              <span className="text-brand-ink/60">{pct}%</span>
            </div>
            <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-brand-ink/5">
              <div
                className={`h-full rounded-full ${mine ? 'bg-[#0F766E]' : 'bg-[#0F766E]/40'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </button>
        );
      })}
      <p className="text-xs text-brand-ink/50">{total} vote{total === 1 ? '' : 's'} — tap an option to change your vote</p>
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
function LockedPostPreview({ hasTiers, isVideo }) {
  return (
    <div className={`relative mt-3 overflow-hidden rounded-xl ${isVideo ? 'aspect-video' : ''}`}>
      <div
        className={`pointer-events-none w-full bg-gradient-to-br from-[#0F766E]/10 via-brand-ink/5 to-[#0F766E]/10 blur-[2px] ${isVideo ? 'h-full' : 'h-28'}`}
        aria-hidden="true"
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-white/40 text-center backdrop-blur-sm">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-paper text-sm shadow-sm"
          aria-hidden="true"
        >
          {isVideo ? '🎥' : '🔒'}
        </span>
        <p className="text-xs font-medium text-brand-ink/70">
          {hasTiers ? (
            <a href="#tiers" className="text-[#0F766E] underline">
              Subscribe to {isVideo ? 'watch this video' : 'view this post'}
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
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-ink/5 px-2 py-0.5 text-[11px] font-medium text-brand-ink/65">
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
