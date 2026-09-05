'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// The homepage's single, oversized search box. Shows a live dropdown of matching
// creators as you type -- most fans never need to land on the full /browse page at
// all, they just type a name and click straight through to the profile they want.
// Pressing Enter (or clicking "See all results") still goes to /browse?q=... for the
// full list, so nothing is lost for anyone who wants to scroll through more names.
export default function CreatorSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/creators?q=${encodeURIComponent(q.trim())}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data) => setResults((data.creators || []).slice(0, 5)))
        .catch((err) => {
          if (err.name !== 'AbortError') console.error('creator search failed:', err);
        })
        .finally(() => setLoading(false));
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  // Close the dropdown on an outside click so it doesn't linger over the rest of
  // the page once someone's done with it.
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    router.push(q.trim() ? `/browse?q=${encodeURIComponent(q.trim())}` : '/browse');
  }

  const showDropdown = open && q.trim().length > 0;

  return (
    <div ref={containerRef} className="relative mt-8 max-w-xl text-left">
      <form onSubmit={handleSubmit}>
        <label htmlFor="hero-search" className="sr-only">
          Search for a creator
        </label>
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-brand-ink/55"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
          </svg>
          <input
            id="hero-search"
            type="text"
            autoComplete="off"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Type a creator's name…"
            className="w-full rounded-xl border border-brand-ink/20 bg-brand-paper py-4 pl-12 pr-5 text-base shadow-sm outline-none transition focus:border-brand-clay focus:ring-2 focus:ring-brand-clay/15"
          />
        </div>
      </form>

      {showDropdown && (
        <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-2xl border border-brand-ink/5 bg-brand-paper shadow-xl shadow-brand-ink/10">
          {loading && (
            <p className="px-6 py-4 text-sm text-brand-ink/60">Searching…</p>
          )}
          {!loading && results.length === 0 && (
            <p className="px-6 py-4 text-sm text-brand-ink/60">No creators match "{q.trim()}".</p>
          )}
          {!loading &&
            results.map((c) => (
              <a
                key={c.id}
                href={`/creator/${c.slug || c.id}`}
                className="flex items-center gap-3 px-6 py-3 transition hover:bg-brand-teal/5"
              >
                {c.profile_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- tiny dropdown avatar, not worth next/image's overhead here
                  <img
                    src={c.profile_image_url}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-teal/10 text-sm font-semibold text-brand-teal">
                    {(c.display_name || '?').trim().charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#2B2420]">
                    {c.display_name || 'Unnamed creator'}
                  </p>
                  {c.bio && <p className="truncate text-xs text-brand-ink/60">{c.bio}</p>}
                </div>
              </a>
            ))}
          {!loading && (
            <a
              href={`/browse?q=${encodeURIComponent(q.trim())}`}
              className="block border-t border-brand-ink/5 px-6 py-3 text-center text-sm font-semibold text-brand-teal hover:bg-brand-teal/5"
            >
              See all results →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
