'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 15; // ~30s — the Connect webhook usually lands in a second or two,
// but this gives it real room before telling someone their setup might be stuck.

function OnboardingStatus() {
  const searchParams = useSearchParams();
  const isRefresh = searchParams.get('refresh') === 'true';

  // loading | reconnecting | waiting | success | timeout | error
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let timer;

    async function reconnect() {
      setStatus('reconnecting');
      try {
        const res = await fetch('/api/creator/connect-stripe', { method: 'POST' });
        const data = await res.json();
        if (!res.ok || !data.url) throw new Error(data.error || 'Could not restart Stripe onboarding.');
        window.location.href = data.url;
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not restart Stripe onboarding.');
          setStatus('error');
        }
      }
    }

    async function poll(attempts) {
      const res = await fetch('/api/me');
      if (!res.ok) {
        window.location.href = '/login';
        return;
      }
      const { user } = await res.json();
      if (cancelled) return;

      if (user.role !== 'creator') {
        window.location.href = '/fan/dashboard';
        return;
      }

      // Stripe redirects here as soon as the creator finishes its hosted flow, but our own
      // "onboarded" flag only flips once the account.updated webhook lands — so a fan hitting
      // this page a beat early is expected, not broken. Trust the webhook-backed flag, never
      // the mere fact that Stripe sent someone back here (they may have bailed partway through).
      if (user.stripe_connect_onboarded) {
        setStatus('success');
        return;
      }

      if (attempts + 1 >= MAX_POLL_ATTEMPTS) {
        setStatus('timeout');
        return;
      }
      setStatus('waiting');
      timer = setTimeout(() => poll(attempts + 1), POLL_INTERVAL_MS);
    }

    if (isRefresh) {
      reconnect();
    } else {
      poll(0);
    }

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isRefresh]);

  async function handleRetryConnect() {
    setStatus('reconnecting');
    setError('');
    try {
      const res = await fetch('/api/creator/connect-stripe', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not restart Stripe onboarding.');
      window.location.href = data.url;
    } catch (err) {
      setError(err.message || 'Could not restart Stripe onboarding.');
      setStatus('error');
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16 text-center">
      {(status === 'loading' || status === 'waiting') && (
        <>
          <Spinner />
          <h1 className="mt-6 text-2xl font-bold">Finishing up your Stripe setup…</h1>
          <p className="mt-2 text-sm text-brand-ink/65">This usually takes just a few seconds. Don't close this tab.</p>
        </>
      )}

      {status === 'reconnecting' && (
        <>
          <Spinner />
          <h1 className="mt-6 text-2xl font-bold">Reconnecting to Stripe…</h1>
          <p className="mt-2 text-sm text-brand-ink/65">
            Your last onboarding link expired — sending you back to Stripe.
          </p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl text-green-700">
            ✓
          </div>
          <h1 className="mt-6 text-2xl font-bold">You're all set!</h1>
          <p className="mt-2 text-sm text-brand-ink/65">
            Stripe has confirmed your account. You can now create paid tiers and start earning.
          </p>
          <a
            href="/creator/dashboard"
            className="mt-8 inline-block rounded-full bg-[#146359] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#0f4d45]"
          >
            Go to your dashboard
          </a>
        </>
      )}

      {status === 'timeout' && (
        <>
          <h1 className="text-2xl font-bold">Still finishing up</h1>
          <p className="mt-2 text-sm text-brand-ink/65">
            Stripe hasn't confirmed your account yet. This can occasionally take a few minutes —
            your dashboard will update automatically once it does.
          </p>
          <a
            href="/creator/dashboard"
            className="mt-8 inline-block rounded-full bg-[#146359] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#0f4d45]"
          >
            Go to your dashboard
          </a>
        </>
      )}

      {status === 'error' && (
        <>
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="mt-2 text-sm text-red-600">{error}</p>
          <div className="mt-8 flex justify-center gap-3">
            <button
              onClick={handleRetryConnect}
              className="rounded-full bg-[#146359] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#0f4d45]"
            >
              Try again
            </button>
            <a
              href="/creator/dashboard"
              className="rounded-full border border-brand-ink/10 px-6 py-2.5 text-sm font-semibold hover:bg-brand-ink/5"
            >
              Go to dashboard
            </a>
          </div>
        </>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div
      className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-brand-ink/10 border-t-[#146359]"
      aria-hidden="true"
    />
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-brand-ink/60">Loading…</div>}>
      <OnboardingStatus />
    </Suspense>
  );
}
