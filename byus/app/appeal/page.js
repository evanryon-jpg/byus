'use client';

// Public, unauthenticated appeal form for a suspended ByUs account. Linked from the
// login page's "account suspended" error, and from the Content Policy / Creator
// Agreement pages, replacing the old "just email support@byusapp.com" instruction with
// a submission the team can actually track in /admin/appeals. See
// app/api/account/appeal/route.js for why the response here never reveals whether a
// given email actually matches a suspended account.

import { useState } from 'react';

export default function AppealPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function validate() {
    const errors = {};
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) errors.email = 'Enter the email on your ByUs account.';
    else if (!emailRe.test(email)) errors.email = 'Enter a valid email address.';
    if (!message.trim()) errors.message = 'Tell us why you think this was a mistake.';
    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch('/api/account/appeal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, message }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Something went wrong.');
        return;
      }
      setSubmitted(true);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-[#172033]">Appeal received</h1>
        <p className="mt-3 text-sm text-brand-ink/70">
          If that email matches a suspended ByUs account, we've received your appeal and will follow up
          at that address once the team has reviewed it. There's no need to submit again.
        </p>
        <a href="/" className="mt-6 inline-block text-sm font-semibold text-[#0F766E] hover:underline">
          Back to ByUs →
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold text-[#172033]">Appeal a suspension</h1>
      <p className="mt-2 text-sm text-brand-ink/65">
        If your ByUs account was suspended and you believe it was a mistake, tell us why below. We
        review every appeal and follow up by email — there's no need to also email support separately.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-brand-ink/70">Email on your account</span>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined }));
            }}
            aria-invalid={Boolean(fieldErrors.email)}
            className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 ${
              fieldErrors.email ? 'border-red-400 focus:ring-red-300' : 'border-brand-ink/10 focus:ring-[#0F766E]'
            }`}
          />
          {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-brand-ink/70">Why do you think this was a mistake?</span>
          <textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              if (fieldErrors.message) setFieldErrors((f) => ({ ...f, message: undefined }));
            }}
            rows={6}
            maxLength={2000}
            aria-invalid={Boolean(fieldErrors.message)}
            className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 ${
              fieldErrors.message ? 'border-red-400 focus:ring-red-300' : 'border-brand-ink/10 focus:ring-[#0F766E]'
            }`}
          />
          {fieldErrors.message && <p className="mt-1 text-xs text-red-600">{fieldErrors.message}</p>}
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-[#0F766E] py-3 text-sm font-semibold text-white hover:bg-[#115E59] disabled:opacity-50"
        >
          {loading ? 'Submitting…' : 'Submit appeal'}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-brand-ink/55">
        Not suspended, but have a different question? Visit the{' '}
        <a href="/help" className="text-[#0F766E] underline">Help Center</a> or email{' '}
        <a href="mailto:support@byusapp.com" className="text-[#0F766E] underline">support@byusapp.com</a>.
      </p>
    </div>
  );
}
