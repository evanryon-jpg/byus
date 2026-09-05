'use client';

// A dedicated "support the platform" page -- distinct from a creator's own /tip page
// (app/creator/[creatorId]/tip/page.js), which this one is modeled on. Money-wise it's the
// exact same one-time-payment rail (POST /api/creators/:creatorId/tip), just pointed at
// PLATFORM_CREATOR_ID and framed around ByUs itself instead of an individual creator --
// intentionally not linked from the main nav (see the footer instead), so it's there for
// anyone who goes looking or follows a shared link without competing for attention on
// every page.

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PLATFORM_CREATOR_ID } from '@/lib/platform';

export default function SupportPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-brand-ink/60">Loading…</div>}>
      <SupportPageContent />
    </Suspense>
  );
}

const AMOUNT_PRESETS_CENTS = [300, 500, 1000, 2000];
const MAX_MESSAGE_LENGTH = 300;

function SupportPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justSupported = searchParams.get('tipped') === 'true';

  const [acceptingSupport, setAcceptingSupport] = useState(null); // null = still checking
  const [loadError, setLoadError] = useState(false);
  const [custom, setCustom] = useState('');
  const [message, setMessage] = useState('');
  const [showMessage, setShowMessage] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoadError(false);
    try {
      const res = await fetch(`/api/creators/${PLATFORM_CREATOR_ID}`);
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      const result = await res.json();
      setAcceptingSupport(Boolean(result.creator?.stripe_connect_onboarded));
    } catch {
      setLoadError(true);
    }
  }

  async function sendSupport(cents) {
    setError('');
    setSending(true);
    try {
      const res = await fetch(`/api/creators/${PLATFORM_CREATOR_ID}/tip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCents: cents,
          message,
          returnTo: '/support',
        }),
      });
      const result = await res.json();
      if (result.url) {
        window.location.href = result.url; // redirect to Stripe Checkout
        return;
      }
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent('/support')}`);
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
    sendSupport(cents);
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <div className="rounded-2xl border border-brand-ink/5 bg-brand-paper p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[10px] bg-brand-clay -rotate-6">
          <span className="rotate-6 text-xl font-bold text-white">B</span>
        </div>

        <h1 className="mt-4 font-display text-2xl font-semibold leading-tight text-[#2B2420]">
          Support ByUs
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-brand-ink/65">
          A one-time thank-you that goes straight toward hosting and building ByUs — no
          subscription, no commitment.
        </p>

        {justSupported ? (
          <div className="mt-6 rounded-xl bg-[#146359]/10 p-4 text-sm font-medium text-[#146359]">
            Thank you! It genuinely helps keep ByUs running.
          </div>
        ) : loadError ? (
          <p className="mt-6 rounded-xl bg-brand-ink/[0.03] p-4 text-sm text-brand-ink/65">
            Couldn&apos;t load this page right now — try refreshing.
          </p>
        ) : acceptingSupport === null ? (
          <div className="mt-6 text-sm text-brand-ink/50">Loading…</div>
        ) : !acceptingSupport ? (
          <p className="mt-6 rounded-xl bg-brand-ink/[0.03] p-4 text-sm text-brand-ink/65">
            Support isn&apos;t set up yet — check back soon.
          </p>
        ) : (
          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {AMOUNT_PRESETS_CENTS.map((cents) => (
                <button
                  key={cents}
                  type="button"
                  onClick={() => sendSupport(cents)}
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
                placeholder="Say something (optional, only Evan will see it)"
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

        <a href="/" className="mt-8 inline-block text-sm font-medium text-brand-teal hover:underline">
          Back to ByUs →
        </a>
      </div>
    </div>
  );
}
