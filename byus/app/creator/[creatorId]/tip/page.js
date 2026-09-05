'use client';

// A standalone, share-anywhere "tip me" page — the same one-time payment as the
// TipWidget embedded on the full profile (app/creator/[creatorId]/page.js), just
// stripped down to a single focused card with nothing else competing for attention.
// This is the link a creator drops in a video description or stream panel, à la
// ko-fi.com/username, instead of pointing people at their whole profile.

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

export default function TipPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-brand-ink/60">Loading…</div>}>
      <TipPageContent />
    </Suspense>
  );
}

const TIP_PRESETS_CENTS = [300, 500, 1000, 2000];
const MAX_MESSAGE_LENGTH = 300;

function TipPageContent() {
  const { creatorId } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const justTipped = searchParams.get('tipped') === 'true';

  const [creator, setCreator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [custom, setCustom] = useState('');
  const [message, setMessage] = useState('');
  const [showMessage, setShowMessage] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, [creatorId]);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch(`/api/creators/${creatorId}`);
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      const result = await res.json();
      setCreator(result.creator);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  async function sendTip(cents) {
    setError('');
    setSending(true);
    try {
      const res = await fetch(`/api/creators/${creator.id}/tip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCents: cents,
          message,
          returnTo: `/creator/${creatorId}/tip`,
        }),
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

  if (loading) {
    return <div className="p-16 text-center text-brand-ink/60">Loading…</div>;
  }

  if (loadError || !creator) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <p className="text-brand-ink/72">Could not find this creator.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <div className="rounded-2xl border border-brand-ink/5 bg-brand-paper p-8 text-center shadow-sm">
        {creator.profile_image_url ? (
          <Image
            src={creator.profile_image_url}
            alt={`${creator.display_name}'s profile photo`}
            width={72}
            height={72}
            className="mx-auto h-[72px] w-[72px] rounded-full object-cover"
          />
        ) : (
          <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#146359]/10 text-2xl font-semibold text-[#146359]">
            {(creator.display_name || '?').trim().charAt(0).toUpperCase()}
          </div>
        )}

        <h1 className="mt-4 font-display text-2xl font-semibold leading-tight text-[#2B2420]">
          ☕ Buy {creator.display_name} a coffee
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-brand-ink/65">
          A one-time thank-you — no subscription, no commitment.
        </p>

        {justTipped ? (
          <div className="mt-6 rounded-xl bg-[#146359]/10 p-4 text-sm font-medium text-[#146359]">
            Thank you! Your tip is on its way to {creator.display_name}.
          </div>
        ) : !creator.stripe_connect_onboarded ? (
          <p className="mt-6 rounded-xl bg-brand-ink/[0.03] p-4 text-sm text-brand-ink/65">
            {creator.display_name} hasn't finished setting up payments yet — check back soon.
          </p>
        ) : (
          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {TIP_PRESETS_CENTS.map((cents) => (
                <button
                  key={cents}
                  type="button"
                  onClick={() => sendTip(cents)}
                  disabled={sending}
                  className="rounded-full bg-[#C9A961] px-5 py-2 text-sm font-semibold text-white hover:bg-[#b3945a] disabled:opacity-50"
                >
                  ${(cents / 100).toFixed(0)}
                </button>
              ))}
            </div>

            <form onSubmit={handleCustomSubmit} className="mt-4 flex items-center justify-center gap-1.5">
              <span className="text-sm text-brand-ink/60">$</span>
              <input
                type="number"
                min="1"
                step="1"
                placeholder="Other amount"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                className="w-28 rounded-lg border border-brand-ink/10 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={sending}
                className="rounded-full bg-[#146359] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f4d45] disabled:opacity-50"
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
            </form>

            {showMessage ? (
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                placeholder={`Say something to ${creator.display_name} (optional, only they'll see it)`}
                rows={2}
                className="mt-4 w-full rounded-lg border border-brand-ink/10 px-3 py-2 text-sm"
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowMessage(true)}
                className="mt-4 text-xs font-medium text-[#8a6b2f] hover:underline"
              >
                + Add a message
              </button>
            )}

            {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
          </div>
        )}

        <a
          href={`/creator/${creatorId}`}
          className="mt-8 inline-block text-sm font-medium text-brand-teal hover:underline"
        >
          View {creator.display_name}'s full page →
        </a>
      </div>
    </div>
  );
}
