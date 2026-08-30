'use client';

import { useState } from 'react';

// Shared banner shown on both dashboards when the logged-in user hasn't verified
// their email yet. Self-contained — just needs to know whether to render at all.
export default function VerifyEmailBanner({ email }) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function handleResend() {
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/auth/resend-verification', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not send the email. Try again shortly.');
        return;
      }
      setSent(true);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-brand-gold/30 bg-brand-gold/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold text-[#8a6b2f]">Verify your email address</p>
        <p className="mt-0.5 text-black/60">
          {sent
            ? `We sent a new link to ${email}. Check your inbox.`
            : `We sent a link to ${email} when you signed up — check your inbox, or resend it below.`}
        </p>
        {error && <p className="mt-1 text-red-600">{error}</p>}
      </div>
      <button
        onClick={handleResend}
        disabled={sending || sent}
        className="shrink-0 rounded-full border border-[#8a6b2f]/40 px-4 py-2 text-xs font-semibold text-[#8a6b2f] hover:bg-brand-gold/15 disabled:opacity-50"
      >
        {sending ? 'Sending…' : sent ? 'Sent' : 'Resend email'}
      </button>
    </div>
  );
}
