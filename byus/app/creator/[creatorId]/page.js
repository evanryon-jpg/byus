'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

export default function CreatorProfilePage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-black/40">Loading…</div>}>
      <CreatorProfile />
    </Suspense>
  );
}

function CreatorProfile() {
  const { creatorId } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const justSubscribed = searchParams.get('subscribed') === 'true';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(null);
  const [subscribeError, setSubscribeError] = useState('');

  useEffect(() => {
    load();
  }, [creatorId]);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/creators/${creatorId}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }

  async function handleSubscribe(tierId) {
    setSubscribing(tierId);
    setSubscribeError('');
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tierId }),
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

  if (loading) return <div className="p-12 text-center text-black/40">Loading…</div>;
  if (!data) return <div className="p-12 text-center text-black/40">Creator not found.</div>;

  const { creator, tiers, posts, hasActiveSubscription } = data;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      {justSubscribed && (
        <p className="mb-6 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
          🎉 You're in! Welcome to {creator.display_name}'s page — subscriber-only posts below are unlocked.
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
      {creator.bio && <p className="mt-2 text-black/60">{creator.bio}</p>}

      {/* Tiers */}
      <div id="tiers" className="scroll-mt-6">
        {!hasActiveSubscription && tiers.length > 0 && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {tiers.map((t) => (
              <div key={t.id} className="rounded-2xl border border-black/5 bg-white p-6">
                <h3 className="font-semibold">{t.name}</h3>
                {t.description && <p className="mt-1 text-sm text-black/50">{t.description}</p>}
                <p className="mt-3 text-lg font-bold text-[#146359]">
                  ${(t.price_cents / 100).toFixed(2)}<span className="text-sm font-normal text-black/40">/mo</span>
                </p>
                <button
                  onClick={() => handleSubscribe(t.id)}
                  disabled={subscribing === t.id}
                  className="mt-4 w-full rounded-full bg-[#146359] py-2 text-sm font-semibold text-white hover:bg-[#0f4d45] disabled:opacity-50"
                >
                  {subscribing === t.id ? 'Redirecting…' : 'Subscribe'}
                </button>
              </div>
            ))}
          </div>
        )}
        {!hasActiveSubscription && tiers.length === 0 && (
          <p className="mt-8 rounded-xl bg-black/5 px-4 py-3 text-sm text-black/50">
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
          <li key={p.id} className="rounded-2xl border border-black/5 bg-white p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">{p.title || '(untitled)'}</h3>
              <span className="text-xs text-black/40">{new Date(p.created_at).toLocaleDateString()}</span>
            </div>
            {p.locked ? (
              <p className="mt-2 text-sm italic text-black/40">
                🔒 Subscribers only —{' '}
                {tiers.length > 0 ? (
                  <a href="#tiers" className="not-italic text-[#146359] underline">
                    subscribe above to unlock this post
                  </a>
                ) : (
                  'subscribe to unlock this post'
                )}
                .
              </p>
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
                <p className="mt-2 text-sm text-black/70">{p.body}</p>
              </>
            )}
          </li>
        ))}
        {posts.length === 0 && <p className="text-sm text-black/40">No posts yet.</p>}
      </ul>
    </div>
  );
}
