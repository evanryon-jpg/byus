'use client';

// Phase 2 of the native feature parity plan: the public discovery feed. Every public
// post across every creator, newest first -- open to logged-out visitors on purpose,
// since the whole point is reaching people who've never heard of ByUs or this creator
// yet (see app/api/discover/route.js). Deliberately simple: plain recency, no ranking
// algorithm -- Phase 3 revisits that once this has real usage data to rank with.
//
// Structured like app/browse/page.js (same offset/hasMore API shape, same brand
// tokens) but loads automatically via IntersectionObserver instead of a "Load more"
// button -- an actual infinite-scroll feed, since that's what the plan calls for here
// specifically, unlike Browse's shorter, filterable creator grid.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import PostVideoPlayer from '../components/PostVideoPlayer';

const REPORT_REASONS = [
  { value: 'adult_content', label: 'Adult / sexual content' },
  { value: 'illegal_content', label: 'Illegal content' },
  { value: 'harassment', label: 'Harassment or endangerment' },
  { value: 'ip_infringement', label: 'Copyright / IP infringement' },
  { value: 'hate_violence', label: 'Hate speech or violent extremism' },
  { value: 'other', label: 'Something else' },
];

export default function DiscoverPage() {
  const router = useRouter();
  const [posts, setPosts] = useState([]);
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState('');
  const sentinelRef = useRef(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/discover?offset=${nextOffset}`);
      // Parsed separately from the res.ok check below on purpose: a cold-start timeout
      // or network hiccup can come back with an empty/truncated body even on requests
      // that otherwise look fine, and res.json() throws its own raw parser error
      // ("Unexpected end of JSON input") in that case -- letting that reach the catch
      // block below meant real users (and Google's crawler, which is how this got
      // caught) saw that exact JS exception text rendered as the page's error message.
      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error('Could not load the feed. Try again.');
      }
      if (!res.ok) throw new Error(data.error || 'Could not load the feed.');
      setPosts((current) => [...current, ...(data.posts || [])]);
      setHasMore(Boolean(data.hasMore));
      setNextOffset(data.nextOffset ?? nextOffset);
    } catch (err) {
      setError(err.message || 'Could not load the feed. Try again.');
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [loading, hasMore, nextOffset]);

  // First page, on mount.
  useEffect(() => {
    loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the next page automatically once the sentinel at the bottom of the list
  // scrolls into view -- the actual "infinite scroll" the plan calls for, rather
  // than a manual button click per page.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '600px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-display text-3xl font-bold text-[#172033]">Discover</h1>
      <p className="mt-2 text-brand-ink/70">
        Fresh public posts from creators across ByUs, newest first. Follow anyone whose work catches your eye.
      </p>

      {initialLoad && loading && (
        <p className="mt-10 text-center text-sm text-brand-ink/50">Loading…</p>
      )}

      {!initialLoad && posts.length === 0 && !loading && (
        <p className="mt-10 rounded-xl bg-brand-ink/5 px-4 py-3 text-sm text-brand-ink/65">
          Nothing public here yet — check back once creators start posting.
        </p>
      )}

      <ul className="mt-8 space-y-6">
        {posts.map((post) => (
          <FeedPost key={post.id} post={post} router={router} />
        ))}
      </ul>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {/* Invisible trigger for the IntersectionObserver above; also doubles as a
          loading indicator once it's actually on screen (only reachable by scrolling,
          same moment loadMore() fires). */}
      <div ref={sentinelRef} className="h-1" />
      {!initialLoad && loading && (
        <p className="mt-4 text-center text-sm text-brand-ink/50">Loading more…</p>
      )}
      {!hasMore && posts.length > 0 && (
        <p className="mt-8 text-center text-sm text-brand-ink/40">You're all caught up.</p>
      )}
    </div>
  );
}

function FeedPost({ post, router }) {
  const [likeCount, setLikeCount] = useState(Number(post.likeCount || 0));
  const [likedByMe, setLikedByMe] = useState(Boolean(post.likedByMe));
  const [likeBusy, setLikeBusy] = useState(false);
  const [following, setFollowing] = useState(Boolean(post.creator.followedByMe));
  const [followBusy, setFollowBusy] = useState(false);

  const profileHref = `/creator/${post.creator.slug || post.creator.id}`;

  async function handleLike() {
    if (likeBusy) return;
    setLikeBusy(true);
    try {
      const res = await fetch(`/api/posts/${post.id}/like`, { method: 'POST' });
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent('/discover')}`);
        return;
      }
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setLikeCount(result.likeCount);
      setLikedByMe(result.likedByMe);
    } catch (err) {
      // A failed like isn't worth interrupting the feed over -- the button just
      // stays as it was, same as a network hiccup on any other social app.
    } finally {
      setLikeBusy(false);
    }
  }

  async function handleFollow() {
    if (followBusy) return;
    setFollowBusy(true);
    try {
      const res = await fetch('/api/follows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId: post.creator.id, following: !following }),
      });
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent('/discover')}`);
        return;
      }
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setFollowing(result.following);
    } catch (err) {
      // Same as the like button -- leave the toggle as it was rather than show a
      // scary error over a low-stakes action.
    } finally {
      setFollowBusy(false);
    }
  }

  return (
    <li className="rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
      <div className="flex items-center justify-between gap-3">
        <a href={profileHref} className="flex min-w-0 items-center gap-3">
          {post.creator.profileImageUrl ? (
            <Image
              src={post.creator.profileImageUrl}
              alt={`${post.creator.displayName}'s profile photo`}
              width={40}
              height={40}
              unoptimized
              className="h-10 w-10 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0F766E]/10 text-sm font-semibold text-[#0F766E]">
              {(post.creator.displayName || '?').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-medium text-[#172033]">{post.creator.displayName}</p>
            <p className="text-xs text-brand-ink/50">{new Date(post.createdAt).toLocaleDateString()}</p>
          </div>
        </a>
        <button
          type="button"
          onClick={handleFollow}
          disabled={followBusy}
          aria-pressed={following}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
            following
              ? 'border border-[#0F766E]/30 text-[#0F766E] hover:bg-[#0F766E]/5'
              : 'bg-[#0F766E] text-white hover:bg-[#115E59]'
          }`}
        >
          {following ? 'Following' : 'Follow'}
        </button>
      </div>

      {post.title && <h2 className="mt-4 font-medium text-[#172033]">{post.title}</h2>}

      {post.video && (
        <div className="mt-3">
          <PostVideoPlayer playbackId={post.video.playbackId} playbackToken={post.video.playbackToken} />
        </div>
      )}
      {!post.video && post.mediaUrl && (
        <div className="relative mt-3 aspect-[16/10] w-full overflow-hidden rounded-xl">
          <Image
            src={post.mediaUrl}
            alt={post.title ? `Photo for "${post.title}"` : 'Post photo'}
            fill
            unoptimized
            className="object-cover"
          />
        </div>
      )}
      {post.body && <p className="mt-3 text-sm text-brand-ink/80">{post.body}</p>}

      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          onClick={handleLike}
          disabled={likeBusy}
          aria-pressed={likedByMe}
          className={`flex items-center gap-1 text-xs font-medium transition-colors disabled:opacity-50 ${
            likedByMe ? 'text-[#A6432E]' : 'text-brand-ink/40 hover:text-brand-ink/70'
          }`}
        >
          <span aria-hidden="true">{likedByMe ? '♥' : '♡'}</span>
          {likeCount > 0 ? likeCount : 'Like'}
        </button>
        {post.viewCount > 0 && (
          <span className="text-xs text-brand-ink/40">{post.viewCount} view{post.viewCount === 1 ? '' : 's'}</span>
        )}
        <a href={profileHref} className="text-xs font-medium text-[#0F766E] hover:underline">
          See more from {post.creator.displayName} →
        </a>
        <ReportButton creatorId={post.creator.id} postId={post.id} />
      </div>
    </li>
  );
}

// Same shape as ProfileClient.js's ReportButton -- kept as its own small copy here
// rather than a shared import so this page has no dependency on a component file
// that's currently scoped (and named) for a single creator's profile page.
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
    return <p className="ml-auto text-xs text-green-700">✓ Reported</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ml-auto text-xs font-medium text-brand-ink/40 hover:text-brand-ink/70 hover:underline"
      >
        ⚑ Report
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="ml-auto w-full max-w-xs rounded-xl border border-brand-ink/10 bg-brand-paper p-3 text-left shadow-sm"
    >
      <p className="text-xs font-semibold text-[#172033]">Report this post</p>
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
        placeholder="Any details that would help (optional)"
        rows={2}
        className="mt-2 w-full rounded-lg border border-brand-ink/15 px-2.5 py-1.5 text-xs"
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-2.5 py-1 text-xs text-brand-ink/60 hover:bg-brand-ink/5"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !reason}
          className="rounded-lg bg-[#0F766E] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </form>
  );
}
