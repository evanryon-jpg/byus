'use client';

import { useState } from 'react';

// Shown on the creator dashboard when stripe_connect_onboarded is true but
// content_policy_accepted_at is still null -- i.e. this creator connected Stripe before
// app/api/creator/connect-stripe/route.js started requiring an explicit content-policy
// acknowledgment. Same checkbox and copy as that original gate, just retroactive: posts
// to app/api/creator/acknowledge-policy/route.js instead of blocking a Stripe connection
// that's already done. Stays up (not dismissible without submitting) until it's answered,
// same as VerifyEmailBanner stays up until the email is actually verified.
export default function AcknowledgePolicyBanner({ onAcknowledged }) {
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    if (!checked) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/creator/acknowledge-policy', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not save this. Try again.');
        return;
      }
      onAcknowledged(data.user);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-[#0F766E]/30 bg-[#0F766E]/10 p-4 text-sm">
      <div>
        <p className="font-semibold text-[#115E59]">One more thing before you keep going</p>
        <p className="mt-0.5 text-brand-ink/70">
          Your Stripe account was connected before we added an explicit content-policy
          acknowledgment step. Please confirm the same thing every creator confirms when
          connecting Stripe:
        </p>
      </div>
      <label className="flex items-start gap-2.5 text-brand-ink/80">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-brand-ink/30 text-[#0F766E] focus:ring-[#0F766E]"
        />
        <span>
          I have read and agree to the{' '}
          <a href="/creator-terms" target="_blank" className="text-[#0F766E] underline">Creator Agreement</a>
          {' '}and{' '}
          <a href="/content-policy" target="_blank" className="text-[#0F766E] underline">Content Policy</a>,
          including the rules on ownership, consent, prohibited content, and creator responsibility.
        </span>
      </label>
      {error && <p className="text-red-600">{error}</p>}
      <button
        onClick={handleConfirm}
        disabled={saving || !checked}
        className="self-start rounded-full bg-[#0F766E] px-5 py-2 text-xs font-semibold text-white hover:bg-[#115E59] disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Confirm'}
      </button>
    </div>
  );
}
