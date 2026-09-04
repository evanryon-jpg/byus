'use client';

import { useEffect, useState } from 'react';
import MonthlyBarChart from '../components/charts/MonthlyBarChart';
import { formatUSD, formatCompactUSD } from '@/lib/format';

// Platform-wide view for the owner: what ByUs itself has earned, creator/fan growth, and
// a list of recent creators to spot problems (never connected Stripe, zero earnings after
// weeks signed up). The real gate is server-side in /api/admin/overview (lib/admin.js's
// email allowlist) -- this page just reflects whatever that endpoint decides, the same
// pattern the rest of the dashboard uses for role checks.
export default function AdminPage() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'forbidden' | 'error'
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/admin/overview')
      .then((res) => {
        if (res.status === 403) {
          setStatus('forbidden');
          return null;
        }
        if (!res.ok) {
          setStatus('error');
          return null;
        }
        return res.json();
      })
      .then((json) => {
        if (json) {
          setData(json);
          setStatus('ok');
        }
      })
      .catch(() => setStatus('error'));
  }, []);

  if (status === 'loading') {
    return <div className="p-12 text-center text-black/40">Loading…</div>;
  }
  if (status === 'forbidden') {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-xl font-semibold text-[#1A1A1A]">Not authorized</h1>
        <p className="mt-2 text-sm text-black/50">This page is only visible to the ByUs team.</p>
        <a href="/" className="mt-6 inline-block text-sm font-semibold text-[#146359] hover:underline">
          Back to ByUs →
        </a>
      </div>
    );
  }
  if (status === 'error' || !data) {
    return <div className="p-12 text-center text-black/40">Could not load the platform overview.</div>;
  }

  const { creatorCount, fanCount, activeSubscriberCount, lifetimeGrossCents, lifetimePlatformFeeCents, monthly, creators } = data;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold">Platform overview</h1>
      <p className="text-black/50">What ByUs itself has earned, and how the platform is growing.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="ByUs revenue, lifetime" value={formatCompactUSD(lifetimePlatformFeeCents)} hero />
        <StatTile label="Gross processed, lifetime" value={formatCompactUSD(lifetimeGrossCents)} />
        <StatTile label="Creators" value={creatorCount.toLocaleString()} />
        <StatTile label="Fans" value={fanCount.toLocaleString()} />
        <StatTile label="Active subscriptions" value={activeSubscriberCount.toLocaleString()} className="col-span-2 sm:col-span-1" />
      </div>

      <div className="mt-6 space-y-4">
        <ChartCard title="ByUs revenue" subtitle="Platform fee income, by month">
          <MonthlyBarChart data={monthly} valueKey="platformFeeCents" formatValue={formatUSD} formatAxisTick={formatUSD} />
        </ChartCard>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChartCard title="New creators" subtitle="Signups, by month">
            <MonthlyBarChart
              data={monthly}
              valueKey="newCreators"
              formatValue={(n) => `${n.toLocaleString()} new`}
              formatAxisTick={(n) => n.toLocaleString()}
            />
          </ChartCard>
          <ChartCard title="New fans" subtitle="Signups, by month">
            <MonthlyBarChart
              data={monthly}
              valueKey="newFans"
              formatValue={(n) => `${n.toLocaleString()} new`}
              formatAxisTick={(n) => n.toLocaleString()}
              color="#8a6b2f"
              hoverColor="#a5854a"
            />
          </ChartCard>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-black/5 bg-white p-6">
        <h2 className="font-semibold">Recent creators</h2>
        <p className="mt-1 text-sm text-black/50">
          Most recent signups first — worth a look if Stripe was never connected or earnings stayed at $0.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left text-xs font-medium uppercase tracking-wide text-black/40">
                <th className="py-2 pr-4">Creator</th>
                <th className="py-2 pr-4">Joined</th>
                <th className="py-2 pr-4">Stripe</th>
                <th className="py-2 pr-4">Fee</th>
                <th className="py-2 pr-4 text-right">Lifetime gross</th>
              </tr>
            </thead>
            <tbody>
              {creators.map((c) => (
                <tr key={c.id} className="border-b border-black/5">
                  <td className="py-2.5 pr-4">
                    <div className="font-medium text-[#1A1A1A]">{c.displayName || 'Unnamed creator'}</div>
                    <div className="text-xs text-black/40">{c.email}</div>
                  </td>
                  <td className="py-2.5 pr-4 text-black/60">
                    {new Date(c.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="py-2.5 pr-4">
                    {c.stripeConnectOnboarded ? (
                      <span className="rounded-full bg-[#146359]/10 px-2 py-0.5 text-xs font-medium text-[#146359]">Connected</span>
                    ) : (
                      <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium text-black/40">Not connected</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-black/60">{c.platformFeePercent}%</td>
                  <td className="py-2.5 pr-4 text-right font-medium text-[#1A1A1A]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatUSD(c.lifetimeGrossCents)}
                  </td>
                </tr>
              ))}
              {creators.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-black/40">
                    No creators have signed up yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, hero, className = '' }) {
  return (
    <div className={`rounded-xl border border-black/5 bg-white p-4 ${className}`}>
      <p className="text-xs text-black/50">{label}</p>
      <p className={`mt-1 font-semibold text-[#1A1A1A] ${hero ? 'text-2xl' : 'text-xl'}`}>{value}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-[#1A1A1A]">{title}</h3>
        <span className="text-xs text-black/40">{subtitle}</span>
      </div>
      <div className="mt-3 overflow-x-auto">{children}</div>
    </div>
  );
}
