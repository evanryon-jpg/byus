'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { safeNextPath } from '@/lib/safe-next';
import { CREATOR_COUNTRY_OPTIONS, creatorCountryName, creatorCountryStatus } from '@/lib/creator-countries';

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-brand-ink/60">Loading…</div>}>
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
  const next = safeNextPath(rawNext);

  // A referral link looks like /signup?ref=CODE — carried through to the signup POST
  // body (for email signup) and appended to the OAuth hrefs below (for Google/Apple
  // signup), so however someone completes the form, the referral still gets recorded.
  const referralCode = searchParams.get('ref') || '';
  const rawSource = searchParams.get('source');
  const acquisitionSource = rawSource === 'instagram' || rawSource === 'blogger' ? rawSource : '';

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

  const legalQuery = termsAccepted ? '&intent=signup&legalAcceptance=1' : '';
  const googleHref = `/api/auth/google?role=${role}${next ? `&next=${encodeURIComponent(next)}` : ''}${referralCode ? `&ref=${encodeURIComponent(referralCode)}` : ''}${acquisitionSource ? `&source=${acquisitionSource}` : ''}${legalQuery}`;
  const appleHref = `/api/auth/apple?role=${role}${next ? `&next=${encodeURIComponent(next)}` : ''}${referralCode ? `&ref=${encodeURIComponent(referralCode)}` : ''}${acquisitionSource ? `&source=${acquisitionSource}` : ''}${legalQuery}`;

  function requireTermsForOAuth(event) {
    if (termsAccepted) return;
    event.preventDefault();
    setError('Please agree to the Terms of Service and Privacy Policy to continue.');
  }

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
        body: JSON.stringify({
          email,
          password,
          role,
          displayName,
          termsAccepted,
          website,
          referralCode: referralCode || undefined,
          acquisitionSource: acquisitionSource || undefined,
        }),
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
      <h1 className="text-2xl font-bold">{role === 'creator' ? 'Reserve your founding spot' : 'Create your account'}</h1>

      <div className="mt-6 flex gap-2 rounded-full bg-brand-ink/5 p-1">
        <RoleTab label="I'm a fan" active={role === 'fan'} onClick={() => setRole('fan')} />
        <RoleTab label="I'm a creator" active={role === 'creator'} onClick={() => setRole('creator')} />
      </div>

      {role === 'creator' ? (
        <CreatorWaitlistPanel acquisitionSource={acquisitionSource} referralCode={referralCode} />
      ) : (
        <>
          <label className="mt-6 flex items-start gap-2.5 rounded-xl border border-brand-ink/10 bg-white/60 p-3 text-sm text-brand-ink/80">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => {
                setTermsAccepted(e.target.checked);
                if (e.target.checked) setError('');
              }}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-brand-ink/20 text-[#0F766E] focus:ring-[#0F766E]"
            />
            <span>
              I have read and agree to the{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#0F766E] underline">Terms of Service</a>
              {' '}and acknowledge the{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[#0F766E] underline">Privacy Policy</a>.
            </span>
          </label>
          <a
            href={googleHref}
            onClick={requireTermsForOAuth}
            aria-disabled={!termsAccepted}
            className="mt-4 flex w-full items-center justify-center gap-3 rounded-full border border-brand-ink/10 bg-brand-paper py-3 font-semibold text-[#172033] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          >
            <GoogleIcon />
            Continue with Google
          </a>
          <a
            href={appleHref}
            onClick={requireTermsForOAuth}
            aria-disabled={!termsAccepted}
            className="mt-3 flex w-full items-center justify-center gap-3 rounded-full bg-black py-3 font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <AppleIcon />
            Continue with Apple
          </a>
          <Divider label="or sign up with email" />

          {/* noValidate: without it, a malformed address in the type="email" field trips the
              browser's own validation bubble on submit and silently short-circuits
              handleSubmit before our custom fieldErrors (and the terms-checkbox banner)
              ever run — so none of the polished inline messaging below would actually show. */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
              {!fieldErrors.password && <p className="mt-1 text-xs text-brand-ink/60">At least 8 characters.</p>}
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

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-[#0F766E] py-3 font-semibold text-white hover:bg-[#115E59] disabled:opacity-50"
            >
              {loading ? 'Creating account…' : 'Sign up'}
            </button>
          </form>
        </>
      )}

      <p className="mt-6 text-center text-sm text-brand-ink/65">
        Already have an account?{' '}
        <a href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="text-[#0F766E] underline">
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
        .input:focus { outline: 2px solid #0F766E; border-color: transparent; }
        .input-error { border-color: #f87171; }
        .input-error:focus { outline: 2px solid #f87171; }
      `}</style>
    </div>
  );
}

// Creator signup is temporarily paused (see app/api/waitlist/route.js) while we sort out
// some account setup on our end. Rather than let someone start Stripe Connect onboarding
// only to hit a wall, we ask for an email up front and let them know once it reopens. Fans
// are completely unaffected — this branch only renders when role === 'creator' above.
function CreatorWaitlistPanel({ acquisitionSource, referralCode }) {
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistName, setWaitlistName] = useState('');
  // Creator accounts are US-only at launch (lib/creator-countries.js), so we ask where
  // someone lives before they reserve: UK / Europe / Canada still reserve and are emailed
  // when their country opens; anywhere else joins the list without taking a spot.
  const [waitlistCountry, setWaitlistCountry] = useState('');
  const [countryError, setCountryError] = useState('');
  const [waitlistWebsite, setWaitlistWebsite] = useState(''); // honeypot, same pattern as below
  const [waitlistError, setWaitlistError] = useState('');
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [waitlistResult, setWaitlistResult] = useState(null); // { alreadyApplied } once submitted
  // Live founding-spot numbers (GET /api/waitlist) so the offer reads "spot #3 of 50"
  // instead of a generic waitlist. Null until loaded -- the copy has a neutral fallback.
  const [spots, setSpots] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/waitlist', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled && data && typeof data.limit === 'number') setSpots(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const spotsFull = spots ? spots.remaining <= 0 : false;

  async function handleWaitlistSubmit(e) {
    e.preventDefault();
    setWaitlistError('');
    const trimmed = waitlistEmail.trim();
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let invalid = false;
    if (!waitlistCountry) {
      setCountryError('Choose the country you live in.');
      invalid = true;
    }
    if (!trimmed || !emailRe.test(trimmed)) {
      setWaitlistError('Enter a valid email address.');
      invalid = true;
    }
    if (invalid) return;

    setWaitlistLoading(true);
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmed,
          displayName: waitlistName.trim() || undefined,
          source: acquisitionSource || undefined,
          referralCode: referralCode || undefined,
          website: waitlistWebsite,
          country: waitlistCountry,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setWaitlistError(data.error || 'Something went wrong. Please try again.');
        return;
      }
      setWaitlistResult({
        alreadyApplied: Boolean(data.alreadyApplied),
        email: trimmed,
        foundingSpot: data.foundingSpot ?? null,
        country: waitlistCountry,
      });
    } catch {
      setWaitlistError('Network error — please try again.');
    } finally {
      setWaitlistLoading(false);
    }
  }

  if (waitlistResult) {
    return (
      <div className="mt-6 rounded-xl border border-[#0F766E]/20 bg-[#0F766E]/5 p-5 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#0F766E]/15 text-xl text-[#0F766E]">
          ✓
        </div>
        <h2 className="mt-3 font-semibold text-[#172033]">
          {waitlistResult.alreadyApplied ? "You're already on the list" : "You're on the list"}
        </h2>
        <p className="mt-1.5 text-sm text-brand-ink/65">
          {creatorCountryStatus(waitlistResult.country) === 'unsupported'
            ? `You're on the list. ByUs can't pay creators in your country yet, so we can't hold a founding spot, but we'll email ${waitlistResult.email} if that changes.`
            : creatorCountryStatus(waitlistResult.country) === 'soon'
            ? waitlistResult.foundingSpot
              ? `Founding spot #${waitlistResult.foundingSpot} is already reserved for ${waitlistResult.email}. We'll email you the day creator accounts open in ${creatorCountryName(waitlistResult.country)}.`
              : `You're on the list. We'll email ${waitlistResult.email} the day creator accounts open in ${creatorCountryName(waitlistResult.country)}, at standard pricing: 13%, dropping to 10% for any month you earn $2,000.`
            : waitlistResult.foundingSpot
            ? `Founding spot #${waitlistResult.foundingSpot} is reserved for ${waitlistResult.email}, with the 10% rate for good. Use this same email to create your creator account when signups reopen.`
            : `We'll email ${waitlistResult.email} when creator signups reopen. All founding spots are reserved; standard pricing will apply to your new account.`}
        </p>
        <a href="/" className="mt-4 inline-block text-sm font-semibold text-[#0F766E] underline">
          Back to ByUs
        </a>
      </div>
    );
  }

  return (
    <div className="mt-6">
      {spotsFull ? (
        <div className="rounded-xl border border-brand-ink/10 bg-white/60 p-4">
          <p className="font-semibold text-[#172033]">All {spots.limit} founding spots are reserved</p>
          <p className="mt-1 text-sm text-brand-ink/70">
            Join the creator waitlist and we'll email you the moment creator signups open. Standard pricing
            applies: 13%, dropping to 10% for the rest of any month you earn $2,000.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#0F766E]/25 bg-[#0F766E]/5 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#0F766E]">
            {spots ? `${spots.remaining} of ${spots.limit} founding spots left` : 'Founding creator spots'}
          </p>
          <p className="mt-1.5 text-lg font-semibold text-[#172033]">
            {spots?.nextSpot ? `Reserve founding spot #${spots.nextSpot}` : 'Reserve a founding spot'}
          </p>
          <ul className="mt-2 space-y-1 text-sm text-brand-ink/75">
            <li>10% platform fee for good, standard domestic processing included</li>
            <li>For creators in the US</li>
            <li>No follower minimum</li>
            <li>Free to reserve, no payment details needed</li>
          </ul>
        </div>
      )}

      <form onSubmit={handleWaitlistSubmit} noValidate className="mt-5 space-y-4">
        <Field label="Display name (optional)">
          <input
            className="input"
            value={waitlistName}
            onChange={(e) => setWaitlistName(e.target.value)}
            placeholder="Your name or handle"
          />
        </Field>
        <Field label="Where do you live?" error={countryError}>
          <select
            id="creator-waitlist-country"
            className={`input ${countryError ? 'input-error' : ''}`}
            value={waitlistCountry}
            onChange={(e) => {
              setWaitlistCountry(e.target.value);
              if (countryError) setCountryError('');
            }}
            aria-invalid={Boolean(countryError)}
          >
            <option value="" disabled>
              Choose your country
            </option>
            {CREATOR_COUNTRY_OPTIONS.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        {creatorCountryStatus(waitlistCountry) === 'soon' && waitlistCountry && (
          <p className="-mt-2 rounded-lg bg-[#C9A961]/15 px-3 py-2 text-xs leading-relaxed text-[#5B4718]">
            Creator accounts open in the US first, with the UK, Europe and Canada coming after. Founding spots and the
            10% founding rate are for US creators, so you&rsquo;ll join at standard pricing: 13%, dropping to 10% for any
            month you earn $2,000. Join the list and we&rsquo;ll email you the day {creatorCountryName(waitlistCountry)} opens.
          </p>
        )}
        {creatorCountryStatus(waitlistCountry) === 'unsupported' && (
          <p className="-mt-2 rounded-lg bg-brand-ink/5 px-3 py-2 text-xs leading-relaxed text-brand-ink/70">
            ByUs can&rsquo;t pay creators outside the US, UK, Europe and Canada yet, so we can&rsquo;t hold a founding
            spot for you. You can still join the list and we&rsquo;ll let you know if that changes.
          </p>
        )}
        <Field label="Email" error={waitlistError}>
          <input
            className={`input ${waitlistError ? 'input-error' : ''}`}
            type="email"
            value={waitlistEmail}
            onChange={(e) => {
              setWaitlistEmail(e.target.value);
              if (waitlistError) setWaitlistError('');
            }}
            aria-invalid={Boolean(waitlistError)}
          />
        </Field>

        {/* Honeypot — same pattern as the fan signup form above. */}
        <div className="absolute left-[-9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
          <label htmlFor="creator-waitlist-website">Leave this field blank</label>
          <input
            id="creator-waitlist-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={waitlistWebsite}
            onChange={(e) => setWaitlistWebsite(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={waitlistLoading}
          className="w-full rounded-full bg-[#0F766E] py-3 font-semibold text-white hover:bg-[#115E59] disabled:opacity-50"
        >
          {waitlistLoading
            ? spotsFull || (waitlistCountry && creatorCountryStatus(waitlistCountry) !== 'launch') ? 'Joining…' : 'Reserving…'
            : spotsFull || (waitlistCountry && creatorCountryStatus(waitlistCountry) !== 'launch') ? 'Join the list' : 'Reserve my spot'}
        </button>
      </form>

      <p className="mt-4 text-xs leading-relaxed text-brand-ink/55">
        Creator accounts open soon, in the US first, with the UK, Europe and Canada coming next. We'll email you a
        link to create your page; sign up with this same email{spotsFull ? '' : ' and your spot is yours'}. No
        account is created yet.
      </p>
    </div>
  );
}

function RoleTab({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-full py-2 text-sm font-medium transition ${
        active ? 'bg-brand-paper shadow text-[#0F766E]' : 'text-brand-ink/65'
      }`}
    >
      {label}
    </button>
  );
}

function Field({ label, error, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-brand-ink/80">{label}</span>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </label>
  );
}

function Divider({ label }) {
  return (
    <div className="my-6 flex items-center gap-3">
      <div className="h-px flex-1 bg-brand-ink/10" />
      <span className="text-xs font-medium uppercase tracking-wide text-brand-ink/55">{label}</span>
      <div className="h-px flex-1 bg-brand-ink/10" />
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
