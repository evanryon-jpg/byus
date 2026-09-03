'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-black/40">Loading…</div>}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultRole = searchParams.get('role') === 'creator' ? 'creator' : 'fan';
  // Same-site-only guard as the login page — see the comment there.
  const rawNext = searchParams.get('next') || '';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '';

  const [role, setRole] = useState(defaultRole);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot — real users never see or fill this
  const [fieldErrors, setFieldErrors] = useState({});
  // A bounce back from /api/auth/google/callback lands here with ?error=... — surface
  // it the same way as any other signup failure instead of silently dropping it.
  const [error, setError] = useState(searchParams.get('error') || '');
  const [loading, setLoading] = useState(false);

  const googleHref = `/api/auth/google?role=${role}${next ? `&next=${encodeURIComponent(next)}` : ''}`;
  const appleHref = `/api/auth/apple?role=${role}${next ? `&next=${encodeURIComponent(next)}` : ''}`;

  function validate() {
    const errors = {};
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) errors.email = 'Enter your email address.';
    else if (!emailRe.test(email)) errors.email = 'Enter a valid email address.';
    if (!password) errors.password = 'Choose a password.';
    else if (password.length < 8) errors.password = 'At least 8 characters.';
    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const errors = validate();
    if (!termsAccepted) {
      setError('Please agree to the Terms of Service and Privacy Policy to continue.');
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || !termsAccepted) return;

    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role, displayName, termsAccepted, website }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
        return;
      }
      router.push(next || (role === 'creator' ? '/creator/dashboard' : '/browse'));
      router.refresh();
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold">Create your account</h1>

      <div className="mt-6 flex gap-2 rounded-full bg-black/5 p-1">
        <RoleTab label="I'm a fan" active={role === 'fan'} onClick={() => setRole('fan')} />
        <RoleTab label="I'm a creator" active={role === 'creator'} onClick={() => setRole('creator')} />
      </div>
      {role === 'creator' && (
        <p className="mt-3 text-xs text-black/50">
          Next you'll connect Stripe and set up a subscription tier — takes a couple of minutes, right after you sign up.
        </p>
      )}

      <a
        href={googleHref}
        className="mt-6 flex w-full items-center justify-center gap-3 rounded-full border border-black/10 bg-white py-3 font-semibold text-[#1A1A1A] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <GoogleIcon />
        Continue with Google
      </a>
      <a
        href={appleHref}
        className="mt-3 flex w-full items-center justify-center gap-3 rounded-full bg-black py-3 font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <AppleIcon />
        Continue with Apple
      </a>
      <p className="mt-3 text-center text-xs text-black/40">
        By continuing, you agree to our{' '}
        <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline">
          Terms of Service
        </a>{' '}
        and{' '}
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">
          Privacy Policy
        </a>
        .
      </p>

      <Divider label="or sign up with email" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Display name">
          <input
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name or handle"
          />
        </Field>
        <Field label="Email" error={fieldErrors.email}>
          <input
            className={`input ${fieldErrors.email ? 'input-error' : ''}`}
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined }));
            }}
            aria-invalid={Boolean(fieldErrors.email)}
          />
        </Field>
        <Field label="Password" error={fieldErrors.password}>
          <input
            className={`input ${fieldErrors.password ? 'input-error' : ''}`}
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined }));
            }}
            aria-invalid={Boolean(fieldErrors.password)}
          />
          {!fieldErrors.password && <p className="mt-1 text-xs text-black/40">At least 8 characters.</p>}
        </Field>

        {/* Honeypot — hidden from real users via CSS, but present in the DOM for bots
            that fill every field they can find. Kept off the tab order and out of
            screen readers so it never confuses an actual person. */}
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

        <label className="flex items-start gap-2.5 text-sm text-black/70">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-black/20 text-[#146359] focus:ring-[#146359]"
          />
          <span>
            I agree to the{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#146359] underline">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[#146359] underline">
              Privacy Policy
            </a>
            .
          </span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-[#146359] py-3 font-semibold text-white hover:bg-[#0f4d45] disabled:opacity-50"
        >
          {loading ? 'Creating account…' : 'Sign up'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-black/50">
        Already have an account?{' '}
        <a href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="text-[#146359] underline">
          Log in
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
        .input:focus { outline: 2px solid #146359; border-color: transparent; }
        .input-error { border-color: #f87171; }
        .input-error:focus { outline: 2px solid #f87171; }
      `}</style>
    </div>
  );
}

function RoleTab({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-full py-2 text-sm font-medium transition ${
        active ? 'bg-white shadow text-[#146359]' : 'text-black/50'
      }`}
    >
      {label}
    </button>
  );
}

function Field({ label, error, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-black/70">{label}</span>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </label>
  );
}

function Divider({ label }) {
  return (
    <div className="my-6 flex items-center gap-3">
      <div className="h-px flex-1 bg-black/10" />
      <span className="text-xs font-medium uppercase tracking-wide text-black/35">{label}</span>
      <div className="h-px flex-1 bg-black/10" />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4c-7.4 0-13.8 4.2-17.7 10.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5C29.6 34.9 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C10.1 39.7 16.5 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.5 5.5C41.5 36 44 30.5 44 24c0-1.3-.1-2.7-.4-3.5z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 384 512" aria-hidden="true" fill="#ffffff">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}
