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
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-[#C97C5D]/30 bg-[#C97C5D]/10 p-4 text-sm">
      <div>
        <p className="font-semibold text-[#a35a3d]">One more thing before you keep going</p>
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
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-brand-ink/30 text-[#146359] focus:ring-[#146359]"
        />
        <span>
          I agree that everything I publish on ByUs follows the{' '}
          <a href="/terms" target="_blank" className="text-[#146359] underline">content guidelines</a>
          {' '}— no adult content, ever, and nothing that endangers minors.
        </span>
      </label>
      {error && <p className="text-red-600">{error}</p>}
      <button
        onClick={handleConfirm}
        disabled={saving || !checked}
        className="self-start rounded-full bg-[#146359] px-5 py-2 text-xs font-semibold text-white hover:bg-[#0f4d45] disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Confirm'}
      </button>
    </div>
  );
}
