'use client';

import { useEffect, useState } from 'react';

export default function FanDashboard() {
  const [user, setUser] = useState(null);
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const meRes = await fetch('/api/me');
      if (!meRes.ok) {
        window.location.href = '/login';
        return;
      }
      setUser((await meRes.json()).user);
      const subsRes = await fetch('/api/fan/subscriptions');
      if (subsRes.ok) setSubs((await subsRes.json()).subscriptions);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-12 text-center text-black/40">Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">Your subscriptions</h1>
      <p className="text-black/50">Welcome back, {user?.display_name || user?.email}.</p>

      <ul className="mt-8 space-y-3">
        {subs.map((s) => (
          <li key={s.id} className="flex items-center justify-between rounded-2xl border border-black/5 bg-white p-5">
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
