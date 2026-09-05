'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

// Real creators only, sorted by popularity -- the same /api/creators?sort=popular the
// browse page already uses. Nothing here is placeholder or mock data: see the
// AvatarCluster comment in page.js for why -- implying an ecosystem that doesn't exist
// yet erodes exactly the trust this page is trying to build with a fan who's about to
// hand over a card number. Below MIN_CREATORS this section hides itself entirely rather
// than show a half-empty grid; it switches on naturally once enough real creators exist.
const MIN_CREATORS = 3;
const MAX_SHOWN = 6;

export default function FeaturedCreators() {
  const [creators, setCreators] = useState(null);

  useEffect(() => {
    fetch('/api/creators?sort=popular')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setCreators(data.creators || []))
      .catch(() => setCreators([]));
  }, []);

  if (!creators || creators.length < MIN_CREATORS) return null;

  const shown = creators.slice(0, MAX_SHOWN);

  return (
    <section className="mx-auto max-w-4xl px-6 py-4">
      <div className="text-center">
        <h2 className="font-display text-2xl font-semibold text-[#2B2420]">Creators on ByUs right now</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-brand-ink/68">
          A few of the people already building a membership here.
        </p>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {shown.map((c) => (
          <a
            key={c.id}
            href={`/creator/${c.slug || c.id}`}
            className="flex items-center gap-3 rounded-2xl border border-brand-ink/5 bg-brand-paper p-4 transition hover:-translate-y-0.5 hover:border-brand-teal/30 hover:shadow-md"
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
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-teal/10 text-lg font-semibold text-brand-teal">
                {(c.display_name || '?').trim().charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="truncate font-semibold text-[#2B2420]">{c.display_name || 'Unnamed creator'}</h3>
              {c.bio && <p className="mt-0.5 truncate text-xs text-brand-ink/65">{c.bio}</p>}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
