'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-black/40">Loading…</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('verifying'); // verifying | success | error
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('This link is missing a verification token.');
      return;
    }

    (async () => {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!res.ok) {
          setStatus('error');
          setError(data.error || 'Could not verify this email address.');
          return;
        }
        setStatus('success');
      } catch {
        setStatus('error');
        setError('Network error — please try again.');
      }
    })();
  }, [token]);

  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      {status === 'verifying' && (
        <>
          <h1 className="font-display text-2xl font-semibold text-[#1A1A1A]">Verifying your email…</h1>
          <p className="mt-3 text-black/50">One moment.</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-teal/10 text-brand-teal">
            ✓
          </div>
          <h1 className="mt-4 font-display text-2xl font-semibold text-[#1A1A1A]">Email verified</h1>
          <p className="mt-3 text-black/60">
            Your email address is confirmed. You&rsquo;re all set to use ByUs.
          </p>
          <a
            href="/"
            className="mt-8 inline-block rounded-full bg-brand-teal px-6 py-2.5 font-semibold text-white hover:bg-[#0f4d45]"
          >
            Go to ByUs
          </a>
        </>
      )}

      {status === 'error' && (
        <>
          <h1 className="font-display text-2xl font-semibold text-[#1A1A1A]">Verification failed</h1>
          <p className="mt-3 text-black/60">{error}</p>
          <p className="mt-6 text-sm text-black/45">
            You can request a new verification link from your dashboard.
          </p>
        </>
      )}
    </div>
  );
}
