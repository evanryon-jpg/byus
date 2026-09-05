'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import PhotoCollageBackground from '../components/PhotoCollageBackground';

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

  const isFiltered = Boolean(q.trim() || tag);

  return (
    <div>
      {/* A wall of real creators at work behind the search -- same treatment as
          the homepage hero, so "browse creators" reads as people to find rather
          than another form to fill in. */}
      <section className="relative overflow-hidden border-b border-brand-ink/10">
        <PhotoCollageBackground />
        <div className="mx-auto max-w-4xl px-6 pt-14 pb-10">
          <h1 className="font-display text-3xl font-bold text-[#2B2420]">Browse creators</h1>
          <p className="mt-2 max-w-lg text-brand-ink/68">
            Find someone whose work you already love, or discover your next favorite.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or bio…"
              className="w-full rounded-full border border-brand-ink/10 bg-brand-paper px-4 py-2 text-sm focus:border-[#146359]/40 focus:outline-none sm:flex-1"
            />

            <div className="flex shrink-0 items-center gap-1 self-start rounded-full bg-brand-paper p-1 text-xs font-medium shadow-sm sm:self-auto">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSort(opt.value)}
                  aria-pressed={sort === opt.value}
                  className={`rounded-full px-3 py-1.5 ${
                    sort === opt.value ? 'bg-[#146359]/10 text-[#146359]' : 'text-brand-ink/65 hover:text-brand-ink/80'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
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
                  ? 'bg-[#146359] text-white'
                  : 'bg-[#146359]/10 text-[#146359] hover:bg-[#146359]/20'
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
              className="text-xs font-medium text-brand-ink/60 hover:text-brand-ink/72"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {loading && <p className="mt-6 text-brand-ink/60">Loading…</p>}
      {!loading && creators.length === 0 && isFiltered && (
        <p className="mt-6 text-brand-ink/60">No creators match your search.</p>
      )}
      {!loading && creators.length === 0 && !isFiltered && (
        <p className="mt-6 text-brand-ink/60">No creators yet — check back soon.</p>
      )}
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {creators.map((c) => (
          <li key={c.id}>
            <a
              href={`/creator/${c.slug || c.id}`}
              className="flex items-center gap-4 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6 hover:border-[#146359]/30"
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
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#146359]/10 text-lg font-semibold text-[#146359]">
                  {(c.display_name || '?').trim().charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{c.display_name || 'Unnamed creator'}</h3>
                  {c.active_subscriber_count > 0 && (
                    <span className="shrink-0 text-xs font-medium text-brand-ink/60">
                      {c.active_subscriber_count.toLocaleString()} subscriber{c.active_subscriber_count === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                {c.bio && <p className="mt-1 text-sm text-brand-ink/65 line-clamp-2">{c.bio}</p>}
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
      </div>
    </div>
  );
}
