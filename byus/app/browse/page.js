'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

export default function BrowsePage() {
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/creators')
      .then((r) => r.json())
      .then((data) => setCreators(data.creators || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-bold">Browse creators</h1>
      {loading && <p className="mt-6 text-black/40">Loading…</p>}
      {!loading && creators.length === 0 && (
        <p className="mt-6 text-black/40">No creators yet — check back soon.</p>
      )}
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {creators.map((c) => (
          <li key={c.id}>
            <a
              href={`/creator/${c.id}`}
              className="flex items-center gap-4 rounded-2xl border border-black/5 bg-white p-6 hover:border-[#146359]/30"
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
                <h3 className="font-semibold">{c.display_name || 'Unnamed creator'}</h3>
                {c.bio && <p className="mt-1 text-sm text-black/50 line-clamp-2">{c.bio}</p>}
              </div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
