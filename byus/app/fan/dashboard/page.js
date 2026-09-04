'use client';

import { useEffect, useState } from 'react';
import VerifyEmailBanner from '../../components/VerifyEmailBanner';

export default function FanDashboard() {
  const [user, setUser] = useState(null);
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const meRes = await fetch('/api/me');
      if (meRes.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!meRes.ok) {
        // A real failure (500, etc) — distinct from "not logged in" above. Booting a
        // logged-in fan to /login over a transient server hiccup would be worse than
        // just showing a retry option.
        setLoadError(true);
        return;
      }
      setUser((await meRes.json()).user);
      const subsRes = await fetch('/api/fan/subscriptions');
      if (subsRes.ok) setSubs((await subsRes.json()).subscriptions);
    } catch {
      // fetch() itself can throw (offline, DNS failure, dropped connection) — without this
      // catch, setLoading(false) below would never run and the page would be stuck on
      // "Loading…" forever instead of showing a retry option.
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleManageBilling() {
    setBillingLoading(true);
    setBillingError('');
    try {
      const res = await fetch('/api/fan/billing-portal', { method: 'POST' });
      const result = await res.json();
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      setBillingError(result.error || 'Could not open billing. Try again.');
    } catch {
      setBillingError('Network error — please try again.');
    } finally {
      setBillingLoading(false);
    }
  }

  if (loading) return <div className="p-12 text-center text-black/40">Loading…</div>;
  if (loadError) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
        <p className="text-black/60">Couldn't load your dashboard. Check your connection and try again.</p>
        <button
          onClick={load}
          className="mt-4 rounded-full bg-[#146359] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#0f4d45]"
        >
          Try again
        </button>
      </div>
    );
  }

  const hasBillableSub = subs.length > 0;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Your subscriptions</h1>
          <p className="text-black/50">Welcome back, {user?.display_name || user?.email}.</p>
        </div>
        {hasBillableSub && (
          <button
            type="button"
            onClick={handleManageBilling}
            disabled={billingLoading}
            className="rounded-full border border-[#146359] px-4 py-2 text-sm font-semibold text-[#146359] hover:bg-[#146359]/5 disabled:opacity-50"
          >
            {billingLoading ? 'Opening…' : 'Manage billing'}
          </button>
        )}
      </div>
      {billingError && (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{billingError}</p>
      )}
      <p className="mt-1 text-xs text-black/40">
        Update your card, view invoices, or cancel a subscription — all in one place.
      </p>

      {user && !user.email_verified && <VerifyEmailBanner email={user.email} />}

      <ul className="mt-8 space-y-3">
        {subs.map((s) => (
          <li key={s.id}>
            <a
              href={`/creator/${s.creator_slug || s.creator_id}`}
              className="flex items-center justify-between rounded-2xl border border-black/5 bg-white p-5 hover:border-[#146359]/30"
            >
              <div>
                <p className="font-medium">{s.creator_name}</p>
                <p className="text-sm text-black/50">{s.tier_name} — ${(s.price_cents / 100).toFixed(2)}/mo</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-black/5 text-black/50'
                }`}
              >
                {s.status}
              </span>
            </a>
          </li>
        ))}
        {subs.length === 0 && (
          <p className="text-black/40">
            No subscriptions yet. <a href="/browse" className="text-[#146359] underline">Browse creators</a>
          </p>
        )}
      </ul>
    </div>
  );
}
