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

  const [role, setRole] = useState(defaultRole);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot — real users never see or fill this
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!termsAccepted) {
      setError('Please agree to the Terms of Service and Privacy Policy to continue.');
      return;
    }
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
      router.push(role === 'creator' ? '/creator/dashboard' : '/browse');
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

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Field label="Display name">
          <input
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name or handle"
          />
        </Field>
        <Field label="Email">
          <input
            className="input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password">
          <input
            className="input"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="mt-1 text-xs text-black/40">At least 8 characters.</p>
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
            required
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
            </a>.
          </span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading || !termsAccepted}
          className="w-full rounded-full bg-[#146359] py-3 font-semibold text-white hover:bg-[#0f4d45] disabled:opacity-50"
        >
          {loading ? 'Creating account…' : 'Sign up'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-black/50">
        Already have an account? <a href="/login" className="text-[#146359] underline">Log in</a>
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

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-black/70">{label}</span>
      {children}
    </label>
  );
}
