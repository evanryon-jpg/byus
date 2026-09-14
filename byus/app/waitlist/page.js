'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

// Replaces "Start Creating" -> /signup?role=creator as the site's primary creator CTA
// while Stripe Connect onboarding is paused for platform review (see
// app/api/creator/connect-stripe/route.js). Deliberately its own page rather than a
// variant of /signup: this collects an email to invite from later, not an account, and
// says so plainly rather than pretending signup is business as usual.
export default function WaitlistPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-brand-ink/60">Loading…</div>}>
      <WaitlistForm />
    </Suspense>
  );
}

function WaitlistForm() {
  const searchParams = useSearchParams();
  // Which CTA sent someone here (hero, the Founding Creator Program section, ...) —
  // purely so the site owner can see what converts. Never shown to the visitor.
  const source = searchParams.get('source') || 'direct';
  const referralCode = searchParams.get('ref') || '';

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [website, setWebsite] = useState(''); // honeypot — real users never see or fill this
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { alreadyApplied, count }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          displayName,
          source,
          referralCode: referralCode || undefined,
          website,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
        return;
      }
      setResult(data);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#0F766E]/10 text-2xl text-[#0F766E]">
          ✓
        </div>
        <h1 className="mt-6 text-2xl font-bold text-[#172033]">
          {result.alreadyApplied ? "You're already on the list." : "You're on the list."}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-brand-ink/70">
          We'll email <strong className="text-[#172033]">{email}</strong> the moment founding
          spots open up — no action needed from you until then.
        </p>
        {typeof result.count === 'number' && result.count > 0 && (
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-brand-ink/50">
            {result.count.toLocaleString()} {result.count === 1 ? 'creator has' : 'creators have'} applied so far
          </p>
        )}
        <a
          href="/"
          className="mt-8 inline-block rounded-full bg-[#0F766E] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#115E59]"
        >
          Back to ByUs
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-clay">
        Founding Creator Program
      </span>
      <h1 className="mt-3 text-2xl font-bold text-[#172033]">Apply for a founding spot</h1>

      {/* The honest reason this is an "apply" flow and not instant signup — see the same
          framing added to the FAQ (app/components/FAQSection.jsx). */}
      <p className="mt-3 text-sm leading-relaxed text-brand-ink/70">
        ByUs is brand new, and our payment processor is finishing a standard review of our
        account before we can activate payouts to creators — common for a new platform, and
        we expect it to clear soon. Rather than start you on a signup that dead-ends at that
        step, leave your email and we'll invite you the moment it's live — first, before
        anyone else — so you can lock in our lowest fee (10%, forever) as one of the first
        100 founding creators.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <Field label="Email">
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoFocus
          />
        </Field>
        <Field label="Name or handle (optional)">
          <input
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="So we know who to invite"
          />
        </Field>

        {/* Honeypot — hidden from real users via CSS, present in the DOM for bots that
            fill every field they can find. Off the tab order and out of screen readers. */}
        <div className="absolute left-[-9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
          <label htmlFor="website">Leave this field blank</label>
          <input
            id="website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-[#0F766E] py-3 font-semibold text-white hover:bg-[#115E59] disabled:opacity-50"
        >
          {loading ? 'Joining…' : 'Join the waitlist'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-brand-ink/65">
        Just here to support a creator?{' '}
        <a href="/browse" className="text-[#0F766E] underline">
          Browse ByUs
        </a>
      </p>

      <style jsx global>{`
        .input {
          width: 100%;
          border: 1px solid rgba(0,0,0,0.1);
          border-radius: 0.75rem;
          padding: 0.65rem 0.9rem;
          font-size: 0.95rem;
        }
        .input:focus { outline: 2px solid #0F766E; border-color: transparent; }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-brand-ink/80">{label}</span>
      {children}
    </label>
  );
}
