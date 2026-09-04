'use client';

import { useEffect, useState } from 'react';

// The creator's real earnings view: what they've made, where that puts them on the
// platform fee tier, and how revenue and subscribers have moved over the last year.
// Self-fetching, same pattern as the other dashboard cards -- loads its own state on
// mount rather than threading it through the parent. Replaces the old FeeTierCard,
// which only ever showed the fee-tier progress bar; this keeps that bar and adds the
// numbers a creator actually opens Stripe to go find.
//
// Chart form/color/mark choices follow the dataviz skill: a single series per chart
// needs no legend (the card title says what's plotted), so both charts below use one
// hue -- the site's own brand teal -- rather than the skill's generic reference blue,
// since a single-hue chart carries no CVD-pairing risk and brand consistency wins.
const TEAL = '#146359';
const TEAL_HOVER = '#1c8577'; // lighter step of the same hue -- the hover "lift"
const GRIDLINE = '#e1e0d9';
const AXIS_TEXT = '#898781'; // muted ink -- ticks and month labels never wear the series color
const SURFACE = '#fcfcfb';

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
    feePercent,
    discountedFeePercent,
    thresholdCents,
    lifetimeGrossCents,
    lifetimeNetCents,
    activeSubscriberCount,
    monthly,
  } = data;

  const alreadyDiscounted = feePercent <= discountedFeePercent;
  const progress = Math.min(1, lifetimeGrossCents / thresholdCents);
  const hasAnyActivity =
    lifetimeGrossCents > 0 || activeSubscriberCount > 0 || monthly.some((m) => m.newSubscribers > 0);

  return (
    <div className="mt-4 space-y-4">
      {/* Fee tier — unchanged in substance from the earlier progress card, just now one
          piece of a fuller view instead of the whole thing. */}
      <div className="rounded-xl bg-black/[0.03] p-4">
        {alreadyDiscounted ? (
          <p className="text-sm text-[#146359]">
            🎉 You've unlocked ByUs's lowest rate — {feePercent}% platform fee, for good.
          </p>
        ) : (
          <>
            <p className="text-sm text-black/60">
              You're on the {feePercent}% starter rate. Once your lifetime earnings on ByUs
              cross ${(thresholdCents / 100).toLocaleString()}, your fee drops to {discountedFeePercent}%
              permanently — for every subscriber, not just new ones.
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/10">
              <div
                className="h-full rounded-full bg-[#146359] transition-all"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-black/40">
              ${(lifetimeGrossCents / 100).toFixed(2)} of ${(thresholdCents / 100).toLocaleString()} earned
            </p>
          </>
        )}
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Net earnings, lifetime" value={formatCompactUSD(lifetimeNetCents)} hero />
        <StatTile label="Gross revenue, lifetime" value={formatCompactUSD(lifetimeGrossCents)} />
        <StatTile
          label="Active subscribers"
          value={activeSubscriberCount.toLocaleString()}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {hasAnyActivity ? (
        <>
          <ChartCard title="Revenue" subtitle="Gross, by month">
            <MonthlyBarChart data={monthly} valueKey="grossCents" formatValue={formatUSD} formatAxisTick={formatAxisUSD} />
          </ChartCard>
          <ChartCard title="Subscriber growth" subtitle="New subscribers, by month">
            <MonthlyBarChart
              data={monthly}
              valueKey="newSubscribers"
              formatValue={(n) => `${n.toLocaleString()} new`}
              formatAxisTick={(n) => n.toLocaleString()}
            />
          </ChartCard>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-black/10 px-4 py-8 text-center">
          <p className="text-sm text-black/50">
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
      {/* Wide content scrolls inside its own container rather than the page -- the
          12-slot chart stays comfortably spaced even on a narrow phone screen. */}
      <div className="mt-3 overflow-x-auto">{children}</div>
    </div>
  );
}

// A single-series monthly bar chart, built to the dataviz skill's mark specs: bars
// capped at 24px thick with a 4px rounded data-end (square at the baseline), a 2px
// surface gap between adjacent bars, hairline recessive gridlines, y-axis ticks rounded
// to clean numbers, and a direct label on just the current month's bar -- the rest stay
// reachable via hover/focus tooltip rather than flooding the chart with a number on
// every bar. One series needs no legend box; the card title above already says what's
// plotted.
function MonthlyBarChart({ data, valueKey, formatValue, formatAxisTick }) {
  const [active, setActive] = useState(null); // index of hovered/focused bar

  const slotWidth = 56;
  const barWidth = 22; // <=24px cap
  const chartHeight = 160;
  const topPad = 28; // room for the direct label above the tallest bar
  const bottomPad = 22; // month labels
  const leftPad = 40; // y-axis tick labels
  const width = leftPad + data.length * slotWidth;
  const height = topPad + chartHeight + bottomPad;

  const values = data.map((d) => d[valueKey]);
  const maxValue = Math.max(...values, 0);
  const axisMax = niceMax(maxValue);
  const ticks = axisMax === 0 ? [0] : [0, axisMax / 2, axisMax];

  function yFor(value) {
    if (axisMax === 0) return topPad + chartHeight;
    return topPad + chartHeight - (value / axisMax) * chartHeight;
  }

  const lastIndex = data.length - 1;

  return (
    <div style={{ minWidth: width }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        role="img"
        aria-label={`${valueKey === 'newSubscribers' ? 'New subscribers' : 'Revenue'} by month, last ${data.length} months`}
      >
        {/* Gridlines + y-axis ticks */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={leftPad}
              x2={width}
              y1={yFor(t)}
              y2={yFor(t)}
              stroke={GRIDLINE}
              strokeWidth="1"
              shapeRendering="crispEdges"
            />
            <text x={leftPad - 8} y={yFor(t)} textAnchor="end" dominantBaseline="middle" fontSize="10" fill={AXIS_TEXT}>
              {formatAxisTick(Math.round(t))}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const value = d[valueKey];
          const barHeight = axisMax === 0 ? 0 : (value / axisMax) * chartHeight;
          const x = leftPad + i * slotWidth + (slotWidth - barWidth) / 2;
          const y = topPad + chartHeight - barHeight;
          const isActive = active === i;
          const isCurrent = i === lastIndex;
          const label = monthLabel(d.month);

          return (
            <g key={d.month}>
              {/* Hit target: the full slot, taller than the bar itself, so hover/focus
                  works even over a near-zero-height bar. */}
              <rect
                x={leftPad + i * slotWidth}
                y={topPad}
                width={slotWidth}
                height={chartHeight}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`${label}: ${formatValue(value)}`}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive((cur) => (cur === i ? null : cur))}
                onFocus={() => setActive(i)}
                onBlur={() => setActive((cur) => (cur === i ? null : cur))}
              />
              {barHeight > 0 ? (
                <path
                  d={roundedTopBarPath(x, y, barWidth, barHeight, 4)}
                  fill={isActive ? TEAL_HOVER : TEAL}
                  pointerEvents="none"
                />
              ) : (
                // Zero months still get a hairline baseline mark so the slot doesn't
                // read as missing data.
                <line
                  x1={x}
                  x2={x + barWidth}
                  y1={topPad + chartHeight}
                  y2={topPad + chartHeight}
                  stroke={GRIDLINE}
                  strokeWidth="2"
                  pointerEvents="none"
                />
              )}
              {isCurrent && (
                <text
                  x={x + barWidth / 2}
                  y={Math.max(12, y - 8)}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="#1A1A1A"
                  pointerEvents="none"
                >
                  {formatValue(value)}
                </text>
              )}
              {isActive && !isCurrent && (
                <text
                  x={x + barWidth / 2}
                  y={Math.max(12, y - 8)}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="#1A1A1A"
                  pointerEvents="none"
                >
                  {formatValue(value)}
                </text>
              )}
              <text
                x={leftPad + i * slotWidth + slotWidth / 2}
                y={topPad + chartHeight + 16}
                textAnchor="middle"
                fontSize="10"
                fill={AXIS_TEXT}
                pointerEvents="none"
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* Baseline */}
        <line
          x1={leftPad}
          x2={width}
          y1={topPad + chartHeight}
          y2={topPad + chartHeight}
          stroke={GRIDLINE}
          strokeWidth="1"
          shapeRendering="crispEdges"
        />
      </svg>
    </div>
  );
}

function roundedTopBarPath(x, y, w, h, r) {
  const radius = Math.min(r, h, w / 2);
  return `M${x},${y + h} L${x},${y + radius} Q${x},${y} ${x + radius},${y} L${x + w - radius},${y} Q${x + w},${y} ${x + w},${y + radius} L${x + w},${y + h} Z`;
}

function monthLabel(yyyyMm) {
  const [year, month] = yyyyMm.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
}

// Rounds a max value up to a clean axis ceiling (1/2/5 x 10^n) so ticks read as round
// numbers rather than an arbitrary max.
function niceMax(value) {
  if (value <= 0) return 0;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  let niceNormalized;
  if (normalized <= 1) niceNormalized = 1;
  else if (normalized <= 2) niceNormalized = 2;
  else if (normalized <= 5) niceNormalized = 5;
  else niceNormalized = 10;
  return niceNormalized * magnitude;
}

function formatUSD(cents) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatAxisUSD(cents) {
  return formatUSD(cents);
}

// Auto-compact per the dataviz stat-tile contract: 1,284 / 12.9K / $4.2M.
function formatCompactUSD(cents) {
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (Math.abs(dollars) >= 10_000) return `$${(dollars / 1_000).toFixed(1)}K`;
  return `$${dollars.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
