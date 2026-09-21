'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// "Sync now" -- pulls the latest from Stripe, then refreshes the server-rendered page.
export function SyncButton() {
  const router = useRouter();
  const [state, setState] = useState({ busy: false, message: '' });

  async function sync() {
    setState({ busy: true, message: 'Syncing with Stripe…' });
    try {
      const res = await fetch('/api/admin/accounting/sync', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setState({ busy: false, message: 'A sync is already running. Try again in a minute.' });
      } else if (!res.ok) {
        setState({ busy: false, message: data.error || 'Sync failed.' });
      } else {
        const problems = data.errors?.length ? ` · ${data.errors.length} warning(s)` : '';
        setState({ busy: false, message: `Synced ${data.transactions} transaction(s), ${data.payouts} creator payout(s)${problems}.` });
      }
    } catch {
      setState({ busy: false, message: 'Sync failed — check your connection.' });
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button
        type="button"
        onClick={sync}
        disabled={state.busy}
        className="rounded-full bg-[#0F766E] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0d6961] disabled:opacity-60"
      >
        {state.busy ? 'Syncing…' : 'Sync now'}
      </button>
      {state.message && <p className="text-xs text-brand-ink/65" role="status">{state.message}</p>}
    </div>
  );
}

// Period / year / filter dropdown that rewrites one query param and navigates.
export function ParamSelect({ name, value, options, label }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(event) {
    const params = new URLSearchParams(searchParams.toString());
    if (event.target.value) params.set(name, event.target.value);
    else params.delete(name);
    params.delete('page');
    router.push(`/admin/accounting?${params.toString()}`);
  }

  return (
    <label className="flex items-center gap-2 text-sm text-brand-ink/70">
      <span>{label}</span>
      <select
        value={value}
        onChange={onChange}
        className="rounded-lg border border-brand-ink/15 bg-white px-3 py-1.5 text-sm text-[#172033]"
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
