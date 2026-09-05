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
    return <div className="p-12 text-center text-brand-ink/60">Loading…</div>;
  }
  if (status === 'forbidden') {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-xl font-semibold text-[#2B2420]">Not authorized</h1>
        <p className="mt-2 text-sm text-brand-ink/65">This page is only visible to the ByUs team.</p>
        <a href="/" className="mt-6 inline-block text-sm font-semibold text-[#146359] hover:underline">
          Back to ByUs →
        </a>
      </div>
    );
  }
  if (status === 'error' || !data) {
    return <div className="p-12 text-center text-brand-ink/60">Could not load the platform overview.</div>;
  }

  const {
    creatorCount,
    fanCount,
    activeSubscriberCount,
    lifetimeGrossCents,
    lifetimePlatformFeeCents,
    openDisputeCount,
    monthly,
    creators,
    disputes,
  } = data;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold">Platform overview</h1>
      <p className="text-brand-ink/65">What ByUs itself has earned, and how the platform is growing.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="ByUs revenue, lifetime" value={formatCompactUSD(lifetimePlatformFeeCents)} hero />
        <StatTile label="Gross processed, lifetime" value={formatCompactUSD(lifetimeGrossCents)} />
        <StatTile label="Creators" value={creatorCount.toLocaleString()} />
        <StatTile label="Fans" value={fanCount.toLocaleString()} />
        <StatTile label="Active subscriptions" value={activeSubscriberCount.toLocaleString()} />
        <StatTile
          label="Open disputes"
          value={openDisputeCount.toLocaleString()}
          flag={openDisputeCount > 0}
        />
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

      <div className="mt-8 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
        <h2 className="font-semibold">Disputes</h2>
        <p className="mt-1 text-sm text-brand-ink/65">
          A fan's bank disputing a charge — most need a response through Stripe's own dispute
          flow before they're resolved one way or the other.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-brand-ink/10 text-left text-xs font-medium uppercase tracking-wide text-brand-ink/60">
                <th className="py-2 pr-4">Fan</th>
                <th className="py-2 pr-4">Creator</th>
                <th className="py-2 pr-4 text-right">Amount</th>
                <th className="py-2 pr-4">Reason</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Opened</th>
              </tr>
            </thead>
            <tbody>
              {disputes.map((d) => (
                <tr key={d.id} className="border-b border-brand-ink/5">
                  <td className="py-2.5 pr-4">
                    <div className="font-medium text-[#2B2420]">{d.fanName || 'Unknown fan'}</div>
                    <div className="text-xs text-brand-ink/60">{d.fanEmail || '—'}</div>
                  </td>
                  <td className="py-2.5 pr-4">
                    <div className="font-medium text-[#2B2420]">{d.creatorName || 'Unknown creator'}</div>
                    <div className="text-xs text-brand-ink/60">{d.creatorEmail || '—'}</div>
                  </td>
                  <td className="py-2.5 pr-4 text-right font-medium text-[#2B2420]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatUSD(d.amountCents)}
                  </td>
                  <td className="py-2.5 pr-4 text-brand-ink/72">{d.reason ? formatDisputeLabel(d.reason) : '—'}</td>
                  <td className="py-2.5 pr-4">
                    <DisputeStatusBadge status={d.status} />
                  </td>
                  <td className="py-2.5 pr-4 text-brand-ink/72">
                    {new Date(d.openedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                </tr>
              ))}
              {disputes.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-brand-ink/60">
                    No disputes — nothing to review.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
        <h2 className="font-semibold">Recent creators</h2>
        <p className="mt-1 text-sm text-brand-ink/65">
          Most recent signups first — worth a look if Stripe was never connected or earnings stayed at $0.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-brand-ink/10 text-left text-xs font-medium uppercase tracking-wide text-brand-ink/60">
                <th className="py-2 pr-4">Creator</th>
                <th className="py-2 pr-4">Joined</th>
                <th className="py-2 pr-4">Stripe</th>
                <th className="py-2 pr-4">Fee</th>
                <th className="py-2 pr-4 text-right">Lifetime gross</th>
              </tr>
            </thead>
            <tbody>
              {creators.map((c) => (
                <tr key={c.id} className="border-b border-brand-ink/5">
                  <td className="py-2.5 pr-4">
                    <div className="font-medium text-[#2B2420]">{c.displayName || 'Unnamed creator'}</div>
                    <div className="text-xs text-brand-ink/60">{c.email}</div>
                  </td>
                  <td className="py-2.5 pr-4 text-brand-ink/72">
                    {new Date(c.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="py-2.5 pr-4">
                    {c.stripeConnectOnboarded ? (
                      <span className="rounded-full bg-[#146359]/10 px-2 py-0.5 text-xs font-medium text-[#146359]">Connected</span>
                    ) : (
                      <span className="rounded-full bg-brand-ink/5 px-2 py-0.5 text-xs font-medium text-brand-ink/60">Not connected</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-brand-ink/72">{c.platformFeePercent}%</td>
                  <td className="py-2.5 pr-4 text-right font-medium text-[#2B2420]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatUSD(c.lifetimeGrossCents)}
                  </td>
                </tr>
              ))}
              {creators.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-brand-ink/60">
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

// `flag`: this number is something the owner should actually go look at (e.g. one or
// more open disputes) -- shifts the tile to a warm border/value color instead of the
// neutral default, the same "don't make them hunt for it" reasoning as the dashboard's
// other status pills.
function StatTile({ label, value, hero, flag, className = '' }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        flag ? 'border-amber-300/60 bg-amber-50' : 'border-brand-ink/5 bg-brand-paper'
      } ${className}`}
    >
      <p className="text-xs text-brand-ink/65">{label}</p>
      <p
        className={`mt-1 font-semibold ${flag ? 'text-amber-700' : 'text-[#2B2420]'} ${
          hero ? 'text-2xl' : 'text-xl'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// Stripe's raw dispute status strings ('needs_response', 'warning_under_review', etc.)
// aren't something to show a human as-is. Won/lost/refunded are the terminal states
// (color-coded so they read as resolved at a glance); everything else still needs
// action, so it stays amber rather than trying to enumerate every in-between status.
function DisputeStatusBadge({ status }) {
  const terminal = {
    won: { label: 'Won', className: 'bg-green-50 text-green-700' },
    lost: { label: 'Lost', className: 'bg-red-50 text-red-700' },
    charge_refunded: { label: 'Refunded', className: 'bg-brand-ink/5 text-brand-ink/65' },
  };
  const config = terminal[status] || { label: formatDisputeLabel(status), className: 'bg-amber-50 text-amber-700' };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}>{config.label}</span>;
}

function formatDisputeLabel(value) {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="rounded-xl border border-brand-ink/5 bg-brand-paper p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-[#2B2420]">{title}</h3>
        <span className="text-xs text-brand-ink/60">{subtitle}</span>
      </div>
      <div className="mt-3 overflow-x-auto">{children}</div>
    </div>
  );
}
