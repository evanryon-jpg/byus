'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import FoundingBadge from '../components/FoundingBadge';
import CreatorRow from '../components/CreatorRow';

// searchParams is passed in automatically by Next.js for page.js files, client or
// server, so a link like /browse?q=aria (from the homepage search, or its autocomplete
// dropdown) arrives here already pre-filled and already searching -- no extra click
// needed to see the results that were just promised.
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'trending', label: 'Trending' },
  { value: 'popular', label: 'Most popular' },
];
const SORT_VALUES = SORT_OPTIONS.map((opt) => opt.value);

export default function BrowsePage({ searchParams }) {
  const initialQ = typeof searchParams?.q === 'string' ? searchParams.q : '';
  const initialTag = typeof searchParams?.tag === 'string' ? searchParams.tag : '';
  const initialSort = SORT_VALUES.includes(searchParams?.sort) ? searchParams.sort : 'newest';

  const [creators, setCreators] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [q, setQ] = useState(initialQ);
  const [tag, setTag] = useState(initialTag);
  const [sort, setSort] = useState(initialSort);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (tag) params.set('tag', tag);
    if (sort !== 'newest') params.set('sort', sort);

    // Small debounce so typing a search query doesn't fire a request per keystroke.
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/creators?${params.toString()}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data) => {
          setCreators(data.creators || []);
          setAvailableTags(data.availableTags || []);
          setNextOffset(data.nextOffset ?? null);
        })
        .catch((err) => {
          if (err.name !== 'AbortError') console.error('creators fetch failed:', err);
        })
        .finally(() => setLoading(false));
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, tag, sort]);

  async function loadMore() {
    if (nextOffset === null || loadingMore) return;
    setLoadingMore(true);
    const params = new URLSearchParams({ offset: String(nextOffset) });
    if (q.trim()) params.set('q', q.trim());
    if (tag) params.set('tag', tag);
    if (sort !== 'newest') params.set('sort', sort);
    try {
      const response = await fetch(`/api/creators?${params.toString()}`);
      const data = await response.json();
      if (response.ok) {
        setCreators((current) => [...current, ...(data.creators || [])]);
        setNextOffset(data.nextOffset ?? null);
      }
    } catch (err) {
      console.error('more creators fetch failed:', err);
    } finally {
      setLoadingMore(false);
    }
  }

  const isFiltered = Boolean(q.trim() || tag);
  const marketplaceEmpty = !loading && creators.length === 0 && !isFiltered && availableTags.length === 0;
  const foundingDirectory = !loading && creators.length === 1 && !isFiltered;
  const showDiscoveryControls = loading || creators.length > 1 || isFiltered;

  return (
    <div>
      <section className="border-b border-brand-ink/10">
        <div className="mx-auto max-w-4xl px-6 pt-10 pb-10">
          <h1 className="font-display text-3xl font-bold text-[#172033]">Browse creators</h1>
          <p className="mt-2 max-w-xl text-brand-ink/70">
            {marketplaceEmpty
              ? 'Founding creator spots are open now, and creator accounts open soon. This directory will grow as pages go live.'
              : foundingDirectory
                ? 'Meet ByUs creator #1. New founding creator pages will appear here as they go live.'
                : 'Find someone whose work you already love, or discover your next favorite.'}
          </p>

          {showDiscoveryControls && (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name or bio…"
                className="w-full rounded-full border border-brand-ink/10 bg-brand-paper px-4 py-2 text-sm focus:border-[#0F766E]/40 focus:outline-none sm:flex-1"
              />

              <div className="flex shrink-0 items-center gap-1 self-start rounded-full bg-brand-paper p-1 text-xs font-medium shadow-sm sm:self-auto">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSort(opt.value)}
                    aria-pressed={sort === opt.value}
                    className={`rounded-full px-3 py-1.5 ${
                      sort === opt.value ? 'bg-[#0F766E]/10 text-[#0F766E]' : 'text-brand-ink/65 hover:text-brand-ink/80'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-6 py-12">
      {availableTags.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {availableTags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTag(tag === t ? '' : t)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                tag === t
                  ? 'bg-[#0F766E] text-white'
                  : 'bg-[#0F766E]/10 text-[#0F766E] hover:bg-[#0F766E]/20'
              }`}
            >
              {t}
            </button>
          ))}
          {isFiltered && (
            <button
              type="button"
              onClick={() => {
                setQ('');
                setTag('');
              }}
              className="text-xs font-medium text-brand-ink/60 hover:text-brand-ink/70"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {!isFiltered && (
        <CreatorRow
          title="New on ByUs"
          subtitle="Creators who started posting in the last 30 days. A different mix every day."
          params="new=1&limit=6"
          className="mt-8"
        />
      )}
      {loading && <p className="mt-6 text-brand-ink/60">Loading…</p>}
      {!loading && creators.length === 0 && isFiltered && (
        <p className="mt-6 text-brand-ink/60">No creators match your search.</p>
      )}
      {marketplaceEmpty && (
        <section className="overflow-hidden rounded-3xl border border-brand-teal/20 bg-brand-paper shadow-sm">
          <div className="bg-gradient-to-br from-brand-teal/10 via-transparent to-brand-gold/15 px-6 py-9 text-center sm:px-10 sm:py-12">
            <span className="inline-flex rounded-full bg-brand-teal/10 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.16em] text-brand-teal">
              Founding stage
            </span>
            <h2 className="mx-auto mt-4 max-w-xl font-display text-2xl font-bold text-[#172033] sm:text-3xl">
              The first creator pages are being built.
            </h2>
            <p className="mx-auto mt-3 max-w-xl leading-relaxed text-brand-ink/70">
              We won&rsquo;t fill this directory with pretend members. Until real creators publish
              their pages, you can explore demonstration profiles or join the creator waitlist
              for an email when signups reopen. Joining reserves a founding spot while available.
            </p>

            <div className="mt-7 flex justify-center">
              <a
                href="/signup?role=creator"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand-teal px-6 py-3 font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#115E59]"
              >
                Join the creator waitlist
              </a>
            </div>

            <div className="mx-auto mt-7 flex max-w-xl flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-semibold text-brand-ink/60">
              <span>No follower minimum</span>
              <span aria-hidden="true">•</span>
              <span>No payment required</span>
              <span aria-hidden="true">•</span>
              <span>Email when signups reopen</span>
            </div>
          </div>
        </section>
      )}
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {creators.map((c) => (
          <li key={c.id}>
            <a
              href={`/creator/${c.slug || c.id}`}
              className="flex items-center gap-4 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6 hover:border-[#0F766E]/30"
            >
              {c.profile_image_url ? (
                <Image
                  src={c.profile_image_url}
                  alt={`${c.display_name || 'Creator'}'s profile photo`}
                  width={48}
                  height={48}
                  className="h-12 w-12 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0F766E]/10 text-lg font-semibold text-[#0F766E]">
                  {(c.display_name || '?').trim().charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{c.display_name || 'Unnamed creator'}</h3>
                  {c.is_founding && (
                    <FoundingBadge rank={c.founding_creator_rank} limit={c.founding_creator_limit} />
                  )}
                </div>
                {c.bio && <p className="mt-1 text-sm text-brand-ink/65 line-clamp-2">{c.bio}</p>}
                {(c.follower_count > 0 || c.active_subscriber_count > 0) && (
                  <p className="mt-1.5 text-xs text-brand-ink/55">
                    {c.follower_count > 0 && (
                      <span>{c.follower_count.toLocaleString()} follower{c.follower_count === 1 ? '' : 's'}</span>
                    )}
                    {c.follower_count > 0 && c.active_subscriber_count > 0 && <span> · </span>}
                    {c.active_subscriber_count > 0 && (
                      <span>{c.active_subscriber_count.toLocaleString()} paid member{c.active_subscriber_count === 1 ? '' : 's'}</span>
                    )}
                  </p>
                )}
                {c.tags && c.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.tags.map((t) => (
                      <span key={t} className="rounded-full bg-brand-ink/5 px-2 py-0.5 text-[11px] text-brand-ink/65">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </a>
          </li>
        ))}
      </ul>

      {foundingDirectory && (
        <section className="mt-8 rounded-3xl border border-brand-gold/35 bg-[#FFF9E8] px-6 py-8 text-center sm:px-10">
          <span className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#9A6700]">
            Join the creator waitlist
          </span>
          <h2 className="mt-3 font-display text-2xl font-bold text-[#172033]">
            Creator #2 could be you.
          </h2>
          <p className="mx-auto mt-3 max-w-xl leading-relaxed text-brand-ink/70">
            Founding spots are open now for US creators. Reserve one to lock in the 10% rate for good, and join Evan at
            the beginning. Creator accounts open soon; we&rsquo;ll email you a link, and you sign up with the same
            email to claim your spot.
          </p>
          <div className="mt-6 flex justify-center">
            <a
              href="/signup?role=creator"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand-teal px-6 py-3 font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#115E59]"
            >
              Join the creator waitlist
            </a>
          </div>
        </section>
      )}

      {!loading && nextOffset !== null && (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-full border border-[#0F766E] px-6 py-2.5 text-sm font-semibold text-[#0F766E] hover:bg-[#0F766E]/5 disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Show more creators'}
          </button>
        </div>
      )}
      </div>
    </div>
  );
}
