'use client';

// "I'm on it" control for support desk items (videos to review, reports, fan requests).
// Shows who, if anyone, is handling an item so two people never work the same one. All
// controls on a page share one fetch of GET /api/staff/claims through the small store
// below, and any claim or release refreshes every control at once.

import { useEffect, useState } from 'react';

let cache = null;
let inflight = null;
const listeners = new Set();

function publish(data) {
  cache = data;
  listeners.forEach((fn) => fn(data));
}

function load(force = false) {
  if (inflight && !force) return inflight;
  inflight = fetch('/api/staff/claims')
    .then((r) => (r.ok ? r.json() : { me: null, claims: [] }))
    .catch(() => ({ me: null, claims: [] }))
    .then((d) => {
      publish(d);
      return d;
    });
  return inflight;
}

export default function StaffClaim({ type, id }) {
  const [data, setData] = useState(cache);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listeners.add(setData);
    load();
    return () => listeners.delete(setData);
  }, []);

  if (!data) return null;
  const claim = (data.claims || []).find((c) => c.item_type === type && c.item_id === id);
  const mine = claim && claim.user_id === data.me;

  async function act(action) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/staff/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemType: type, itemId: id, action }),
      });
      const d = await res.json().catch(() => ({}));
      if (d.claims) publish({ me: d.me, claims: d.claims });
      if (!res.ok) setError(d.error || 'Could not save that.');
    } catch {
      setError('Could not save that.');
    } finally {
      setBusy(false);
    }
  }

  const pill = 'rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-50';
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {!claim && (
        <button type="button" disabled={busy} onClick={() => act('claim')} className={`${pill} border border-[#0F766E]/40 text-[#0F766E] hover:bg-[#0F766E]/5`}>
          I&rsquo;m on it
        </button>
      )}
      {mine && (
        <>
          <span className={`${pill} bg-[#0F766E] text-white`}>You&rsquo;re on this</span>
          <button type="button" disabled={busy} onClick={() => act('release')} className="text-xs font-semibold text-brand-ink/60 hover:underline">
            Let go
          </button>
        </>
      )}
      {claim && !mine && (
        <>
          <span className={`${pill} bg-amber-100 text-amber-900`}>{claim.name || 'A teammate'} is on this</span>
          <button type="button" disabled={busy} onClick={() => act('takeover')} className="text-xs font-semibold text-brand-ink/60 hover:underline">
            Take over
          </button>
        </>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
