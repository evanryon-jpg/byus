'use client';

import { useState } from 'react';

// A single-series monthly bar chart, shared by the creator earnings dashboard and the
// platform admin dashboard. Built to the dataviz skill's mark specs: bars capped at
// 24px thick with a 4px rounded data-end (square at the baseline), a 2px surface gap
// between adjacent bars, hairline recessive gridlines, y-axis ticks rounded to clean
// numbers, and a direct label on just the current month's bar -- the rest stay reachable
// via hover/focus tooltip rather than flooding the chart with a number on every bar.
// One series needs no legend box; the card title above it already says what's plotted.
const GRIDLINE = '#e1e0d9';
const AXIS_TEXT = '#898781'; // muted ink -- ticks and month labels never wear the series color

export default function MonthlyBarChart({
  data,
  valueKey,
  formatValue,
  formatAxisTick,
  color = '#146359',
  hoverColor = '#1c8577',
  ariaLabel,
}) {
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
        aria-label={ariaLabel || `${valueKey} by month, last ${data.length} months`}
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
                  fill={isActive ? hoverColor : color}
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
              {(isCurrent || (isActive && !isCurrent)) && (
                <text
                  x={x + barWidth / 2}
                  y={Math.max(12, y - 8)}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="#2B2420"
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
