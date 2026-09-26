'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import FoundingBadge from './FoundingBadge';

// A small row of creator cards pulled from /api/creators with fixed, rule-based filters
// (see that route): "New on ByUs" (new=1) and "Similar creators" (similarTo=<id>). The
// order is a daily shuffle, so every creator who qualifies gets the same chance to be
// seen. Hides itself when fewer than `min` creators qualify, instead of showing a
// half-empty row.
export default function CreatorRow({ title, subtitle, params, min = 1, max = 6, className = '' }) {
  const [creators, setCreators] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/creators?${params}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => { if (!cancelled) setCreators(data.creators || []); })
      .catch(() => { if (!cancelled) setCreators([]); });
    return () => { cancelled = true; };
  }, [params]);

  if (!creators || creators.length < min) return null;
  const shown = creators.slice(0, max);

  return (
    <section className={className}>
      <h2 className="font-display text-xl font-semibold text-[#172033]">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-brand-ink/65">{subtitle}</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((c) => (
          <a
            key={c.id}
            href={`/creator/${c.slug || c.id}`}
            className="flex min-w-0 items-center gap-3 rounded-2xl border border-brand-ink/5 bg-brand-paper p-4 transition hover:-translate-y-0.5 hover:border-brand-teal/30 hover:shadow-md"
          >
            {c.profile_image_url ? (
              <Image
                src={c.profile_image_url}
                alt={`${c.display_name || 'Creator'}'s profile photo`}
                width={44}
                height={44}
                className="h-11 w-11 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-teal/10 text-lg font-semibold text-brand-teal">
                {(c.display_name || '?').trim().charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="truncate font-semibold text-[#172033]">{c.display_name || 'Unnamed creator'}</h3>
                {c.is_founding && <FoundingBadge rank={c.founding_creator_rank} limit={c.founding_creator_limit} />}
              </div>
              {c.bio && <p className="mt-0.5 truncate text-xs text-brand-ink/65">{c.bio}</p>}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
