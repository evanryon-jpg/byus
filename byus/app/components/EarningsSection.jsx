'use client';

import { useEffect, useState } from 'react';
import MonthlyBarChart from './charts/MonthlyBarChart';
import { formatUSD, formatCompactUSD } from '@/lib/format';

// The creator's real earnings view: what they've made, where that puts them on the
// current platform fee, and how revenue and subscribers have moved over the last year.
// Self-fetching, same pattern as the other dashboard cards -- loads its own state on
// mount rather than threading it through the parent.
//
// Chart form/color/mark choices follow the dataviz skill: a single series per chart
// needs no legend (the card title says what's plotted), so both charts below use one
// hue -- the site's own brand teal -- rather than the skill's generic reference blue,
// since a single-hue chart carries no CVD-pairing risk and brand consistency wins.

export default function EarningsSection() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/creator/earnings')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, []);

  if (error) return null;
  if (!data) return null;

  const {
    effectiveFeePercent,
    lifetimeGrossCents,
    lifetimeNetCents,
    activeSubscriberCount,
    everSubscribedCount,
    churnRatePercent,
    monthly,
  } = data;

  const thisMonth = monthly[monthly.length - 1];
  const netNewThisMonth = thisMonth?.netNewSubscribers ?? 0;

  const hasAnyActivity =
    lifetimeGrossCents > 0 || activeSubscriberCount > 0 || monthly.some((m) => m.newSubscribers > 0);

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-xl bg-brand-ink/[0.03] p-4">
        <p className="text-sm text-brand-ink/70">
          Your current all-in platform fee is {effectiveFeePercent}%. Standard domestic payment
          processing is included, and your earnings go directly to your connected Stripe account.
        </p>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Net earnings, lifetime" value={formatCompactUSD(lifetimeNetCents)} hero />
        <StatTile label="Gross revenue, lifetime" value={formatCompactUSD(lifetimeGrossCents)} />
        <StatTile
          label="Active subscribers"
          value={activeSubscriberCount.toLocaleString()}
        />
        {everSubscribedCount > 0 && (
          <>
            <StatTile
              label="Net growth this month"
              value={`${netNewThisMonth > 0 ? '+' : ''}${netNewThisMonth.toLocaleString()}`}
            />
            <StatTile
              label="Lifetime churn"
              value={`${churnRatePercent}%`}
            />
          </>
        )}
      </div>

      {hasAnyActivity ? (
        <>
          <ChartCard title="Revenue" subtitle="Gross, by month">
            <MonthlyBarChart data={monthly} valueKey="grossCents" formatValue={formatUSD} formatAxisTick={formatUSD} />
          </ChartCard>
          <ChartCard title="Subscriber growth" subtitle="New subscribers, by month">
            <MonthlyBarChart
              data={monthly}
              valueKey="newSubscribers"
              formatValue={(n) => `${n.toLocaleString()} new`}
              formatAxisTick={(n) => n.toLocaleString()}
            />
          </ChartCard>
          {everSubscribedCount > 0 && (
            <p className="text-xs text-brand-ink/60">
              Lifetime churn is the share of everyone who's ever subscribed who has since
              canceled ({everSubscribedCount.toLocaleString()} total). Net growth is new
              subscribers minus cancellations for the month shown.
            </p>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-brand-ink/10 px-4 py-8 text-center">
          <p className="text-sm text-brand-ink/65">
            Your revenue and subscriber growth will show up here once fans start subscribing.
          </p>
        </div>
      )}
    </div>
  );
}

// Stat tile per the dataviz skill's figure contract: sentence-case label, no trailing
// colon, semibold value in the default proportional figures (never tabular-nums --
// that's for columns of aligned numbers, not a standalone display value).
function StatTile({ label, value, hero, className = '' }) {
  return (
    <div className={`rounded-xl border border-brand-ink/5 bg-brand-paper p-4 ${className}`}>
      <p className="text-xs text-brand-ink/65">{label}</p>
      <p className={`mt-1 font-semibold text-[#172033] ${hero ? 'text-2xl' : 'text-xl'}`}>{value}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="rounded-xl border border-brand-ink/5 bg-brand-paper p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-[#172033]">{title}</h3>
        <span className="text-xs text-brand-ink/60">{subtitle}</span>
      </div>
      {/* Wide content scrolls inside its own container rather than the page -- the
          12-slot chart stays comfortably spaced even on a narrow phone screen. */}
      <div className="mt-3 overflow-x-auto">{children}</div>
    </div>
  );
}
